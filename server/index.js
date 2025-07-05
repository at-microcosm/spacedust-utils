#!/usr/bin/env node
"use strict";

const fs = require('node:fs');
const http = require('http');
const jose = require('jose');
const cookie = require('cookie');
const cookieSig = require('cookie-signature');
const webpush = require('web-push');

const DUMMY_DID = 'did:plc:zzzzzzzzzzzzzzzzzzzzzzzz';

const CORS_PERMISSIVE = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS, GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

let spacedust;
let spacedustEverStarted = false;
const subs = new Map();

const addSub = (did, sub) => {
  if (!subs.has(did)) {
    subs.set(did, []);
  }
  subs.get(did).push(sub);
  updateSubs();
};

const updateSubs = () => {
  if (!spacedust) {
    console.warn('not updating subscription, no spacedust (reconnecting?)');
    return;
  }
  const wantedSubjectDids = Array.from(subs.keys());
  if (wantedSubjectDids.length === 0) {
    wantedSubjectDids.push(DUMMY_DID);
  }
  console.log('updating for wantedSubjectDids', wantedSubjectDids);
  spacedust.send(JSON.stringify({
    type: 'options_update',
    payload: {
      wantedSubjectDids,
    },
  }));
};

const handleDust = async event => {
  console.log('got', event.data);
  let data;
  try {
    data = JSON.parse(event.data);
  } catch (err) {
    console.error(err);
    return;
  }
  const { link: { subject, source, source_record } } = data;

  let did;
  if (subject.startsWith('did:')) did = subject;
  else if (subject.startsWith('at://')) {
    const [id, ..._] = subject.slice('at://'.length).split('/');
    if (id.startsWith('did:')) did = id;
  }
  if (!did) {
    console.warn(`ignoring link with non-DID subject: ${subject}`)
    return;
  }

  const expiredSubs = [];
  for (const sub of subs.get(did) ?? []) {
    const title = `new ${source}`;
    const body = `from ${source_record}`;
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title, body }));
    } catch (err) {
      if (400 <= err.statusCode && err.statusCode < 500) {
        expiredSubs.push(sub);
        console.info(`removing sub for ${err.statusCode}`);
      }
    }
  }
  if (expiredSubs.length > 0) {
    const activeSubs = subs.get(did)?.filter(s => !expiredSubs.includes(s));
    if (!activeSubs) { // concurrently removed already
      return;
    }
    if (activeSubs.length === 0) {
      console.info('removed last subscriber for', did);
      subs.delete(did);
      updateSubs();
    } else {
      subs.set(did, activeSubs);
    }
  }
};

const connectSpacedust = host => {
  spacedust = new WebSocket(`${host}/subscribe?instant=true&wantedSubjectDids=${DUMMY_DID}`);
  let restarting = false;

  const restart = () => {
    if (restarting) return;
    restarting = true;
    let wait = Math.round(500 + (Math.random() * 1000));
    console.info(`restarting spacedust connection in ${wait}ms...`);
    setTimeout(() => connectSpacedust(host), wait);
    spacedust = null;
  }

  spacedust.onopen = updateSubs
  spacedust.onmessage = handleDust;

  spacedust.onerror = e => {
    console.error('spacedust errored:', e);
    restart();
  };

  spacedust.onclose = () => {
    console.log('spacedust closed');
    restart();
  };
}

const getOrCreateKeys = filename => {
  let keys;
  try {
    const data = fs.readFileSync(filename);
    keys = JSON.parse(data);
  } catch (err) {
    if (err.code != 'ENOENT') throw err;
    keys = webpush.generateVAPIDKeys();
    const data = JSON.stringify(keys);
    fs.writeFileSync(filename, data);
  }
  console.log(`Keys ready with pubkey: ${keys.publicKey}`);
  return keys;
}

const getRequesBody = async req => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => resolve(body));
  req.on('error', err => reject(err));
});

const handleFile = (fname, ftype) => async (req, res, replace = {}) => {
  let content
  try {
    content = await fs.promises.readFile(__dirname + '/web-content/' + fname);
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

const handleVerify = async (req, res, jwks, app_secret) => {
  const body = await getRequesBody(req);
  const { token } = JSON.parse(body);
  let did;
  try {
    const verified = await jose.jwtVerify(token, jwks);
    did = verified.payload.sub;
  } catch (e) {
    res.setHeader('Set-Cookie', cookie.serialize('verified-did', '', { expires: new Date(0) }));
    return res.writeHead(400).end(JSON.stringify({ reason: 'verification failed' }));
  }
  const signed = cookieSig.sign(did, app_secret);
  res.setHeader('Set-Cookie', cookie.serialize('verified-did', signed, {
    httpOnly: true,
    secure: true,
    maxAge: 90 * 86_400,
  }))
  return res.writeHead(200).end('okayyyy');
};

const handleSubscribe = async (req, res) => {
  const body = await getRequesBody(req);
  const { did, sub } = JSON.parse(body);
  addSub(did, sub);
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(201);
  res.end('{"oh": "hi"}');
};

const requestListener = (pubkey, jwks, app_secret) => (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return handleIndex(req, res, { PUBKEY: pubkey });
  }
  if (req.method === 'GET' && req.url === '/service-worker.js') {
    return handleServiceWorker(req, res, { PUBKEY: pubkey });
  }

  if (req.method === 'OPTIONS' && req.url === '/verify') {
    // TODO: probably restrict the origin
    return res.writeHead(204, CORS_PERMISSIVE).end();
  }
  if (req.method === 'POST' && req.url === '/verify') {
    res.setHeaders(new Headers(CORS_PERMISSIVE));
    return handleVerify(req, res, jwks, app_secret);
  }

  if (req.method === 'POST' && req.url === '/subscribe') {
    return handleSubscribe(req, res);
  }

  res.writeHead(200);
  res.end('sup');
}

const main = env => {
  if (!env.KEY_FILE) throw new Error('KEY_FILE is required to run');
  const keys = getOrCreateKeys(env.KEY_FILE);
  webpush.setVapidDetails(
    'mailto:phil@bad-example.com',
    keys.publicKey,
    keys.privateKey,
  );

  if (!env.APP_SECRET) throw new Error('APP_SECRET is required to run');
  const app_secret = env.APP_SECRET;

  const whoamiHost = env.WHOAMI_HOST ?? 'https://who-am-i.microcosm.blue';
  const jwks = jose.createRemoteJWKSet(new URL(`${whoamiHost}/.well-known/jwks.json`));

  const spacedustHost = env.SPACEDUST_HOST ?? 'wss://spacedust.microcosm.blue';
  connectSpacedust(spacedustHost);

  const host = env.HOST ?? 'localhost';
  const port = parseInt(env.PORT ?? 8000, 10);

  http
    .createServer(requestListener(keys.publicKey, jwks, app_secret))
    .listen(port, host, () => console.log(`listening at http://${host}:${port}`));
};

main(process.env);
