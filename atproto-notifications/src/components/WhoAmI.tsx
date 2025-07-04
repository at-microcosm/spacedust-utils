import { useRef, useEffect } from 'react';

export function WhoAmI({ onSetUser, origin = 'http://127.0.0.1:9997' }) {
  const frameRef = useRef(null);

  useEffect(() => {
    function handleMessage(ev) {
      if (
        ev.source !== frameRef.current?.contentWindow ||
        ev.origin !== origin
      ) return;
      onSetUser(ev.data);
    }

    console.log('ready');
    window.addEventListener('message', handleMessage);
    return () => {
      console.log('byeeeeeeeeeeeee');
      window.removeEventListener('message', handleMessage);
    }
  }, []);

  return (
    <iframe
      src={`${origin}/prompt`}
      ref={frameRef}
      id="whoami"
      style={{
        border: 'none',
        boxSizing: 'border-box',
        display: 'block',
        colorScheme: 'none',
      }}
      allowtransparency="true"
      height="160"
      width="320"
    >
      Ooops, failed to load the login helper
    </iframe>
  );
}
