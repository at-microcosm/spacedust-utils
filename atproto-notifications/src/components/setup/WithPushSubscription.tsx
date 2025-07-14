import { useContext, useEffect, useState } from 'react';
import { PushServerContext } from '../../context';
import { urlBase64ToUint8Array } from '../../utils';

async function subscribePushServer(sub) {
  const host = import.meta.env.VITE_NOTIFICATIONS_HOST;
  const res = await fetch(`${host}/subscribe`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ sub }),
    credentials: 'include',
  });
  if (!res.ok) {
    const msg = await res.text();
    console.error('failed to sub', msg);
    throw new Error('failed to subscribe server');
  }
}

export function WithPushSubscription({ children }) {
  const pushServerPubkey = useContext(PushServerContext);
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    let cancelled = false;
    let updateSubscription;
    (async () => {
      try {
        // idk how to do a cancellable async fn, so we just check after each step
        // if we should be cancelling, in case this keeps running after unmount

        const registration = await navigator.serviceWorker.getRegistration();
        // try to update the sw in case a user keeps a tab open for a long time
        updateSubscription = setInterval(() => registration.update(), 4 * 60 * 60 * 1000); // every 4h
        if (cancelled) return;

        // check for an existing subscription
        let subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;

        // create a new sub if none exist
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(pushServerPubkey),
          });
          if (cancelled) return;
        }

        // finally, send the deets to our push server backend
        await subscribePushServer(subscription);

      } catch (e) {
        console.error('failed to subscribe', e);
        setStatus('failed');
        return;
      }

      // finally finally
      setStatus('subscribed');
    })();
    return () => {
      cancelled = true;
      clearInterval(updateSubscription);
    };
  }, [pushServerPubkey]);

  if (status === 'pending') {
    return <p>Setting up push notifications&hellip;</p>
  }

  if (status === 'failed') {
    return <p>Sorry, something went wrong setting up push notifications</p>;
  }

  return children
}
