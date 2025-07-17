import { useContext, useEffect, useState } from 'react';
import { RoleContext } from '../context';
import ReactTimeAgo from 'react-time-ago';
import { GetJson, PostJson } from '../components/Fetch';
import { Handle } from '../components/User';

import './Admin.css'

// yeah this is horrible, i don't care
function OnMount({ callback }) {
  useEffect(() => {
    callback();
  });
}

function AddSecretForm({ onAdded }) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState('');
  const [submit, setSubmit] = useState(false);

  const handleFocus = () => {
    setSubmit(false);
    setActive(true);
  };

  const handleChange = e => {
    setSubmit(false);
    setValue(e.target.value);
  };

  const handleSubmit = e => {
    e.preventDefault();
    setSubmit(true);
  };

  return (
    <form onSubmit={handleSubmit}>
      <p className="admin-new-pw-p">
        <label>
          new secret password:
          {' '}
          <input
            onFocus={handleFocus}
            onChange={handleChange}
            value={value}
            size={12}
          />
        </label>
        {active && (
          <>{' '}<button type="submit" className="subtle">add</button></>
        )}
      </p>
      {submit && (
        <PostJson
          endpoint="/top-secret"
          data={{ secret_password: value }}
          credentials
          ok={() => (<p>added.<OnMount callback={() => onAdded(value)}/></p>)}
          error={e => {
            if (e === 'conflict') {
              return <p className="admin-error-message">rejected (likely exists or constraint failed)</p>
            }
            return <p className="admin-error-message">adding secret failed: {e.toString()}</p>;
          }}
        />
      )}
    </form>
  );
}

export function Admin({}) {
  const [listKey, setListKey] = useState('');
  if (useContext(RoleContext) !== 'admin') {
    return <p>sorry, this page is admin-only</p>
  }

  return (
    <>
      <h2>Top secret(s)</h2>
      <AddSecretForm onAdded={setListKey} />
      <GetJson
        key={listKey}
        endpoint="/top-secrets"
        credentials
        ok={secrets => secrets.map(s => <Secret key={s.password} {...s} />)}
      />
      <Secret password={null} added={0} expired={null} />
    </>
  );
}

function Secret({ password, added, expired }) {
  const [expiring, setExpiring] = useState(false);
  const [reallyExpired, setReallyExpired] = useState(expired);
  return (
    <div className="admin-secret">
      <p className="admin-secret-secret">
        {password !== null ? <>"{password}"</> : '[no password]'}
        {' '}
        (added <ReactTimeAgo date={new Date(added)} locale="en-US" />
          {expired && (
            <>, expired <ReactTimeAgo date={new Date(expired)} locale="en-US" /></>
          )})
        {' '}
        {!reallyExpired && (
          expiring ? (
            <PostJson
              endpoint="/expire-top-secret"
              data={{ secret_password: password }}
              credentials
              loading={() => <>&hellip;</>}
              ok={() => <OnMount callback={() => setReallyExpired(true)} />}
            />
          ) : (
            <button
              className="subtle"
              disabled={expiring}
              onClick={() => setExpiring(true)}
            >
              expire
            </button>
          )
        )}
      </p>
      <GetJson
        endpoint="/top-secret-accounts"
        params={{ secret_password: password ?? '' }}
        credentials
        ok={accounts => accounts.length > 0 ? (
          <ul>
            {accounts.map(info => (
              <li key={info.did}>
                <Account {...info} />
              </li>
            ))}
          </ul>
        ) : (
          <p><em>no accounts</em></p>
        )}
      />
    </div>
  );
}

function Account({ did, first_seen, role, active_subs, total_pushes, last_push }) {
  return (
    <p>
      <Handle did={did} />
      {' '}
      ({active_subs} subs, {total_pushes} pushes, latest <ReactTimeAgo date={new Date(last_push)} locale="en-US" />)
      <br/>
      joined <ReactTimeAgo date={new Date(first_seen)} locale="en-US" />
      {', '}
      role: <code>{role}</code>
    </p>
  );
}
