import { useCallback, useEffect, useState } from 'react';
import { UserContext, PushServerContext } from '../../context';
import { WhoAmI } from '../WhoAmI';
import { SecretPassword } from '../SecretPassword';
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

  const childrenFor = useCallback((did, role) => {
    if (role === 'public') {
      return <SecretPassword did={did} role={role} />;
    }
    return 'hiiiiiiii ' + role;
  })

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
                      {childrenFor(did, role)}
                    </PushServerContext.Provider>
                  </Chrome>
                )}
              />
            )
        } else {
          return (
            <Chrome user={{ did, role }}>
              <PushServerContext.Provider value={webPushPublicKey}>
                {childrenFor(did, role)}
              </PushServerContext.Provider>
            </Chrome>
          );
        }
      }}
    />
  );
}
