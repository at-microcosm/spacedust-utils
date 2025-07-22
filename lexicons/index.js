export default {
  'blue.microcosm': {
    name: 'microcosm',
    clients: [
      {
        app_name: 'Spacedust notifications demo',
        canonical: true,
        main: 'https://notifications.microcosm.blue',
        icon: '/icons/microcosm.png',
      },
    ],
    known_sources: {
      'test.notification:hello': 'Hello spacedust!',
    },
  },
  'app.bsky': {
    name: 'Bluesky',
    profile: {
      display_name: 'app.bsky.actor.profile:displayName',
      avatar: 'app.bsky.actor.profile:avatar',
    },
    clients: [
      {
        app_name: 'Bluesky Social',
        canonical: true,
        main: 'https://bsky.app',
        icon: '/icons/app.bsky.png',
        notifications: 'https://bsky.app/notifications',
        direct_links: {
          'at_uri:feed.like:subject.uri': 'https://bsky.app/profile/{subject.did}/post/{subject.rkey}',
          'at_uri:feed.post:reply.parent.uri': 'https://bsky.app/profile/{source_record.did}/post/{source_record.rkey}',
          'at_uri:feed.post:reply.root.uri': 'https://bsky.app/profile/{source_record.did}/post/{source_record.rkey}',
          'at_uri:feed.post:embed.record.uri': 'https://bsky.app/profile/{source_record.did}/post/{source_record.rkey}',
          'at_uri:feed.post:embed.record.record.uri': 'https://bsky.app/profile/{source_record.did}/post/{source_record.rkey}',
          'did:graph.follow:subject': 'https://bsky.app/profile/{source_record.did}',
          'did:feed.post:facets[app.bsky.richtext.facet].features[app.bsky.richtext.facet#mention].did': 'https://bsky.app/profile/{source_record.did}/post/{source_record.rkey}',
        },
      },
      {
        app_name: 'Deer Social',
        main: 'https://deer.social',
        notifications: 'https://deer.social/notifications',
        direct_links: {
          'at_uri:feed.post': 'https://deer.social/profile/{did}/post/{rkey}',
          'did': 'https://deer.social/profile/{did}',
        },
      },
    ],
    known_sources: {
      'graph.follow:subject': 'Follow',
      'graph.verification:subject': 'Verification',
      'feed.like:subject.uri': 'Like',
      'feed.like:via.uri': 'Repost like',
      'feed.post:reply.parent.uri': 'Reply',
      'feed.post:reply.root.uri': 'Reply in thread',
      'feed.post:embed.record.uri': 'Quote',
      'feed.post:embed.record.record.uri': 'Quote', // with media
      'feed.post:facets[app.bsky.richtext.facet].features[app.bsky.richtext.facet#mention].did': 'Mention',
      'feed.repost:subject.uri': 'Repost',
      'feed.repost:via.uri': 'Repost repost',
    },
    torment_sources: {
      'graph.block:subject': null,
      'graph.listitem:subject': null, // we are never ever building listifications
      'graph.listblock:subject': null, // "subscribed to your blocklist?" idk
      'feed.threadgate:hiddenReplies[]': null,
      'feed.postgate:detachedEmbeddingUris[]': null,
    },
  },
  'pub.leaflet': {
    name: 'Leaflet',
    clients: [
      {
        app_name: 'leaflet.pub',
        canonical: true,
        icon: '/icons/pub.leaflet.jpg',
        main: 'https://leaflet.pub/home',
        direct_links: {
          'at_uri:graph.subscription:publication': 'https://leaflet.pub/lish/{did}/{rkey}/dashboard',
        },
      }
    ],
    known_sources: {
      'graph.subscription:publication': 'Subscription',
    },
  },
  'sh.tangled': {
    name: 'Tangled',
    clients: [
      {
        app_name: 'Tangled',
        canonical: true,
        icon: '/icons/sh.tangled.jpg',
        main: 'https://tangled.sh',
      }
    ],
    known_sources: {
      'feed.star:subject': 'Star',
      'feed.reaction:subject': 'Reaction',
      'graph.follow:subject': 'Follow',
      'actor.profile:pinnedRepositories[]': 'Pinned repo',
      'repo.issue.comment:issue': 'Issue comment',
      'repo.issue.comment:owner': 'Issue comment',
      'repo.issue.comment:repo': 'Issue comment',
      'repo.pull:targetRepo': 'Pull',
      'repo.pull.comment:owner': 'Pull comment',
      'repo.pull.comment:pull': 'Pull comment',
      'repo.pull.comment:repo': 'Pull comment',
      'knot.member:subject': 'Knot member',
      'spindle.member:subject': 'Spindle member',
    },
  },
  'com.shinolabs': { // TODO: this app isn't exactly tld+1
    name: 'Pinksea',
    clients: [
      {
        app_name: 'Pinksea',
        canonical: true,
        icon: '/icons/com.shinolabs.jpg',
        main: 'https://pinksea.art',
      },
    ],
    known_sources: {
      'pinksea.oekaki:inResponseTo.uri': 'Response',
    },
  },
  'place.stream': {
    name: 'Streamplace',
    clients: [
      {
        app_name: 'Streamplace',
        canonical: true,
        icon: '/icons/place.stream.png',
        main: 'https://stream.place',
      },
    ],
    known_sources: {
      'chat.message:streamer': 'Message',
      'key:signingKey': 'Signing key',
    },
  },
  'so.sprk': {
    name: 'Spark',
    clients: [
      {
        app_name: 'Spark',
        canonical: true,
        icon: '/icons/so.sprk.png',
        main: 'https://spark.so',
      },
    ],
    known_sources: {
      'feed.like:subject.uri': 'Like',
      // it's not actually clear to me if *all* the bsky sources were copied for sprk posts or not
      'feed.post:reply.parent.uri': 'Reply',
      'feed.post:reply.root.uri': 'Reply in thread',
      'feed.post:embed.record.uri': 'Quote',
      'feed.post:embed.record.record.uri': 'Quote', // with media
      'feed.post:facets[app.bsky.richtext.facet].features[app.bsky.richtext.facet#mention].did': 'Mention',
    },
  },
  'events.smokesignal': {
    name: 'Smoke Signal',
    clients: [
      {
        app_name: 'Smoke Signal',
        canonical: true,
        icon: '/icons/events.smokesignal.png',
        main: 'https://smokesignal.events',
      },
    ],
    known_sources: {
      'calendar.rsvp:subject.uri': 'RSVP',
    },
  },
  'app.popsky': {
    name: 'Popsky',
    clients: [
      {
        app_name: 'Popsky',
        canonical: true,
        icon: '/icons/app.popsky.png',
        main: 'https://popsky.social',
      },
    ],
    known_sources: {
      'like:subjectUri': 'Like',
      'comment:subjectUri': 'Comment',
    },
  },
};
