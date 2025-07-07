import { useEffect, useState } from 'react';
import { getNotifications } from '../db';

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
    (async () => setFeed((await getNotifications())))();
  }, [inc]);

  if (feed.length === 0) {
    return 'no notifications loaded';
  }
  return feed.map(([k, n]) => (
    <p key={k}>{k}: {n.source} ({n.source_record}) <code>{JSON.stringify(n)}</code></p>
  ));

}
