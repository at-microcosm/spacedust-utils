import { useEffect, useState } from 'react';
import { getPostStats } from './constellation';
import { getAtUri } from './getPost';
import linkSources from './linkSources';

import './Post.css';

export function Post({ atUri, updatedLinks }) {
  const [record, setRecord] = useState({ state: 'loading' });
  const [baseStats, setBaseStats] = useState({});
  const liveStats = { ...baseStats };

  for (const [key, val] of Object.entries(updatedLinks)) {
    const name = linkSources[key];
    if (!liveStats[name]) liveStats[name] = 0;
    liveStats[name] += val;
  }

  useEffect(() => {
    let alive = true;

    getAtUri(atUri).then(
      record => alive && setRecord({ state: 'loaded', record }),
      error => alive && setRecord({ state: 'failed', error }));

    getPostStats(atUri).then(
      stats => alive && setBaseStats(stats),
      e => console.warn('fetching base stats failed', e));

    return () => alive = false;
  }, [atUri]);

  return (
    <div className="post">
      {record.state === 'loading'
        ? <p className="loading">loading post&hellip;</p>
        : record.state === 'failed'
          ? <p className="failed">failed to load post :/ {`${record.error}`}</p>
          : <RecordContents data={record.record} />
      }
      <p className="stats">
        {liveStats.reply && (
          <span className="stat reply" title="total replies">
            {liveStats.reply.toLocaleString()}
          </span>
        )}
        {liveStats.repost && (
          <span className="stat repost" title="total reposts">
            {liveStats.repost.toLocaleString()}
          </span>
        )}
        {liveStats.like && (
          <span className="stat like" title="total likes">
            {liveStats.like.toLocaleString()}
          </span>
        )}
      </p>
    </div>
  );
}

function RecordContents({ data }) {
  return (
    <div className="record-contents">
      {data.text}
    </div>
  );
}
