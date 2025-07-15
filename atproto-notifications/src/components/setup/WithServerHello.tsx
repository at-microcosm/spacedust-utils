import { useCallback, useEffect, useState } from 'react';
import { UserContext, PushServerContext } from '../../context';
import { WhoAmI } from '../WhoAmI';
import { SecretPassword } from '../SecretPassword';
import { GetJson, PostJson } from '../Fetch';
import { Chrome } from './Chrome';

export function WithServerHello({ children }) {
  const [loggingOut, setLoggingOut] = useState(null);
  const [helloKey, setHelloKey] = useState(0);
  const [whoamiKey, setWhoamiKey] = useState(0);
  const [whoamiInfo, setWhoamiInfo] = useState(null);

  const childrenFor = useCallback((did, role, parentChildren) => {
    if (role === 'public') {
      return <SecretPassword did={did} role={role} />;
    }
    return parentChildren;
  })

  const reloadConnect = useCallback(e => {
    e.preventDefault();
    setWhoamiKey(n => n + 1);
  });

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      const host = import.meta.env.VITE_NOTIFICATIONS_HOST;
      await fetch(`${host}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      // TODO: cancel subscription, clear storage, etc
    } catch (e) {
      console.error('logout fail', e);
    }
    setLoggingOut(null);
    setHelloKey(n => n + 1);
  });

  if (loggingOut !== null) {
    return <Chrome><p>Logging out&hellip;</p></Chrome>;
  }

  return (
    <GetJson
      /* todo: key on login state */
      key={helloKey}
      endpoint='/hello'
      credentials
      ok={({ whoamiHost, webPushPublicKey, role, did }) => {
        if (role === 'anonymous') {
          return whoamiInfo === null
            ? (
              <Chrome>
                <WhoAmI
                  key={whoamiKey}
                  origin={whoamiHost}
                  onIdentify={setWhoamiInfo}
                />
                <p style={{fontSize: '0.8rem'}}>
                  <a href="#" onClick={reloadConnect}>Reload connect prompt</a>
                </p>
              </Chrome>
            ) : (
              <PostJson
                endpoint="/verify"
                data={{ token: whoamiInfo.token }}
                credentials
                ok={({ did, role, webPushPublicKey }) => (
                  <Chrome user={{ did, role }} onLogout={handleLogout}>
                    <PushServerContext.Provider value={webPushPublicKey}>
                      {childrenFor(did, role, children)}
                    </PushServerContext.Provider>
                  </Chrome>
                )}
              />
            )
        } else {
          return (
            <Chrome user={{ did, role }} onLogout={handleLogout}>
              <PushServerContext.Provider value={webPushPublicKey}>
                {childrenFor(did, role, children)}
              </PushServerContext.Provider>
            </Chrome>
          );
        }
      }}
    />
  );
}
