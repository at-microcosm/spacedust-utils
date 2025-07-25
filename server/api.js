import fs from 'node:fs';
import http from 'http';
import { jwtVerify } from 'jose';
import cookie from 'cookie';
import cookieSig from 'cookie-signature';
import { v4 as uuidv4 } from 'uuid';

const replyJson = (res, code) => res.setHeader('Content-Type', 'application/json').writeHead(code);
const errJson = (code, reason) => res => replyJson(res, code).end(JSON.stringify({ reason }));

const ok = (res, data) => replyJson(res, 200).end(JSON.stringify(data));
const gotIt = res => res.writeHead(201).end();
const okBye = res => res.writeHead(204).end();
const notModified = res => res.writeHead(304).end();
const badRequest = (res, reason) => errJson(400, reason)(res);
const forbidden = errJson(401, 'forbidden');
const unauthorized = errJson(403, 'unauthorized');
const notFound = errJson(404, 'not found');
const conflict = errJson(409, 'conflict');
const serverError = errJson(500, 'internal server error');

const getRequesBody = async req => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => resolve(body));
  req.on('error', err => reject(err));
});

const COOKIE_BASE = { httpOnly: true, secure: true, partitioned: true, sameSite: 'None' };
const setAccountCookie = (res, did, session, appSecret) => res.setHeader('Set-Cookie', cookie.serialize(
  'verified-account',
  cookieSig.sign(JSON.stringify([did, session]), appSecret),
  { ...COOKIE_BASE, maxAge: 90 * 86_400 },
));
const clearAccountCookie = res => res.setHeader('Set-Cookie', cookie.serialize(
  'verified-account',
  '',
  { ...COOKIE_BASE, expires: new Date(0) },
));

const getUser = (req, res, db, appSecret, adminDid) => {
  const cookies = cookie.parse(req.headers.cookie ?? '');
  const untrusted = cookies['verified-account'] ?? '';
  const json = cookieSig.unsign(untrusted, appSecret);
  if (!json) {
    clearAccountCookie(res);
    return null;
  }
  let did, session;
  try {
    [did, session] = JSON.parse(json);
  } catch (e) {
    console.warn('validated account cookie but failed to parse json', e);
    clearAccountCookie(res);
    return null;
  }
  let role;
  if (did === adminDid) {
    role = 'admin';
  } else {
    const account = db.getAccount(did);
    if (!account) {
      console.warn('valid account cookie but could not find in db');
      clearAccountCookie(res);
      return null;
    }
    role = account.role ?? 'public';
  }
  return { did, session, role };
};

/////// handlers

// never EVER allow user-controllable input into fname (or just fix the path joining)
const handleFile = (fname, ftype) => async (req, res, replace = {}) => {
  let content
  try {
    content = await fs.promises.readFile(`./web-content/${fname}`); // DANGERDANGER
    content = content.toString();
  } catch (err) {
    console.error(err);
    return serverError(res);
  }
  res.setHeader('Content-Type', ftype);
  res.writeHead(200);
  for (let k in replace) {
    content = content.replace(k, JSON.stringify(replace[k]));
  }
  res.end(content);
}
const handleIndex = handleFile('index.html', 'text/html');

const handleVerify = async (db, req, res, secrets, jwks, adminDid) => {
  const body = await getRequesBody(req);
  const { token } = JSON.parse(body);
  let did;
  try {
    const verified = await jwtVerify(token, jwks);
    did = verified.payload.sub;
  } catch (e) {
    console.warn('jwks verification failed', e);
    return badRequest(res, 'token verification failed');
  }
  const isAdmin = did && did === adminDid;
  db.addAccount(did);
  const session = uuidv4();
  setAccountCookie(res, did, session, secrets.appSecret);
  return ok(res, {
      webPushPublicKey: secrets.pushKeys.publicKey,
      role: isAdmin ? 'admin' : 'public',
      did,
  });
};

const handleHello = async (user, req, res, webPushPublicKey, whoamiHost) =>
  ok(res, {
    whoamiHost,
    webPushPublicKey,
    role: user?.role ?? 'anonymous',
    did: user?.did,
  });

const handleSubscribe = async (db, user, req, res, updateSubs) => {
  const body = await getRequesBody(req);
  const { sub } = JSON.parse(body);
  try {
    db.addPushSub(user.did, user.session, JSON.stringify(sub));
  } catch (e) {
    console.warn('failed to add sub', e);
    return serverError(res);
  }
  updateSubs(db);
  return gotIt(res);
};

const handlePushTest = async (db, user, res, push) => {
  const subscription = db.getSubBySession(user.session);
  const payload = JSON.stringify({
    subject: user.did,
    source: 'blue.microcosm.test.notification:hello',
    source_record: `at://${user.did}/blue.microcosm.test.notification/test`,
    timestamp: +new Date(),
  });
  await push(db, subscription, payload);
  return okBye(res);
};

const handleLogout = async (db, user, req, res, appSecret, updateSubs) => {
  try {
    db.deleteSub(user.session);
  } catch (e) {
    console.warn('failed to remove sub', e);
    return serverError(res);
  }
  updateSubs(db);
  clearAccountCookie(res);
  return okBye(res);
};

const handleTopSecret = async (db, user, req, res) => {
  // TODO: succeed early if they're already in?
  const body = await getRequesBody(req);
  const { secret_password } = JSON.parse(body);
  const { did } = user;
  const role = 'early';
  const updated = db.setRole({ did, role, secret_password });
  if (updated) {
    return okBye(res);
  } else {
    return forbidden(res);
  }
};

const handleGetGlobalNotifySettings = async (db, user, res) => {
  const settings = db.getNotifyAccountGlobals(user.did);
  return ok(res, settings);
};

const handleSetGlobalNotifySettings = async (db, user, req, res) => {
  const body = await getRequesBody(req);
  const { notify_enabled, notify_self } = JSON.parse(body);
  db.setNotifyAccountGlobals(user.did, { notify_enabled, notify_self });
  return gotIt(res);
};

const handleGetNotificationFilter = async (db, user, searchParams, res) => {
  const selector = searchParams.get('selector');
  if (!selector) return badRequest(res, '"selector" required in search query');

  const selection = searchParams.get('selection');
  if (!selection) return badRequest(res, '"selection" required in search query');

  const { did } = user;

  const notify = db.getNotificationFilter(did, selector, selection) ?? null;
  return ok(res, { notify });
};

const handleSetNotificationFilter = async (db, user, req, res) => {
  const body = await getRequesBody(req);
  const { selector, selection, notify } = JSON.parse(body);
  const { did } = user;
  db.setNotificationFilter(did, selector, selection, notify);
  return ok(res, { notify });
};

/// admin stuff

const handleListSecrets = async (db, res) => {
  const secrets = db.getSecrets();
  return ok(res, secrets);
};

const handleAddSecret = async (db, req, res) => {
  const body = await getRequesBody(req);
  const { secret_password } = JSON.parse(body);
  try {
    db.addTopSecret(secret_password);
  } catch (e) {
    if (['SQLITE_CONSTRAINT_PRIMARYKEY', 'SQLITE_CONSTRAINT_CHECK'].includes(e.code)) {
      return conflict(res);
    }
    throw e;
  }
  return gotIt(res);
};

const handleExpireSecret = async (db, req, res) => {
  const body = await getRequesBody(req);
  const { secret_password } = JSON.parse(body);
  if (db.expireTopSecret(secret_password)) {
    return gotIt(res);
  } else {
    return notModified(res);
  }
};

const handleTopSecretAccounts = async (db, req, res, searchParams) => {
  const secret = searchParams.get('secret_password');
  const accounts = secret ? db.getSecretAccounts(secret) : db.getNonSecretAccounts();
  return ok(res, accounts);
};


/////// end handlers

const attempt = listener => async (req, res) => {
  console.log(`-> ${req.method} ${req.url}`);
  try {
    await listener(req, res);
    console.log(` <-${req.method} ${req.url} (${res.statusCode})`);
  } catch (e) {
    console.error('listener errored:', e);
    return serverError(res);
  }
};

const withCors = (allowedOrigin, listener) => {
  const corsHeaders = new Headers({
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'OPTIONS, GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  });
  return (req, res) => {
    res.setHeaders(corsHeaders);
    if (req.method === 'OPTIONS') {
      return okBye(res);
    }
    return listener(req, res);
  }
}

export const server = (secrets, jwks, allowedOrigin, whoamiHost, db, updateSubs, push, adminDid) => {
  const handler = (req, res) => {
    // don't love this but whatever
    const { pathname, searchParams } = new URL(`http://localhost${req.url}`);
    const { method } = req;

    // public (we're doing fall-through auth, what could go wrong)
    if (method === 'GET' && pathname === '/') {
      return handleIndex(req, res, {});
    }
    if (method === 'POST' && pathname === '/verify') {
      return handleVerify(db, req, res, secrets, jwks, adminDid);
    }

    // semi-public
    const user = getUser(req, res, db, secrets.appSecret, adminDid);
    if (method === 'GET' && pathname === '/hello') {
      return handleHello(user, req, res, secrets.pushKeys.publicKey, whoamiHost);
    }

    // login required
    if (method === 'POST' && pathname === '/logout') {
      if (!user) return unauthorized(res);
      return handleLogout(db, user, req, res, secrets.appSecret, updateSubs);
    }
    if (method === 'POST' && pathname === '/super-top-secret-access') {
      if (!user) return unauthorized(res);
      return handleTopSecret(db, user, req, res);
    }
    if (method === 'GET' && pathname === '/global-notify') {
      if (!user) return unauthorized(res);
      return handleGetGlobalNotifySettings(db, user, res);
    }
    if (method === 'POST' && pathname === '/global-notify') {
      if (!user) return unauthorized(res);
      return handleSetGlobalNotifySettings(db, user, req, res);
    }
    if (method === 'GET' && pathname === '/notification-filter') {
      if (!user) return unauthorized(res);
      return handleGetNotificationFilter(db, user, searchParams, res);
    }
    if (method === 'POST' && pathname === '/notification-filter') {
      if (!user) return unauthorized(res);
      return handleSetNotificationFilter(db, user, req, res);
    }

    // non-public access required
    if (method === 'POST' && pathname === '/subscribe') {
      if (!user || user.role === 'public') return forbidden(res);
      return handleSubscribe(db, user, req, res, updateSubs);
    }
    if (method === 'POST' && pathname === '/push-test') {
      if (!user || user.role === 'public') return forbidden(res);
      return handlePushTest(db, user, res, push);
    }

    // admin required (just 404 for non-admin)
    if (user?.role === 'admin') {
      if (method === 'GET' && pathname === '/top-secrets') {
        return handleListSecrets(db, res);
      }
      if (method === 'POST' && pathname === '/top-secret') {
        return handleAddSecret(db, req, res);
      }
      if (method === 'POST' && pathname === '/expire-top-secret') {
        return handleExpireSecret(db, req, res);
      }
      if (method === 'GET' && pathname === '/top-secret-accounts') {
        return handleTopSecretAccounts(db, req, res, searchParams);
      }
    }

    // sigh
    return notFound(res);
  };

  return http.createServer(attempt(withCors(allowedOrigin, handler)));
}
