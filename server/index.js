#!/usr/bin/env node
"use strict";

import fs from 'node:fs';
import http from 'http';
import * as jose from 'jose';
import cookie from 'cookie';
import cookieSig from 'cookie-signature';
import webpush from 'web-push';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { DB } from './db.js';

// kind of silly but right now there's no way to tell spacedust that we want an alive connection
// but don't want the notification firehose (everything filtered out)
// so... the final filter is an absolute on this fake did, effectively filtering all notifs.
// (this is only used when there are no subscribers registered)
const DUMMY_DID = 'did:plc:zzzzzzzzzzzzzzzzzzzzzzzz';

const CORS_PERMISSIVE = req => ({
  'Access-Control-Allow-Origin': req.headers.origin, // DANGERRRRR
  'Access-Control-Allow-Methods': 'OPTIONS, GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true', // TODO: *def* want to restrict allowed origin, probably
});

let spacedust;
let spacedustEverStarted = false;


const updateSubs = db => {
  if (!spacedust) {
    console.warn('not updating subscription, no spacedust (reconnecting?)');
    return;
  }
  const wantedSubjectDids = db.getSubscribedDids();
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

async function push(db, pushSubscription, payload) {
  const { session, subscription, since_last_push } = pushSubscription;
  if (since_last_push !== null && since_last_push < 1.618) {
    console.warn(`rate limiter: dropping too-soon push (${since_last_push})`);
    return;
  }

  let sub;
  try {
    sub = JSON.parse(subscription);
  } catch (e) {
    console.error('failed to parse subscription json, dropping session', e);
    db.deleteSub(session);
    return;
  }

  try {
    await webpush.sendNotification(sub, payload);
  } catch (err) {
    if (400 <= err.statusCode && err.statusCode < 500) {
      console.info(`removing sub for ${err.statusCode}`);
      db.deleteSub(session);
      return;
    } else {
      console.warn('something went wrong for another reason', err);
    }
  }

  db.updateLastPush(session);
}

const handleDust = db => async event => {
  console.log('got', event.data);
  let data;
  try {
    data = JSON.parse(event.data);
  } catch (err) {
    console.error(err);
    return;
  }
  const { link: { subject, source, source_record } } = data;
  const timestamp = +new Date();

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

  const subs = db.getSubsByDid(did);
  const payload = JSON.stringify({ subject, source, source_record, timestamp });
  await Promise.all(subs.map(pushSubscription => push(db, pushSubscription, payload)));
};

const connectSpacedust = (db, host) => {
  spacedust = new WebSocket(`${host}/subscribe?instant=true&wantedSubjectDids=${DUMMY_DID}`);
  let restarting = false;

  const restart = () => {
    if (restarting) return;
    restarting = true;
    let wait = Math.round(500 + (Math.random() * 1000));
    console.info(`restarting spacedust connection in ${wait}ms...`);
    setTimeout(() => connectSpacedust(db, host), wait);
    spacedust = null;
  }

  spacedust.onopen = () => updateSubs(db);
  spacedust.onmessage = handleDust(db);

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
const getAccountCookie = (req, res, appSecret) => {
  const cookies = cookie.parse(req.headers.cookie ?? '');
  const untrusted = cookies['verified-account'] ?? '';
  const json = cookieSig.unsign(untrusted, appSecret);
  if (!json) {
    clearAccountCookie(res);
    return null;
  }
  try {
    const [did, session] = JSON.parse(json);
    return [did, session];
  } catch (e) {
    console.warn('validated account cookie but failed to parse json', e);
    clearAccountCookie(res);
    return null;
  }
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

const handleVerify = async (db, req, res, jwks, appSecret) => {
  const body = await getRequesBody(req);
  const { token } = JSON.parse(body);
  let did;
  try {
    const verified = await jose.jwtVerify(token, jwks);
    did = verified.payload.sub;
  } catch (e) {
    return clearAccountCookie(res).writeHead(400).end(JSON.stringify({ reason: 'verification failed' }));
  }
  db.addAccount(did);
  const session = uuidv4();
  setAccountCookie(res, did, session, appSecret);
  return res.writeHead(200).end('okayyyy');
};

const handleSubscribe = async (db, req, res, appSecret) => {
  let info = getAccountCookie(req, res, appSecret);
  if (!info) return res.writeHead(400).end(JSON.stringify({ reason: 'failed to verify cookie signature' }));
  const [did, session] = info;

  const body = await getRequesBody(req);
  const { sub } = JSON.parse(body);
  // addSub('did:plc:z72i7hdynmk6r22z27h6tvur', sub); // DELETEME @bsky.app (DEBUG)
  db.addPushSub(did, session, JSON.stringify(sub));
  updateSubs(db);
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(201);
  res.end('{"oh": "hi"}');
};

const requestListener = (pubkey, jwks, appSecret, db) => (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return handleIndex(req, res, { PUBKEY: pubkey });
  }
  if (req.method === 'GET' && req.url === '/service-worker.js') {
    return handleServiceWorker(req, res, { PUBKEY: pubkey });
  }

  if (req.method === 'OPTIONS' && req.url === '/verify') {
    // TODO: probably restrict the origin
    return res.writeHead(204, CORS_PERMISSIVE(req)).end();
  }
  if (req.method === 'POST' && req.url === '/verify') {
    res.setHeaders(new Headers(CORS_PERMISSIVE(req)));
    return handleVerify(db, req, res, jwks, appSecret);
  }

  if (req.method === 'OPTIONS' && req.url === '/subscribe') {
    // TODO: probably restrict the origin
    return res.writeHead(204, CORS_PERMISSIVE(req)).end();
  }
  if (req.method === 'POST' && req.url === '/subscribe') {
    res.setHeaders(new Headers(CORS_PERMISSIVE(req)));
    return handleSubscribe(db, req, res, appSecret);
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
  const appSecret = env.APP_SECRET;

  const whoamiHost = env.WHOAMI_HOST ?? 'https://who-am-i.microcosm.blue';
  const jwks = jose.createRemoteJWKSet(new URL(`${whoamiHost}/.well-known/jwks.json`));

  const dbFilename = env.DB_FILE ?? './db.sqlite3';
  const initDb = process.argv.includes('--init-db');
  console.log(`connecting sqlite db file: ${dbFilename} (initializing: ${initDb})`);
  const db = new DB(dbFilename, initDb);

  const spacedustHost = env.SPACEDUST_HOST ?? 'wss://spacedust.microcosm.blue';
  connectSpacedust(db, spacedustHost);

  const host = env.HOST ?? 'localhost';
  const port = parseInt(env.PORT ?? 8000, 10);

  http
    .createServer(requestListener(keys.publicKey, jwks, appSecret, db))
    .listen(port, host, () => console.log(`listening at http://${host}:${port}`));
};

main(process.env);
