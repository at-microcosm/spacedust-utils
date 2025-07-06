import { useEffect, useState } from 'react';

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

const getNotifs = async (limit = 30) => {
  let res = [];
  const oc = (await getDB())
    .transaction(['notifs'])
    .objectStore('notifs')
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
};

export function Feed() {

  // for now, we just increment a counter when a new notif comes in, which forces a re-render
  const [inc, setInc] = useState(0);
  useEffect(() => {
    const handleMessage = () => setInc(n => n + 1);
    const chan = new BroadcastChannel('notif');
    chan.addEventListener('message', handleMessage);
    return () => chan.removeEventListener('message', handleMessage);
  });

  // semi-gross way to just pull out all the events so we can see them
  // this could be combined with the broadcast thing above, but for now just chain deps
  const [feed, setFeed] = useState([]);
  useEffect(() => {
    (async () => setFeed((await getNotifs())))();
  }, [inc]);

  if (feed.length === 0) {
    return 'no notifications loaded';
  }
  return feed.map(([k, n]) => (
    <p key={k}>{k}: {n.source} ({n.source_record}) <code>{JSON.stringify(n)}</code></p>
  ));

}
