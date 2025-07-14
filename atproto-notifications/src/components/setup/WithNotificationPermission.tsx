import { useEffect, useCallback, useState } from 'react';

export function WithNotificationPermission({ children }) {
  let currentPermission = Notification.permission ?? 'default';
  const [asking, setAsking] = useState(false);

  const requestPermission = useCallback(async () => {
    setAsking(true);
    try {
      await Notification.requestPermission();
    } catch (_e) {}; // we'll re-render and look up the permission from Notification
    setAsking(false);
  });

  if (currentPermission !== 'granted') {
    return (
      <>
        <h3>Step 2: Allow notifications</h3>
        <p>To show notifications we need permission:</p>
        <p>
          <button
            onClick={requestPermission}
            disabled={asking}
          >
            {asking ? <>Requesting&hellip;</> : <>Request permission</>}
          </button>
        </p>
        {currentPermission === 'denied'
          ? <p className="detail">Notification permission was denied. You may need to clear the browser setting to try again.</p>
          : <p className="detail">You can revoke this any time</p>}
      </>
    );
  }

  return children;
}
