import { useCallback, useEffect, useState } from 'react';
import { PushServerContext } from '../../context';
import { WhoAmI } from '../WhoAmI';
import { GetJson, PostJson } from '../Fetch';
import { Chrome } from './Chrome';


  // const logout = useCallback(async () => {
  //   setRole('anonymous');
  //   setUser(null);
  //   // TODO: clear indexeddb
  //   await fetch(`${host}/logout`, {
  //     method: 'POST',
  //     credentials: 'include',
  //   });
  // });

export function WithServerHello({ children }) {
  const [whoamiInfo, setWhoamiInfo] = useState(null);

  return (
    <GetJson
      /* todo: key on login state */
      endpoint='/hello'
      credentials
      ok={({ whoamiHost, webPushPublicKey, role, did }) => {
        if (role === 'anonymous') {
          return whoamiInfo === null
            ? (
              <Chrome>
                <WhoAmI origin={whoamiHost} onIdentify={setWhoamiInfo} />
              </Chrome>
            ) : (
              <PostJson
                endpoint="/verify"
                data={{ token: whoamiInfo.token }}
                credentials
                ok={({ did, role, webPushPublicKey }) => (
                  <Chrome user={{ did, role }}>
                    <PushServerContext.Provider value={webPushPublicKey}>
                      {children}
                    </PushServerContext.Provider>
                  </Chrome>
                )}
              />
            )
        } else {
          return (
            <Chrome user={{ did, role }}>
              <PushServerContext.Provider value={webPushPublicKey}>
                {children}
              </PushServerContext.Provider>
            </Chrome>
          );
        }
      }}
    />
  );
}
