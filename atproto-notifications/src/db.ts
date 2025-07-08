const NOTIFICATIONS = 'notifications';

export const SECONDARIES = ['all', 'source', 'group', 'app'];

export const getDB = ((upgrade, v) => {
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

  // primary store for notifications
  try {
    // upgrade is a reset: entirely remove the store (ignore errors if it didn't exist)
    db.deleteObjectStore(NOTIFICATIONS);
  } catch (e) {}
  const notifStore = db.createObjectStore(NOTIFICATIONS, {
    keyPath: 'id',
    autoIncrement: true,
  });
  // subject prob doesn't need an index, could just query constellation
  notifStore.createIndex('subject', 'subject', { unique: false });
  // specific notification (not unique bc spacedust doens't emit deletes yet)
  notifStore.createIndex('source_record', 'source_record', { unique: false });
  // filter by source user of notifications because why not
  notifStore.createIndex('source_did', 'source_did', { unique: false });
  // notifications of an exact type
  notifStore.createIndex('source', 'source', { unique: false });
  // by nsid group
  notifStore.createIndex('group', 'group', { unique: false });
  // by nsid tld+1
  notifStore.createIndex('app', 'app', { unique: false });

  // secondary indexes: notification counts
  for (const secondary of SECONDARIES) {
    try {
      // upgrade is hard reset
      db.deleteObjectStore(secondary);
    } catch (e) {}
    const store = db.createObjectStore(secondary, {
      keyPath: 'k',
    });
    store.createIndex('total', 'total', { unique: false });
    store.createIndex('unread', 'unread', { unique: false });
  }

}, 4);

export async function insertNotification(notif: {
  subject: String,
  source_record: String,
  source_did: String,
  source: String,
  group: String,
  app: String,
}) {
  const db = await getDB();
  const tx = db.transaction([NOTIFICATIONS, ...SECONDARIES], 'readwrite');

  // 1. insert the actual notification
  tx.objectStore(NOTIFICATIONS).put(notif);

  // 2. update all secondary counts
  for (const secondary of SECONDARIES) {
    const store = tx.objectStore(secondary);
    const key = secondary === 'all' ? 'all' : notif[secondary];
    store.get(key).onsuccess = ev => {
      let count = ev.target.result ?? {
        k: key,
        total: 0,
        unread: 0,
      };
      count.total += 1;
      count.unread += 1;
      store.put(count);
    };
  }

  return new Promise((resolve, reject) => {
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = resolve;
  });
}

export async function getNotifications(limit = 30) {
  let res = [];
  const oc = (await getDB())
    .transaction([NOTIFICATIONS])
    .objectStore(NOTIFICATIONS)
    .openCursor(undefined, 'prev');
  return new Promise((resolve, reject) => {
    oc.onerror = () => reject(oc.error);
    oc.onsuccess = ev => {
      const cursor = event.target.result;
      if (cursor) {
        res.push([cursor.key, cursor.value]);
        if (res.length < limit) cursor.continue();
        else resolve(res);
      } else {
        resolve(res);
      }
    }
  });
}

export async function getSecondary(secondary) {
  const db = await getDB();
  const obj = db
    .transaction([secondary])
    .objectStore(secondary)
    .getAll();
  return new Promise((resolve, reject) => {
    obj.onerror = () => reject(obj.error);
    obj.onsuccess = ev => resolve(ev.target.result);
  });
}
