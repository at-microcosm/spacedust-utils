import { useEffect, useState } from 'react';
import Popup from 'reactjs-popup';
import { getNotifications, getSecondary } from '../db';
import { ButtonGroup } from '../components/Buttons';
import { NotificationSettings } from '../components/NotificationSettings';
import { Notification } from '../components/Notification';
import { GetJson } from '../components/Fetch';
import psl from 'psl';
import lexicons from 'lexicons';

import './feed.css';

function FilterPref({ secondary, value }) {
  return (
    <Popup
      trigger={
        <div className="filter-pref-trigger">
          ⚙
        </div>
      }
      position={['bottom center']}
      closeOnDocumentClick
    >
      <div className="filter-pref-popup">
        <h4>filter notifications</h4>
        <ButtonGroup
          options={[
            { val: 'notify', label: 'notify' },
            { val: 'mute' },
          ]}
          current={null}
        />
        {/*<button className="subtle">reset</button>*/}
      </div>
    </Popup>
  );
}

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
              {title}
              <small style={{
                display: 'inline-block',
                fontSize: '0.6rem',
                padding: '0 0.2rem',
                color: '#f90',
                fontFamily: 'monospace',
                verticalAlign: 'top',
              }}>
                {total >= 30 ? '30+' : total}
              </small>
              <FilterPref secondary={secondary} value={k} />
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
          <SecondaryFilter
            inc={inc}
            secondary={secondary}
            current={secondaryFilter}
            onUpdate={setSecondaryFilter}
          />
        </div>
      )}

      <NotificationSettings
        secondary={secondary}
        secondaryFilter={secondaryFilter}
      />

      <div className="feed-notifications">
        {feed.map(([k, n]) => (
          <Notification key={k} {...n} />
        ))}
      </div>
    </div>
  );
}
