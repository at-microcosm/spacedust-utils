import { useEffect, useState } from 'react';

export function WithServiceWorker({ children }) {
  const [swRegistration, setSwRegistration] = useState(null);
  useEffect(() => {
    (async() => {
      setSwRegistration('pending');
      try {
        await navigator.serviceWorker.register('/service-worker.js');
        setSwRegistration('registered');
      } catch (e) {
        console.error('service worker registration failed:', e);
        setSwRegistration('failed');
      }
    })();
  }, []);

  if (swRegistration === 'registered') return children;

  if (swRegistration === 'failed') {
    return (
      <p>sorry, something went wrong registering the service worker</p>
    );
  }

  return (
    <p>registering service worker&hellip;</p>
  );
}
