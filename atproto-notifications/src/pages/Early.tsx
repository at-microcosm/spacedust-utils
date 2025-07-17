import { useCallback, useState } from 'react';
import { postJson } from '../components/Fetch';
import './Early.css';

export function Early({ }) {
  const [pushCount, setPushCount] = useState(0);
  const [pushStatus, setPushStatus] = useState(null);

  const localTest = useCallback(() => {
    new Notification("Hello world!", { body: "This notification never left your browser" });
  });

  const pushTest = useCallback(async () => {
    setPushStatus(n => n + 1);
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
  });

  return (
    <div className="early">
      <h2>Hello!</h2>
      <p>Welcome to the early preview for the spacedust notifications demo, and since you're here early: thanks so much for supporting microcosm!</p>
      <p>A few things to keep in mind:</p>
      <ol>
        <li>This is a demo, not a polished product</li>
        <li>It has a lot of moving pieces, so things not always work</li>
        <li>Many features can easily be added! Some others can't! Make a request and let's see :)</li>
        <li>It's not a long-term committed part of microcosm <em>(yet)</em></li>
      </ol>
      <p>Sadly, it doesn't really work on mobile. iOS will stop delivering notifications after some minutes. Android people might have better luck?</p>
      <p>With that out of the way, let's cover some basics!</p>
      <h3>Hello hello</h3>
      <p>
        To see a test notification, <button onClick={localTest}>click on this</button>. This is a local-only test.
      </p>
      <p>
        <button
          disabled={pushStatus === 'pending'}
          onClick={pushTest}
        >
          Click here {pushCount > 0 && <>({pushCount})</>}
        </button>
        {' '}
        to see another. This one goes over Web Push.
      </p>
      {pushStatus === 'failed' && <p>uh oh, something went wrong requesting a web push</p>}
    </div>
  );
}
