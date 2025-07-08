import { useEffect, useState } from 'react';
import { getNotifications, getSecondary } from '../db';
import { ButtonGroup } from './Buttons';
import psl from 'psl';
import lexicons from 'lexicons';

function Asdf({ inc, secondary }) {
  const [secondaries, setSecondaries] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      const secondaries = await getSecondary(secondary);
      secondaries.sort((a, b) => b.unread - a.unread);
      setSecondaries(secondaries);
      // setSelected(secondaries[0]?.k); // TODO
    })();
  }, [inc, secondary]);

  return (
    <div>
      <ButtonGroup
        options={secondaries.map(({ k, unread, total }) => {


          let title = k;
          if (secondary === 'source') {
            // TODO: clean up / move this to lexicons package?
            let app;
            let appPrefix;
            try {
              const [nsid, ...rp] = k.split(':');
              const parts = nsid.split('.');
              const unreversed = parts.toReversed().join('.');
              app = psl.parse(unreversed)?.domain ?? 'unknown';
              appPrefix = app.split('.').toReversed().join('.');
            } catch (e) {
              console.error('getting top app failed', e);
            }
            const lex = lexicons[appPrefix];
            const icon = lex?.clients[0]?.icon;
            title = lex?.known_sources[k.slice(app.length + 1)] ?? k;
          }

          return { val: k, label: `${title} (${total})` };
        })}
        current={selected}
        onChange={setSelected}
        subtle
      />


    </div>
  );
}

export function Feed() {
  const [secondary, setSecondary] = useState('all');

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
      <ButtonGroup
        options={[
          {val: 'all', label: 'All'},
          {val: 'app', label: 'App'},
          {val: 'group', label: 'Lexicon group'},
          {val: 'source', label: 'Every source'},
        ]}
        current={secondary}
        onChange={setSecondary}
        subtle
      />
      <Asdf inc={inc} secondary={secondary} />
      {feed.map(([k, n]) => (
        <p key={k}>{k}: {n.source} ({n.source_record}) <code>{JSON.stringify(n)}</code></p>
      ))}
    </div>
  );
}
