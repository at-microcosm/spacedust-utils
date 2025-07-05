import { useCallback, useState } from 'react';
import { useLocalStorage } from "@uidotdev/usehooks";
import { HostContext } from './context'
import { WhoAmI } from './components/WhoAmI';
import { urlBase64ToUint8Array } from './utils';
import './App.css'

const Problem = ({ children }) => (
  <div className="problem">
    <p>Sorry, {children}</p>
  </div>
);

function requestPermission(host, setAsking) {
  return async () => {
    setAsking(true);
    let err;
    try {
      await Notification.requestPermission();
      const sub = await subscribeToPush();
      const res = await fetch(`${host}/subscribe`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sub }),
        credentials: 'include',
      });
      if (!res.ok) throw res;
    } catch (e) {
      err = e;
    }
    setAsking(false);
    if (err) throw err;
  }
}

async function subscribeToPush() {
  const registration = await navigator.serviceWorker.register('/service-worker.js');
  const subscribeOptions = {
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_PUSH_PUBKEY),
  };
  const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
  console.log({ pushSubscription });
  return pushSubscription;
}

async function verifyUser(host, token) {
  let res = await fetch(`${host}/verify`, {
    method: 'POST',
    headers: {'Content-Type': 'applicaiton/json'},
    body: JSON.stringify({ token }),
    credentials: 'include',
  });
  if (!res.ok) throw res;
}

function App() {
  const [host, setHost] = useLocalStorage('spacedust-notif-host', 'http://localhost:8000');
  const [user, setUser] = useLocalStorage('spacedust-notif-user', null);
  const [verif, setVerif] = useState(null);
  const [asking, setAsking] = useState(false);

  const onIdentify = useCallback(async details => {
    setVerif('verifying');
    try {
      await verifyUser(host, details.token)
      setVerif('verified');
      setUser(details);
    } catch (e) {
      console.error(e);
      setVerif('failed');
    }
    // setTimeout(() => {
    //   setVerif('verified');
    //   setUser(details);
    // }, 400);
  }, [host]);

  let hasSW = 'serviceWorker' in navigator;
  let hasPush = 'PushManager' in window;
  let notifPerm = Notification?.permission ?? 'default';

  let content;
  if (!hasSW) {
    content = <Problem>your browser does not support the background task needd to deliver notifications</Problem>;
  } else if (!hasPush) {
    content = <Problem>your browser does not support registering push notifications.</Problem>
  } else if (!user) {
    if (verif === 'verifying') content = <p><em>verifying&hellip;</em></p>;
    else {
      content = <WhoAmI onIdentify={onIdentify} />;
      if (verif === 'failed') {
        content = <><p>Sorry, failed to verify that identity. please let us know!</p>{content}</>;
      }
    }
  } else if (notifPerm !== 'granted') {
    content = (
      <>
        <h3>Step 2: Notification permission</h3>
        <p>To show atproto notifications we need permission:</p>
        <p>
          <button
            onClick={requestPermission(host, setAsking)}
            disabled={asking}
          >
            {asking ? <>Requesting&hellip;</> : <>Request permission</>}
          </button>
        </p>
        {notifPerm === 'denied' ? (
          <p><em>Notification permission was denied. You may need to clear the browser setting to try again.</em></p>
        ) : (
          <p><em>You can revoke this any time</em></p>
        )}
      </>
    );
  } else {
    content = (
      <>
        <p>
          @{user.handle}
          <button onClick={() => setUser(null)}>&times;</button>
        </p>
      </>
    );
  }

  return (
    <HostContext.Provider value={host}>
      <h1>🎇 atproto notifications demo</h1>

      <p>Get browser push notifications from any app</p>

      {content}
    </HostContext.Provider>
  )
}

export default App


      // {user === null ? (
        
      // ) : (
      //   <>
      //     <p>hi {user.handle}</p>
      //     <button onClick={() => setUser(null)}>clear</button>
      //   </>
      // )}
