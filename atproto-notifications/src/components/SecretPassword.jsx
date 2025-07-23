import { useCallback, useState } from 'react';
import { PostJson } from './Fetch';

export function SecretPassword({ did, role }) {
  const [submission, setSubmission] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(e => {
    e.preventDefault();
    setSubmission(n => n + 1);
    setSubmitting(true);
  })

  return (
    <form method="post" onSubmit={handleSubmit}>
      <h2>Secret early access</h2>
      <p>This demo is still in development! Your support helps keep it going: <a href="https://github.com/sponsors/uniphil/" target="_blank">github sponsors</a>, <a href="https://ko-fi.com/bad_example" target="_blank">ko-fi</a>.</p>

      {submitting ? (
        <PostJson
          key={submission}
          endpoint="/super-top-secret-access"
          data={{ secret_password: "letmein" }}
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
              <p style={{ color: "#9f0" }}>Secret password accepted.</p>
              <p>
                {/* an <a> tag, not a <Link>, on purpose so we relaod for our role */}
                <a className="button" href="/early?hello">
                  Continue
                </a>
              </p>
            </>
          )}
        />
      ) : (
        <p>
          <button type="submit">Let me in</button>
        </p>
      )}
    </form>
  );
}
