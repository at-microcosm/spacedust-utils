import { useEffect, useState } from 'react';
import { getNotifications, getSecondary } from '../db';
import { ButtonGroup } from './Buttons';
import psl from 'psl';
import lexicons from 'lexicons';

import './feed.css';

function SecondaryFilter({ inc, secondary, current, onUpdate }) {
  const [secondaries, setSecondaries] = useState([]);

  useEffect(() => {
    (async () => {
      const secondaries = await getSecondary(secondary);
      secondaries.sort((a, b) => b.unread - a.unread);
      setSecondaries(secondaries);
      // onUpdate(secondaries[0]?.k); // TODO
    })();
  }, [inc, secondary]);

  // reset secondary filter only when leaving due to secondary change
  useEffect(() => () => onUpdate(null), [secondary]);

  return (
    <ButtonGroup
      options={secondaries.map(({ k, unread, total }) => {

        // blehhhhhhhhhhhh

        let title = k;
        let icon;
        let app;
        let appName;
        if (secondary === 'source') {
          // TODO: clean up / move this to lexicons package?
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
          icon = lex?.clients[0]?.icon;
          appName = lex?.name;
          title = lex?.known_sources[k.slice(app.length + 1)] ?? k;

        } else if (secondary === 'group') {

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
          icon = lex?.clients[0]?.icon;
          appName = lex?.name;

        } else if (secondary === 'app') {
          const appReversed = k.split('.').toReversed().join('.');
          const lex = lexicons[appReversed];
          icon = lex?.clients[0]?.icon;
          title = appName = lex?.name;
        }

        return {
          val: k,
          label: (
            <>
              {icon && (
                <img className="app-icon" src={icon} title={appName ?? app} alt="" />
              )}
              {title} ({total})
            </>
          ),
        };
      })}
      current={current}
      onChange={onUpdate}
    />
  );
}

export function Feed() {
  const [secondary, setSecondary] = useState('all');
  const [secondaryFilter, setSecondaryFilter] = useState(null);

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
    (async () => setFeed(await getNotifications(secondary, secondaryFilter)))();
  }, [inc, secondary, secondaryFilter]);

  if (feed.length === 0) {
    return 'no notifications loaded';
  }
  return (
    <div className="feed">
      <div className="feed-filter-type">
        <h4>Filter by:</h4>
        <ButtonGroup
          options={[
            {val: 'all', label: 'All'},
            {val: 'app', label: 'App'},
            {val: 'group', label: 'Lexicon group'},
            {val: 'source', label: 'Every source'},
          ]}
          current={secondary}
          onChange={setSecondary}
        />
      </div>
      {secondary !== 'all' && (
        <div className="feed-filter-secondary">
          <h4>Filter:</h4>
          <SecondaryFilter
            inc={inc}
            secondary={secondary}
            current={secondaryFilter}
            onUpdate={setSecondaryFilter}
          />
        </div>
      )}
      {feed.map(([k, n]) => (
        <p key={k}>{k}: {n.source} ({n.source_record}) <code>{JSON.stringify(n)}</code></p>
      ))}
    </div>
  );
}
