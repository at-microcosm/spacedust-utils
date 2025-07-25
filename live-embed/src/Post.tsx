const nameSource = source => ({
  'app.bsky.feed.like:subject.uri': 'like', // likes
  'app.bsky.feed.repost:subject.uri': 'repost', // reposts
  'app.bsky.feed.post:embed.record.uri': 'quote', // normal quotes
  'app.bsky.feed.post:embed.record.record.uri': 'quote', // RecordWithMedia quotes
  'app.bsky.feed.post:reply.root.uri': 'reply', // all child replies
}[source]);

export function Post({ atUri, updatedLinks }) {
  const nicerStats = {};
  for (const [key, val] of Object.entries(updatedLinks)) {
    const name = nameSource(key);
    if (!nicerStats[name]) nicerStats[name] = 0;
    nicerStats[name] += val;
  }

  return (
    <div>
      <p>
        {atUri}<br/>
        {JSON.stringify(nicerStats)}
      </p>
    </div>
  );
}
