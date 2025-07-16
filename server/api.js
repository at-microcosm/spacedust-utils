import fs from 'node:fs';
import http from 'http';
import { jwtVerify } from 'jose';
import cookie from 'cookie';
import cookieSig from 'cookie-signature';
import { v4 as uuidv4 } from 'uuid';

const replyJson = (res, code) => res.setHeader('Content-Type', 'application/json').writeHead(code);
const errJson = (code, reason) => res => replyJson(res, code).end(JSON.stringify({ reason }));

const badRequest = (res, reason) => errJson(400, reason)(res);
const forbidden = errJson(401, 'forbidden');
const unauthorized = errJson(403, 'unauthorized');
const notFound = errJson(404, 'not found');
const serverError = errJson(500, 'internal server error');
const okBye = res => res.writeHead(204).end();
const ok = (res, data) => replyJson(res, 200).end(JSON.stringify(data));

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
}

const handleTopSecret = async (db, user, req, res) => {
  const body = await getRequesBody(req);
  const { secret_password } = JSON.parse(body);
  console.log({ secret_password });
  const role = 'early';
  db.setRole(user.did, role, secret_password);
  return okBye(res);
}

const attempt = listener => async (req, res) => {
  console.log(`-> ${req.method} ${req.url}`);
  try {
    return await listener(req, res);
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

export const server = (secrets, jwks, allowedOrigin, whoamiHost, db, updateSubs, adminDid) => {
  const handler = (req, res) => {
    // public (we're doing fall-through auth, what could go wrong)
    if (req.method === 'GET' && req.url === '/') {
      return handleIndex(req, res, {});
    }
    if (req.method === 'POST' && req.url === '/verify') {
      return handleVerify(db, req, res, secrets, jwks, adminDid);
    }

    // semi-public
    const user = getUser(req, res, db, secrets.appSecret, adminDid);
    if (req.method === 'GET' && req.url === '/hello') {
      return handleHello(user, req, res, secrets.pushKeys.publicKey, whoamiHost);
    }

    // login required
    if (req.method === 'POST' && req.url === '/logout') {
      if (!user) return unauthorized(res);
      return handleLogout(db, user, req, res, secrets.appSecret, updateSubs);
    }
    if (req.method === 'POST' && req.url === '/super-top-secret-access') {
      if (!user) return unauthorized(res);
      return handleTopSecret(db, req, res, secrets.appSecret);
    }

    // non-public access required
    if (req.method === 'POST' && req.url === '/subscribe') {
      if (!user || user.role === 'public') return forbidden(res);
      return handleSubscribe(db, user, req, res, updateSubs);
    }

    // admin required

    // sigh
    return notFound(res);
  };

  return http.createServer(attempt(withCors(allowedOrigin, handler)));
}
