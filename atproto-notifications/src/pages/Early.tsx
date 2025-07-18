import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { postJson } from '../components/Fetch';
import './Early.css';

export function Early({ }) {
  const [searchParams, _] = useSearchParams();
  const [notified, setNotified] = useState(false);
  const [pushStatus, setPushStatus] = useState(null);
  const [pushed, setPushed] = useState(false);

  const returning = !searchParams.has('hello');

  const localTest = useCallback(() => {
    try {
      new Notification("Hello world!", { body: "This notification never left your browser" });
    } catch (e) {
      console.error('failed to create local notification', e);
      alert('Failed to create local notification. If you\'re up for helping debug, get in touch.');
    }
    setNotified(true);
  });

  const pushTest = useCallback(async () => {
    setPushStatus('pending');
    const host = import.meta.env.VITE_NOTIFICATIONS_HOST;
    const url = new URL('/push-test', host);
    try {
      await postJson(url, JSON.stringify(null), true);
      setPushStatus(null);
    } catch (e) {
      console.error('failed push test request', e);
      setPushStatus('failed');
    }
    setPushed(true);
  });

  return (
    <div className="early">
      <h2>Hello!</h2>
      <p>Welcome to the early preview for the spacedust notifications demo, and since you're here early: thanks so much for supporting microcosm!</p>
      <p>A few things to keep in mind:</p>
      <ol>
        <li>This is a <a href="https://spacedust.microcosm.blue" target="_blank">spacedust</a> demo, not a polished product</li>
        <li>It's not a long-term committed part of microcosm <em>(yet)</em></li>
        <li>Mobile browsers are unreliable at delivering Web Push notifications</li>
        <li>Many features are easy to add! Some are surprisingly hard! Make a request and let's see :)</li>
      </ol>
      <p>With that out of the way, let's cover some basics!</p>

      <h3>Testing 1, 2, 3&hellip;</h3>
      <p>
        To see a test notification, <button onClick={localTest}>click on this</button>. This is a local-only test.
      </p>
      {(returning || notified) && (
        <>
          <p>
            Then
            {' '}
            <button
              disabled={pushStatus === 'pending'}
              onClick={pushTest}
            >
              click here {pushed > 0 && '✅'}
            </button>
            {' '}
            for another. This one uses Web Push!
          </p>
          {pushStatus === 'failed' && <p>uh oh, something went wrong requesting a web push</p>}
      </>
    )}
    {(returning || (pushed && pushStatus !== 'failed')) && (
      <>
        <h3>Great!</h3>
        <p>
          You can get back to this page by clicking the early
          <span className="chrome-role-tag">early</span>
          {' '}
          tag by your handle.
        </p>
        <p><Link to="/">Go to Notifications</Link></p>
      </>
    )}

    </div>
  );
}
