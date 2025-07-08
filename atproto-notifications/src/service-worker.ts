import psl from 'psl';
import lexicons from 'lexicons';
import { resolveDid } from './atproto/resolve';
import { insertNotification } from './db';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('push', handlePush);
self.addEventListener('notificationclick', handleNotificationClick);

async function handlePush(ev) {
  const { subject, source, source_record, timestamp } = ev.data.json();
  let group;
  let app;
  let appPrefix;
  try {
    const [nsid, ...rp] = source.split(':');
    const parts = nsid.split('.');
    group = parts.slice(0, parts.length - 1).join('.') ?? 'unknown';
    const unreversed = parts.toReversed().join('.');
    app = psl.parse(unreversed)?.domain ?? 'unknown';
    appPrefix = app.split('.').toReversed().join('.');
  } catch (e) {
    console.error('getting top app failed', e);
  }

  let handle = 'unknown';
  let source_did;
  if (source_record.startsWith('at://')) {
    source_did = source_record.slice('at://'.length).split('/')[0];
    try {
      handle = await resolveDid(source_did);
    } catch (err) {
      console.error('failed to get handle', err);
    }
  }

  // TODO: user pref for alt client -> prefer that client's icon
  const lex = lexicons[appPrefix];
  const icon = lex?.clients[0]?.icon;
  const title = lex?.known_sources[source.slice(app.length + 1)] ?? source;
  const body = `from @${handle} on ${lex?.name ?? app}`;

  // const tag = 'simple-push-demo-notification-tag';
  // TODO: resubscribe to notifs to try to stay alive

  try {
    await insertNotification({
      timestamp,
      subject,
      source_record,
      source_did,
      source,
      group,
      app,
    });
  } catch (e) {
    console.error('oh no', e);
  }

  new BroadcastChannel('notif').postMessage('heyyy');

  const notification = self.registration.showNotification(title, { icon, body });
  ev.waitUntil(notification);
}

function handleNotificationClick(ev) {
  ev.waitUntil((async () => {
    ev.notification.close();

    const clientList = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    // focus the first available existing window/tab
    for (const client of clientList)
      return await client.focus();

    // otherwise open a new tab
    await clients.openWindow('/');
  })());
}
