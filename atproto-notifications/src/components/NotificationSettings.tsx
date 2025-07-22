import { useState } from 'react';


export function NotificationSettings({ secondary, secondaryFilter }) {


  // const [notifyToggleCounter, setNotifyToggleCounter] = useState(0);

  // // TODO move up (to chrome?) so it syncs
  // const setGlobalNotifications = useCallback(async enabled => {
  //   const host = import.meta.env.VITE_NOTIFICATIONS_HOST;
  //   const url = new URL('/global-notify', host);
  //   try {
  //     await postJson(url, JSON.stringify({ notify_enabled: enabled }), true)
  //   } catch (err) {
  //     console.error('failed to set self-notify setting', err);
  //   }
  //   setNotifyToggleCounter(n => n + 1);
  // });




  if (secondary === 'all') {
    return <p>Notifications default: [todo: toggle mute], unknown sources: [toggle mute]</p>;
  }
  if (secondaryFilter === null) {
    return null;
  }
  return (
    <p>{secondaryFilter} [todo: toggle mute]</p>
  );
}
