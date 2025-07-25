
const SEKELETON_API = 'https://discover.bsky.app/xrpc/app.bsky.feed.getFeedSkeleton';
const FEED = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
const POLL_DELAY = 9000;
const POST_LIMIT = 10;

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
    try {
      const { feed } = await getFeed();
      if (dying) return;

      // special case: first load
      if (A === null && B === null) {
        if (feed.length < 2) throw new Error('feed returned fewer than two posts to start');
        seen.add(A = feed[0].post);
        seen.add(B = feed[1].post);
      } else {
        for (const { post } of feed) {
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
      console.error('hmm, failed to get feed', e);
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
