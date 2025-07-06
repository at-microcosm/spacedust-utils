self.addEventListener('push', handlePush);
self.addEventListener('notificationclick', handleNotificationClick);

const getDB = ((upgrade, v) => {
  let instance;
  return () => {
    if (instance) return instance;
    const req = indexedDB.open('atproto-notifs', v);
    instance = new Promise((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => upgrade(req.result);
      req.onsuccess = () => resolve(req.result);
    });
    return instance;
  };
})(function dbUpgrade(db) {
  try {
    db.deleteObjectStore('notifs');
  } catch (e) {}
  db.createObjectStore('notifs', {
    key: 'id',
    autoIncrement: true,
  });
}, 2);

const push = async notif => {
  const tx = (await getDB()).transaction('notifs', 'readwrite');
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.objectStore('notifs').put(notif);
  });
};

async function handlePush(ev) {
  const { subject, source, source_record } = ev.data.json();

  let icon;
  if (source.startsWith('app.bsky')) icon = '/icons/app.bsky.png';

  let title = {
    'app.bsky.graph.follow:subject': 'New follow',
    'app.bsky.feed.like:subject.uri': 'New like 💜',
  }[source] ?? source;

  // const tag = 'simple-push-demo-notification-tag';
  // TODO: resubscribe to notifs to try to stay alive

  let db;
  try {
    db = await getDB();
  } catch (e) {
    console.error('oh no', e);
    throw e;
  }
  db.onerror = e => {
    console.error('db errored', e);
  };

  try {
    await push({ subject, source, source_record });
  } catch (e) {
    console.error('uh oh', e);
  }

  new BroadcastChannel('notif').postMessage('heyyy');

  const notification = self.registration.showNotification(title, {
    icon,
    body: source_record,
    // actions: [
    //   {'action': 'bsky', title: 'Bluesky'},
    //   {'action': 'spacedust', title: 'All notifications'},
    // ],
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
