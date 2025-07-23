import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { GetJson, postJson } from './Fetch';
import { ButtonGroup } from './Buttons';

export function NotificationSettings({ secondary, secondaryFilter }) {
  const [notifyToggleCounter, setNotifyToggleCounter] = useState(0);

  // TODO move up (to chrome?) so it syncs
  const setGlobalNotifications = useCallback(async enabled => {
    const host = import.meta.env.VITE_NOTIFICATIONS_HOST;
    const url = new URL('/global-notify', host);
    try {
      await postJson(url, JSON.stringify({ notify_enabled: enabled }), true)
    } catch (err) {
      console.error('failed to set self-notify setting', err);
    }
    setNotifyToggleCounter(n => n + 1);
  });

  if (secondary !== 'all') return;

  return (
    <div className="feed-filter-type">
      <h4>All notifications:</h4>
      <GetJson
        key={notifyToggleCounter}
        endpoint="/global-notify"
        credentials
        ok={({ notify_enabled }) => (
          <ButtonGroup
            options={[
              {val: 'paused', label: <>⏸&nbsp;&nbsp;pause{!notify_enabled && 'd'}</>},
              {val: 'active', label: <>▶&nbsp;&nbsp;{notify_enabled ? 'notifications active' : 'enable notifications'}</>},
            ]}
            current={notify_enabled ? 'active' : 'paused'}
            onChange={val => setGlobalNotifications(val === 'active')}
          />
        )}
      />
    </div>
  );
}
