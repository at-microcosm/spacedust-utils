const linkSources = {
  'app.bsky.feed.like:subject.uri': 'like',
  'app.bsky.feed.repost:subject.uri': 'repost', // actual repost
  'app.bsky.feed.post:embed.record.uri': 'repost', // normal quote (grouped for count)
  'app.bsky.feed.post:embed.record.record.uri': 'repost', // RecordWithMedia quote (grouped for count)
  'app.bsky.feed.post:reply.root.uri': 'reply', // root: count all descendent replies
};

export { linkSources as default };
