import { useCallback, useState, useEffect } from 'react';
import { useLocalStorage } from "@uidotdev/usehooks";
import { GetJson } from './components/fetch';
import { WhoAmI } from './components/WhoAmI';
import { Feed } from './components/Feed';
import { urlBase64ToUint8Array } from './utils';
import './App.css'

import lexicons from 'lexicons';

const Problem = ({ children }) => (
  <div className="problem">
    <p>Sorry, {children}</p>
  </div>
);

function requestPermission(pushServerHost, pushServerPubkey, setAsking, setPermissionError) {
  return async () => {
    setAsking(true);
    let err;
    try {
      await Notification.requestPermission();
      const sub = await subscribeToPush(pushServerPubkey);
      const res = await fetch(`${pushServerHost}/subscribe`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sub }),
        credentials: 'include',
      });
      if (!res.ok) {
        let content;
        try {
          content = (await res.json()).reason;
        } catch (_) {
          content = await res.text();
        }
        throw content;
      }
    } catch (e) {
      setPermissionError(e);
      err = e;
    }
    setAsking(false);
    if (err) throw err;
  }
}

let autoreg;
async function subscribeToPush(pushServerPubkey) {
  const registration = await navigator.serviceWorker.register('/service-worker.js');

  // auto-update the service worker in case they keep it open in a tab for a long time
  clearInterval(autoreg);
  autoreg = setInterval(() => registration.update(), 4 * 60 * 60 * 1000); // every 4h

  return await registration.pushManager.subscribe({
    pushServerPubkey: urlBase64ToUint8Array(pushServerPubkey),
    userVisibleOnly: true,
  });
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
  const host = import.meta.env.VITE_NOTIFICATIONS_HOST;
  const [pushPubkey, setPushPubkey] = useState(null);
  const [whoamiHost, setWhoamiHost] = useState(null);

  const [role, setRole] = useLocalStorage('spacedust-notif-role', 'anonymous');
  const [user, setUser] = useLocalStorage('spacedust-notif-user', null);
  const [verif, setVerif] = useState(null);
  const [asking, setAsking] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

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

  function Blah({ info }) {
    useEffect(() => {
      setPushPubkey(info.webPushPublicKey);
      setWhoamiHost(info.whoamiHost);
      setRole(info.role);
      if (info.role === 'anonymous') {
        setUser(null);
      }
    });
    return <>Got server hello, updating app state&hellip;</>;
  }

  let content;
  if (!hasSW) {
    content = <Problem>your browser does not support the background task needd to deliver notifications</Problem>;
  } else if (!hasPush) {
    content = <Problem>your browser does not support registering push notifications.</Problem>
  } else if (!whoamiHost) {
    content = <GetJson endpoint='/hello' ok={info => <Blah info={info} />} />
  } else if (!user) {
    if (verif === 'verifying') content = <p><em>verifying&hellip;</em></p>;
    else {
      content = <WhoAmI onIdentify={onIdentify} origin={whoamiHost} />;
      if (verif === 'failed') {
        content = <><p>Sorry, failed to verify that identity. please let us know!</p>{content}</>;
      }
    }
  } else if (permissionError !== null || notifPerm !== 'granted' || role === 'anonymous') {
    content = (
      <>
        <h3>Step 2: Allow notifications</h3>
        <p>To show notifications we need permission:</p>
        <p>
          <button
            onClick={requestPermission(host, pushPubkey, setAsking, setPermissionError)}
            disabled={asking}
          >
            {asking ? <>Requesting&hellip;</> : <>Request permission</>}
          </button>
        </p>
        {notifPerm === 'denied' ? (
          <p className="detail">Notification permission was denied. You may need to clear the browser setting to try again.</p>
        ) : permissionError ? (
            <p className="detail">Sorry, something went wrong: {permissionError}</p>
          ) : (
            <p className="detail">You can revoke this any time</p>
          )
        }
      </>
    );
  } else {
    content = <Feed />;
  }

  return (
    <>
      <header id="app-header">
        <h1>spacedust notifications <span className="demo">demo!</span></h1>
        {user && (
          <div className="current-user">
            <p>
              <span className="handle">@{user.handle}</span>
              {/* TODO: clear *all* info on logout */}
              <button className="subtle bad" onClick={() => setUser(null)}>&times;</button>
            </p>
          </div>
        )}
      </header>

      <div id="app-content">
        {content}
      </div>

      <div className="footer">
        <p className="from">
          This demo is part of
          {' '}
          <a href="https://microcosm.blue" className="external" target="_blank">
            <span style={{ color: '#f396a9' }}>m</span>
            <span style={{ color: '#f49c5c' }}>i</span>
            <span style={{ color: '#c7b04c' }}>c</span>
            <span style={{ color: '#92be4c' }}>r</span>
            <span style={{ color: '#4ec688' }}>o</span>
            <span style={{ color: '#51c2b6' }}>c</span>
            <span style={{ color: '#54bed7' }}>o</span>
            <span style={{ color: '#8fb1f1' }}>s</span>
            <span style={{ color: '#ce9df1' }}>m</span>

          </a>
        </p>
        <p className="actions">
          <a href="https://bsky.app/profile/microcosm.blue" target="_blank" className="external">
            🦋 follow
          </a>
          <a href="https://github.com/sponsors/uniphil/" target="_blank" className="external">
            💸 support
          </a>
          <a href="https://github.com/at-microcosm/spacedust-utils" target="_blank" className="external">
            👩🏻‍💻 source
          </a>
        </p>

        <p className="secret-dev">
          secret dev setting:
          {' '}
          <label>
            <input
              type="checkbox"
              onChange={e => setDev(e.target.checked)}
              checked={true /*isDev(ufosHost)*/}
            />
            localhost
          </label>
        </p>
      </div>
    </>
  )
}

export default App;
