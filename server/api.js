import fs from 'node:fs';
import http from 'http';
import { jwtVerify } from 'jose';
import cookie from 'cookie';
import cookieSig from 'cookie-signature';
import { v4 as uuidv4 } from 'uuid';

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

const getAccountCookie = (req, res, appSecret, adminDid, noDidCheck = false) => {
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

  // not yet public!!
  if (!did || (did !== adminDid && !noDidCheck)) {
    console.log('no, clearing you', did, did === adminDid, noDidCheck);
    clearAccountCookie(res)
      .setHeader('Content-Type', 'application/json')
      .writeHead(403)
      .end(JSON.stringify({
        reason: 'the spacedust notifications demo isn\'t public yet!',
      }));
    throw new Error('unauthorized');
  }

  return [did, session, did && (did === adminDid)];
};

// never EVER allow user-controllable input into fname (or just fix the path joining)
const handleFile = (fname, ftype) => async (req, res, replace = {}) => {
  let content
  try {
    content = await fs.promises.readFile(`./web-content/${fname}`); // DANGERDANGER
    content = content.toString();
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal server error');
    return;
  }
  res.setHeader('Content-Type', ftype);
  res.writeHead(200);
  for (let k in replace) {
    content = content.replace(k, JSON.stringify(replace[k]));
  }
  res.end(content);
}
const handleIndex = handleFile('index.html', 'text/html');
const handleServiceWorker = handleFile('service-worker.js', 'application/javascript');

const handleHello = async (db, req, res, secrets, whoamiHost, adminDid) => {
  const resBase = { webPushPublicKey: secrets.pushKeys.publicKey, whoamiHost };
  res.setHeader('Content-Type', 'application/json');
  let info = getAccountCookie(req, res, secrets.appSecret, adminDid, true);
  if (info) {
    const [did, _session, isAdmin] = info;
    let role = db.getAccount(did)?.role;
    role = isAdmin ? 'admin' : (role ?? 'public');
    res
      .setHeader('Content-Type', 'application/json')
      .writeHead(200)
      .end(JSON.stringify({ ...resBase, role, did }));
  } else {
    res
      .setHeader('Content-Type', 'application/json')
      .writeHead(200)
      .end(JSON.stringify({ ...resBase, role: 'anonymous' }));
  }
};

const handleVerify = async (db, req, res, secrets, whoamiHost, adminDid, jwks) => {
  const body = await getRequesBody(req);
  const { token } = JSON.parse(body);
  let did;
  try {
    const verified = await jwtVerify(token, jwks);
    did = verified.payload.sub;
  } catch (e) {
    console.warn('jwks verification failed', e);
    return clearAccountCookie(res).writeHead(400).end(JSON.stringify({ reason: 'verification failed' }));
  }
  const isAdmin = did && did === adminDid;
  db.addAccount(did);
  const session = uuidv4();
  setAccountCookie(res, did, session, secrets.appSecret);
  return res
    .setHeader('Content-Type', 'application/json')
    .writeHead(200)
    .end(JSON.stringify({
      did,
      role: isAdmin ? 'admin' : 'public',
      webPushPublicKey: secrets.pushKeys.publicKey,
    }));
};

const handleSubscribe = async (db, req, res, appSecret, updateSubs, adminDid) => {
  let info = getAccountCookie(req, res, appSecret, adminDid, true);
  if (!info) return res.writeHead(400).end(JSON.stringify({ reason: 'failed to verify cookie signature' }));
  const [did, session, _isAdmin] = info;
  const body = await getRequesBody(req);
  const { sub } = JSON.parse(body);
  // addSub('did:plc:z72i7hdynmk6r22z27h6tvur', sub); // DELETEME @bsky.app (DEBUG)
  try {
    db.addPushSub(did, session, JSON.stringify(sub));
  } catch (e) {
    console.warn('failed to add sub', e);
    return res
      .setHeader('Content-Type', 'application/json')
      .writeHead(500)
      .end(JSON.stringify({ reason: 'failed to register subscription' }));
  }
  updateSubs(db);
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(201);
  res.end(JSON.stringify({ sup: 'hi' }));
};

const handleLogout = async (db, req, res, appSecret, updateSubs) => {
  let info = getAccountCookie(req, res, appSecret, null, true);
  if (!info) return res.writeHead(400).end(JSON.stringify({ reason: 'failed to verify cookie signature' }));
  const [_did, session, _isAdmin] = info;
  try {
    db.deleteSub(session);
  } catch (e) {
    console.warn('failed to remove sub', e);
    return res
      .setHeader('Content-Type', 'application/json')
      .writeHead(500)
      .end(JSON.stringify({ reason: 'failed to register subscription' }));
  }
  updateSubs(db);
  clearAccountCookie(res);
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(201);
  res.end(JSON.stringify({ sup: 'bye' }));
}

const handleTopSecret = async (db, req, res, appSecret) => {
  let info = getAccountCookie(req, res, appSecret, null, true);
  if (!info) return res.writeHead(400).end(JSON.stringify({ reason: 'failed to verify cookie signature' }));
  const [did, _session, _isAdmin] = info;
  const body = await getRequesBody(req);
  const { secret_password } = JSON.parse(body);
  console.log({ secret_password });
  const role = 'early';
  db.setRole(did, role, secret_password);
  res.setHeader('Content-Type', 'application/json')
    .writeHead(200)
    .end('"heyyy"');
}

const attempt = listener => async (req, res) => {
  console.log(`-> ${req.method} ${req.url}`);
  try {
    return await listener(req, res);
  } catch (e) {
    console.error('listener errored:', e);
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
      return res.writeHead(204).end();
    }
    return listener(req, res);
  }
}

export const server = (secrets, jwks, allowedOrigin, whoamiHost, db, updateSubs, adminDid) => {
  const handler = (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      return handleIndex(req, res, { PUBKEY: secrets.pushKeys.publicKey });
    }
    if (req.method === 'GET' && req.url === '/hello') {
      return handleHello(db, req, res, secrets, whoamiHost, adminDid);
    }
    if (req.method === 'POST' && req.url === '/verify') {
      return handleVerify(db, req, res, secrets, whoamiHost, adminDid, jwks);
    }
    if (req.method === 'POST' && req.url === '/subscribe') {
      return handleSubscribe(db, req, res, secrets.appSecret, updateSubs, adminDid);
    }
    if (req.method === 'POST' && req.url === '/logout') {
      return handleLogout(db, req, res, secrets.appSecret, updateSubs);
    }
    if (req.method === 'POST' && req.url === '/super-top-secret-access') {
      return handleTopSecret(db, req, res, secrets.appSecret);
    }

    res.writeHead(404).end('not found (sorry)');
  };

  return http.createServer(attempt(withCors(allowedOrigin, handler)));
}
