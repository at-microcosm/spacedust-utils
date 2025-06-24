#!/usr/bin/env node

const webpush = require('web-push');
const fs = require('node:fs');
const http = require('http');

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

const handleSubscribe = async (req, res) => {
  const body = await getRequesBody(req);
  console.log('got body', body);
  doStuff(JSON.parse(body));
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(201);
  res.end('{"oh": "hi"}');
}

const doStuff = sub => {
  let n = 0;
  setInterval(() => {
    webpush.sendNotification(sub, `oh hi: ${n}`);
    n += 1;
  }, 2000);
}

const requestListener = pubkey => (req, res) => {
  if (req.method === 'GET' && req.url === '/')
    return handleIndex(req, res, { PUBKEY: pubkey });

  if (req.method === 'GET' && req.url === '/service-worker.js')
    return handleServiceWorker(req, res, { PUBKEY: pubkey });

  if (req.method === 'POST' && req.url === '/subscribe')
    return handleSubscribe(req, res);

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

  const host = env.HOST || 'localhost';
  const port = parseInt(env.PORT || 8000, 10);

  http
    .createServer(requestListener(keys.publicKey))
    .listen(port, host, () => console.log(`listening at http://${host}:${port}`));
};

main(process.env);
