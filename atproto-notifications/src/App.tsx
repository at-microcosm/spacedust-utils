import { useCallback, useState, useEffect } from 'react';
import { Outlet } from 'react-router';
import { useLocalStorage } from "@uidotdev/usehooks";
import { GetJson } from './components/fetch';
import { WhoAmI } from './components/WhoAmI';
import { WithFeatureChecks } from './components/setup/WithFeatureChecks';
import { WithServiceWorker } from './components/setup/WithServiceWorker';
import { WithServerHello } from './components/setup/WithServerHello';
import { WithNotificationPermission } from './components/setup/WithNotificationPermission';
import { WithPushSubscription } from './components/setup/WithPushSubscription';
import { urlBase64ToUint8Array } from './utils';
import './App.css'

import lexicons from 'lexicons';


export function App({ children }) {
  return (
    <WithFeatureChecks>
      <WithServerHello>
        <WithServiceWorker>
          <WithNotificationPermission>
            <WithPushSubscription>
              {children}
            </WithPushSubscription>
          </WithNotificationPermission>
        </WithServiceWorker>
      </WithServerHello>
    </WithFeatureChecks>
  );
}

// const Problem = ({ children }) => (
//   <div className="problem">
//     <p>Sorry, {children}</p>
//   </div>
// );
