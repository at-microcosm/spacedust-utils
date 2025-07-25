import linkSources from './linkSources';

/**
 * get nice historical counts from constellation
 *
 * constellation's api still uses separated collection/path sources, and
 * likes should be distinct where everything else is record counts.
 *
 * constellation still can only specify one link source per request or /all
 *
 * handles stuff like that
 **/
export async function getPostStats(
  atUri: string,
  endpoint: string = 'https://constellation.microcosm.blue'
) {
  const url = new URL('/links/all', endpoint);
  url.searchParams.set('target', atUri);
  const res = await fetch(url);
  if (!res.ok) throw new Error(res);
  const { links } = await res.json();

  const niceLinks = {};

  for (const [collection, paths] of Object.entries(links)) {
    for (const [oldStylePath, counts] of Object.entries(paths)) {
      const newStylePath = `${collection}:${oldStylePath.slice(1)}`;
      const name = linkSources[newStylePath];
      if (!name) continue; // perils of constellation's (soon-deprecated) /all
      if (name === 'like') {
        niceLinks[name] = counts.distinct_dids;
      } else {
        niceLinks[name] = counts.records;
      }
    }
  }

  return niceLinks;
}
