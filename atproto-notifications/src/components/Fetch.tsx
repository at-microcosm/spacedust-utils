import { useContext, useEffect, useState } from 'react';

const loadingDefault = () => (
  <em>Loading&hellip;</em>
);

const errorDefault = err => (
  <span className="error">
    <strong>Error</strong>:<br/>{`${err}`}
  </span>
);

export function Fetch({ using, args, ok, loading, error }) {
  const [asyncData, setAsyncData] = useState({ state: null });

  useEffect(() => {
    let ignore = false;
    setAsyncData({ state: 'loading' });
    (async () => {
      try {
        const data = await using(...args);
        !ignore && setAsyncData({ state: 'done', data });
      } catch (err) {
        !ignore && setAsyncData({ state: 'error', err });
      }
    })();
    return () => { ignore = true; }
  }, args);

  if (asyncData.state === 'loading') {
    return (loading || loadingDefault)(...args);
  } else if (asyncData.state === 'error') {
    return (error || errorDefault)(asyncData.err);
  } else if (asyncData.state === null) {
    return <span>wat, request has not started (bug?)</span>;
  } else {
    if (asyncData.state !== 'done') { console.warn(`unexpected async data state: ${asyncData.state}`); }
    return ok(asyncData.data);
  }
}

/////

async function getJson(url, credentials) {
  const opts = {};
  if (credentials) opts.credentials = 'include';
  const res = await fetch(url, opts);
  if (!res.ok) {
    const m = await res.text();
    throw new Error(`Failed to fetch: ${m}`);
  }
  return await res.json();
}

export function GetJson({ endpoint, params, credentials, ...forFetch }) {
  const host = import.meta.env.VITE_NOTIFICATIONS_HOST;
  const url = new URL(endpoint, host);
  for (let [key, val] of Object.entries(params ?? {})) {
    url.searchParams.append(key, val);
  }
  return (
    <Fetch
      using={getJson}
      args={[url.toString(), credentials]}
      {...forFetch}
    />
  );
}

export async function postJson(url, body, credentials) {
  const opts = {
    method: 'POST',
    headers: {'Content-Type': 'applicaiton/json'},
    body,
  };
  if (credentials) opts.credentials = 'include';
  const res = await fetch(url, opts);
  if (!res.ok) {
    const m = await res.text();
    let reason
    try {
      reason = JSON.parse(m)?.reason;
    } catch (err) {};
    if (reason) throw reason;
    throw new Error(`Failed to fetch: ${m}`);
  }
  try {
    return await res.json();
  } catch (e) {
    if ([201, 204].includes(res.status)) return null;
    throw e;
  }
}

export function PostJson({ endpoint, data, credentials, ...forFetch }) {
  const host = import.meta.env.VITE_NOTIFICATIONS_HOST;
  const url = new URL(endpoint, host);
  return (
    <Fetch
      using={postJson}
      args={[url.toString(), JSON.stringify(data), credentials]}
      {...forFetch}
    />
  );
}
