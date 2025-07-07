import { useEffect, useState } from 'react';
import { getNotifications, getSecondary } from '../db';

function Asdf({ inc, secondary }) {
  const [secondaries, setSecondaries] = useState([]);
  useEffect(() => {
    (async () => {
      const secondaries = await getSecondary(secondary);
      secondaries.sort((a, b) => b.unread - a.unread);
      setSecondaries(secondaries);
    })();
  }, [inc, secondary]);

  return (
    <div>
      <p>secondaries: ({secondaries.length})</p>
      {secondaries.map(a => (
        <p key={a.k}>asdf {a.k} ({a.unread}/{a.total})</p>
      ))}
    </div>
  );
}

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
    (async () => setFeed(await getNotifications()))();
  }, [inc]);

  if (feed.length === 0) {
    return 'no notifications loaded';
  }
  return (
    <div className="feed">
      <Asdf inc={inc} secondary='source' />
      {feed.map(([k, n]) => (
        <p key={k}>{k}: {n.source} ({n.source_record}) <code>{JSON.stringify(n)}</code></p>
      ))}
    </div>
  );
}
