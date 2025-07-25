#!/usr/bin/env node

import { createRemoteJWKSet } from 'jose';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import https from 'node:https';
import webpush from 'web-push';
import { DB } from './db.js';
import { connectSpacedust } from './notifications.js';
import { server } from './api.js';

const getOrCreateSecrets = filename => {
  let secrets;
  try {
    const serialized = fs.readFileSync(filename);
    secrets = JSON.parse(serialized);
  } catch (err) {
    if (err.code != 'ENOENT') throw err;
    secrets = {
      pushKeys: webpush.generateVAPIDKeys(),
      appSecret: randomBytes(32).toString('hex'),
    };
    const serialized = JSON.stringify(secrets);
    fs.writeFileSync(filename, serialized);
  }
  console.log(`Keys ready with webpush pubkey: ${secrets.pushKeys.publicKey}`);
  return secrets;
}

function startHealthcheckPing(endpoint) {
  const next = () => setTimeout(() => startHealthcheckPing(endpoint), 90 * 1000);

  https
    .get(endpoint, res => {
      if (res.statusCode !== 200) console.warn('non-200 health check response', res.statusCode);
      res
        .on('data', () => {})
        .on('end', next);
    })
    .on('error', err => {
      console.warn('healthcheck request errored', err);
      next();
    });
}

const main = env => {
  if (!env.ADMIN_DID) throw new Error('ADMIN_DID is required to run');
  const adminDid = env.ADMIN_DID;

  if (!env.SECRETS_FILE) throw new Error('SECRETS_FILE is required to run');
  const secrets = getOrCreateSecrets(env.SECRETS_FILE);
  webpush.setVapidDetails(
    'mailto:phil@bad-example.com',
    secrets.pushKeys.publicKey,
    secrets.pushKeys.privateKey,
  );

  const whoamiHost = env.WHOAMI_HOST ?? 'https://who-am-i.microcosm.blue';
  const jwks = createRemoteJWKSet(new URL(`${whoamiHost}/.well-known/jwks.json`));

  const dbFilename = env.DB_FILE ?? './db.sqlite3';
  const initDb = process.argv.includes('--init-db');
  console.log(`connecting sqlite db file: ${dbFilename} (initializing: ${initDb})`);
  const db = new DB(dbFilename, initDb);

  const spacedustHost = env.SPACEDUST_HOST ?? 'wss://spacedust.microcosm.blue';
  const { updateSubs, push } = connectSpacedust(db, spacedustHost);

  const host = env.HOST ?? 'localhost';
  const port = parseInt(env.PORT ?? 8000, 10);

  const allowedOrigin = env.ALLOWED_ORIGIN ?? 'http://127.0.0.1:5173';

  if (env.HEALTHCHECK) startHealthcheckPing(env.HEALTHCHECK);
  else console.warn('no HEALTHCHECK in env, not sending healthcheck pings');

  server(secrets, jwks, allowedOrigin, whoamiHost, db, updateSubs, push, adminDid).listen(
    port,
    host,
    () => console.log(`listening at http://${host}:${port} with allowed origin: ${allowedOrigin}`),
  );
};

main(process.env);
