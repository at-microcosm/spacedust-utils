import { getPostStats } from './constellation';

const SEKELETON_API = 'https://discover.bsky.app/xrpc/app.bsky.feed.getFeedSkeleton';
const FEED = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
const POLL_DELAY = 9000;
const POST_LIMIT = 5;

async function getFeed() {
  const url = new URL(SEKELETON_API);
  url.searchParams.append('feed', FEED);
  url.searchParams.append('limit', POST_LIMIT.toString());
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

/**
 * fetch a pair of posts from discover and alternately replace the first/second
 *
 * TODO: check w constellation to prioritize popular posts
 **/
export function rotatingPair(onRotate: any) {
  let timer: number;
  let dying = false;
  const seen = new Set(); // TODO: mem leak, slowly
  let A: string | null = null;
  let B: string | null = null;
  let which: 'A' | 'B' = 'A';

  async function next() {
    console.info('[sample posts: next]');
    try {
      const { feed } = await getFeed();
      if (dying) return;

      const withStats = await Promise.all(feed.map(async ({ post }) => {
        if (seen.has(post)) return { post, total: 0 };
        let stats = {};
        try {
          stats = await getPostStats(post);
        } catch (e) {
          console.warn('failed to get stats from constellation', e);
        }
        const total = Array.from(Object.values(stats)).reduce((a, b) => a + b, 0);
        return ({ post, total })
      }))
      if (dying) return;

      // idk if sorting by most interactions yields more-interactive posts but eh
      withStats.sort(({ total: a }, { total: b }) => b - a);

      // special case: first load
      if (A === null && B === null) {
        if (withStats.length < 2) throw new Error('withStats returned fewer than two posts to start');
        seen.add(A = withStats[0].post);
        seen.add(B = withStats[1].post);
      } else {
        for (const { post } of withStats) {
          if (seen.has(post)) {
            continue;
          }
          if (which === 'A') {
            seen.add(B = post);
            which = 'B';
          } else {
            seen.add(A = post);
            which = 'A';
          }
          break;
        }
      }
      onRotate([A, B]);
    } catch (e) {
      console.error('hmm, failed to get withStats', e);
    }
    timer = setTimeout(next, POLL_DELAY);
  }
  setTimeout(next);

  return () => {
    console.log('clearing');
    clearTimeout(timer);
    dying = true;
  }
}
