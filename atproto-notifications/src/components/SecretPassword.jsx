import { useCallback, useState } from 'react';
import { PostJson } from './Fetch';

export function SecretPassword({ did, role }) {
  const [begun, setBegun] = useState(false);
  const [pw, setPw] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(e => {
    e.preventDefault();
    setSubmitting(true);
  })

  return (
    <form method="post" onSubmit={handleSubmit}>
      <h2>Secret password required</h2>
      <p>This demo is not ready for public yet, but you can get early access as a <a href="https://github.com/sponsors/uniphil/" target="_blank">github sponsor</a> or <a href="https://ko-fi.com/bad_example" target="_blank">ko-fi supporter</a>.</p>

      {submitting ? (
        <PostJson
          endpoint="/super-top-secret-access"
          data={{ secret_password: pw }}
          credentials
          loading={() => (<>Checking&hellip;</>)}
          error={e => {
            console.log('err', e);
            return (
              <>
                <p>whateverrrr</p>
                <p>
                  <button onClick={() => setSubmitting(false)}>retry</button>
                </p>
              </>
            );
          }}
          ok={() => (
            <>
              <p>That will do.</p>
              <p>
                <button onClick={() => window.location.reload()}>
                  Enter
                </button>
              </p>
            </>
          )}
        />
      ) : (
        <p>
          <label>
            Password:
            {' '}
            <input
              type="text"
              value={pw}
              onFocus={() => setBegun(true)}
              onChange={e => setPw(e.target.value)}
            />
          </label>
          {' '}
          {begun && (
            <button type="submit" className="subtle">
              open sesame
            </button>
          )}
        </p>
      )}
    </form>
  );
}
