import psl from 'psl';
import { resolveDid } from './atproto/resolve';
import { insertNotification } from './db';

self.addEventListener('push', handlePush);
self.addEventListener('notificationclick', handleNotificationClick);

async function handlePush(ev) {
  const { subject, source, source_record } = ev.data.json();

  let icon;
  if (source.startsWith('app.bsky')) icon = '/icons/app.bsky.png';

  let title = {
    'app.bsky.graph.follow:subject': 'New follow',
    'app.bsky.feed.like:subject.uri': 'New like 💜',
  }[source] ?? source;

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

  // const tag = 'simple-push-demo-notification-tag';
  // TODO: resubscribe to notifs to try to stay alive

  let group;
  let app;
  try {
    const [nsid, ...rp] = source.split(':');
    const parts = nsid.split('.');
    group = parts.slice(0, parts.length - 1).join('.') ?? 'unknown';
    const unreversed = parts.toReversed().join('.');
    app = psl.parse(unreversed)?.domain ?? 'unknown';
  } catch (e) {
    console.error('getting top app failed', e);
  }

  try {
    await insertNotification({
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

  const notification = self.registration.showNotification(title, {
    icon,
    body: `from @${handle}`,
  });

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
