import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Handle } from '../User';
import { GetJson, postJson } from '../Fetch';
import './Chrome.css';

function Header({ user, onLogout }) {
  return (
    <header id="app-header">
      <h1>
        <Link to="/" className="inherit-font">
          spacedust notifications&nbsp;<span className="demo">demo!</span>
        </Link>
      </h1>
      {user && (
        <div className="current-user">
          <p>
            <span className="handle">
              <Handle did={user.did} />
              {user.role !== 'public' && (
                <span className="chrome-role-tag">
                  {user.role === 'admin' ? (
                    <Link to="/admin" className="inherit-font">{user.role}</Link>
                  ) : user.role === 'early' ? (
                    <Link to="/early" className="inherit-font">{user.role}</Link>
                  ) : (
                    <>{user.role}</>
                  )}
                </span>
              )}
            </span>
            <button className="subtle bad" onClick={onLogout}>&times;</button>
          </p>
        </div>
      )}
    </header>
  );
}

export function Chrome({ user, onLogout, children }) {
  const [secretDevCounter, setSecretDevCounter] = useState(0);
  const [secretDevStatus, setSecretDevStatus] = useState(null);

  // ~~is this the best way~~ does it work? yeh
  const setSelfNotify = useCallback(async enabled => {
    setSecretDevStatus('pending');
    const host = import.meta.env.VITE_NOTIFICATIONS_HOST;
    const url = new URL('/global-notify', host);
    try {
      await postJson(url, JSON.stringify({ notify_self: enabled }), true)
      setSecretDevStatus(null);
    } catch (err) {
      console.error('failed to set self-notify setting', err);
      setSecretDevStatus('failed');
    }
    setSecretDevCounter(n => n + 1);
  });

  return (
    <>
      <Header user={user} onLogout={onLogout} />

      <div id="app-content">
        {children}
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
          <a href="https://github.com/sponsors/uniphil/" target="_blank" className="external">
            💸 support
          </a>
          <a href="https://bsky.app/profile/microcosm.blue" target="_blank" className="external">
            🦋 follow
          </a>
          <a href="https://github.com/at-microcosm/spacedust-utils" target="_blank" className="external">
            👩🏻‍💻 source
          </a>
        </p>

        <p className="secret-dev">
          secret dev setting:
          {' '}
          <GetJson
            key={secretDevCounter}
            endpoint="/global-notify"
            credentials
            loading={() => <>&hellip;</>}
            ok={({ notify_self }) => (
              <label>
                <input
                  type="checkbox"
                  onChange={e => setSelfNotify(e.target.checked)}
                  checked={notify_self ^ (secretDevStatus === 'pending')}
                  disabled={secretDevStatus === 'pending'}
                />
                self-notify
              </label>
            )}
          />
        </p>
      </div>
    </>
  );
}
