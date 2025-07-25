import { useEffect, useState } from 'react';

const nicerSource = source => ({
  'app.bsky.feed.like:subject.uri': 'like', // likes
  'app.bsky.feed.repost:subject.uri': 'repost', // reposts
  'app.bsky.feed.post:embed.record.uri': 'quote', // normal quotes
  'app.bsky.feed.post:embed.record.record.uri': 'quote', // RecordWithMedia quotes
  'app.bsky.feed.post:reply.root.uri': 'reply', // all child replies
}[source]);

export function Post({ atUri, updatedLinks }) {
  const [baseStats, setBaseStats] = useState({});

  const nicerStats = {};

  for (const [collection, paths] of Object.entries(baseStats)) {
    for (const [oldStylePath, counts] of Object.entries(paths)) {
      const newStylePath = `${collection}:${oldStylePath.slice(1)}`;
      const name = nicerSource(newStylePath);
      if (!name) continue; // perils of constellation's (soon-deprecated) /all
      if (name === 'like') {
        nicerStats[name] = counts.distinct_dids;
      } else {
        nicerStats[name] = counts.records;
      }
    }
  }

  for (const [key, val] of Object.entries(updatedLinks)) {
    const name = nicerSource(key);
    if (!nicerStats[name]) nicerStats[name] = 0;
    nicerStats[name] += val;
  }

  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        const url = new URL('/links/all', 'https://constellation.microcosm.blue');
        url.searchParams.set('target', atUri);
        const res = await fetch(url);
        if (!res.ok) throw new Error(res);
        const { links } = await res.json();
        setBaseStats(links);
      } catch (e) {
        console.warn('fetching base stats failed', e);
      }
    })();

    return () => cancel = true;
  }, [atUri]);

  useState()


  return (
    <div>
      <p>
        {atUri}<br/>
        {JSON.stringify(nicerStats)}
      </p>
    </div>
  );
}
