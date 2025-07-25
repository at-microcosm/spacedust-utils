import { useEffect, useState } from 'react';
import { getPostStats } from './constellation';
import linkSources from './linkSources';

export function Post({ atUri, updatedLinks }) {
  const [baseStats, setBaseStats] = useState({});
  const liveStats = { ...baseStats };

  for (const [key, val] of Object.entries(updatedLinks)) {
    const name = linkSources[key];
    if (!liveStats[name]) liveStats[name] = 0;
    liveStats[name] += val;
  }

  useEffect(() => {
    let alive = true;
    getPostStats(atUri).then(
      stats => alive && setBaseStats(stats),
      e => console.warn('fetching base stats failed', e));
    return () => alive = false;
  }, [atUri]);

  return (
    <div>
      <p>
        {atUri}<br/>
        {JSON.stringify(liveStats)}
      </p>
    </div>
  );
}
