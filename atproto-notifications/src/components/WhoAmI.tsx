import { useRef, useEffect } from 'react';

export function WhoAmI({ onIdentify, origin }) {
  const frameRef = useRef(null);

  useEffect(() => {
    function handleMessage(ev) {
      if (
        ev.source !== frameRef.current?.contentWindow ||
        ev.origin !== origin
      ) return;
      onIdentify(ev.data);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <iframe
      src={`${origin}/prompt?app=notifications.microcosm.blue`}
      referrerPolicy="strict-origin"
      ref={frameRef}
      height="180"
      width="360"
      style={{
        border: 'none',
        display: 'block',
        colorScheme: 'none',
        margin: '0 auto',
      }}
    >
      Ooops, failed to load the login helper
    </iframe>
  );
}
