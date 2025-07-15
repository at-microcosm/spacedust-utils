import { Handle } from '../User';

export function Chrome({ user, onLogout, children }) {
  const content = children;
  const logout = () => null;
  return (
    <>
      <header id="app-header">
        <h1>spacedust notifications&nbsp;<span className="demo">demo!</span></h1>
        {user && (
          <div className="current-user">
            <p>
              <span className="handle">
                <Handle did={user.did} />
              </span>
              <button className="subtle bad" onClick={onLogout}>&times;</button>
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
  );
}
