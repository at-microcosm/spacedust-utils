import psl from 'psl';
import { JSONPath } from 'jsonpath-plus';
import defs from './defs.js';
import { getAtUri } from './atproto.js';

export function getBits(source) {
  const [nsid, ...rp] = source.split(':');
  const segments = nsid.split('.');
  const group = segments.slice(0, segments.length - 1).join('.') ?? null;
  segments.reverse();
  const app = psl.parse(segments.join('.'))?.domain ?? null;
  return { app, group };
}

function getAppDefs(source) {
  const { app } = getBits(source);
  const appPrefix = source.slice(0, app.length);
  const appSource = source.slice(app.length + 1);
  return [appSource, defs[appPrefix]];
}

const uriBits = async uri => {
  const bits = uri.slice('at://'.length).split('/');
  // TODO: identifier might be a handle
  // TODO: rest might contain stuff after the rkey
  const [did, nsid, rkey] = [bits[0], bits[1], bits.slice(2)];
  return [did, nsid, rkey.join('/') || null];
};

export async function getLink(source, source_record, subject) {
  // TODO: pass in preferred client
  const [appSource, appDefs] = getAppDefs(source);
  const appLinks = appDefs?.clients?.[0]?.direct_links;
  const linkType = subject.startsWith('did:') ? 'did' : 'at_uri';
  const linkTemplate = appLinks?.[`${linkType}:${appSource}`];
  if (!linkTemplate) return null;

  let link = linkTemplate;

  // 1. sync subs
  const [sourceDid, sourceNsid, sourceRkey] = await uriBits(source_record);
  link = link
    .replaceAll('{source_record.did}', sourceDid)
    .replaceAll('{source_record.collection}', sourceNsid)
    .replaceAll('{source_record.rkey}', sourceRkey);
  if (linkTemplate === 'did') {
    link = link.replaceAll('{subject.did}', subject);
  } else {
    const [subjectDid, subjectNsid, subjectRkey] = await uriBits(subject);
    link = link
      .replaceAll('{subject.did}', subjectDid)
      .replaceAll('{subject.collection}', subjectNsid)
      .replaceAll('{subject.rkey}', subjectRkey);
  }

  // 2. async lookups

  // do we need to fetch anything from the link subject record?
  if (linkType === 'at_uri') {
    const subjectMatches = [...link.matchAll(/(\{@subject:(?<path>[^\}]+)\})/g)];
    if (subjectMatches.length > 0) {
      const subjectRecord = await getAtUri(subject);

      // do the actual replacements
      for (const match of subjectMatches) {
        // TODO: JSONPath won't actually cut it once we get $type in
        const sub = JSONPath({
          path: `$.${match.groups.path}`,
          json: subjectRecord,
        })[0]; // TODO: array result?

        link = link.replaceAll(match[0], sub);
      }
    }
  }

  // 2.b TODO: source record lookups if needed
  return link;
}

export async function getContext(source, source_record, subject) {
  const [appSource, appDefs] = getAppDefs(source);
  const contexts = appDefs?.known_sources?.[appSource]?.context ?? [];
  const linkType = subject.startsWith('did:') ? 'did' : 'at_uri';

  let loaded = [];
  for (const ctx of contexts) {
    const [o, ...pathstuff] = ctx.split(':');
    if (o !== '@subject') {
      throw new Error('only @subject is implemented for context loading so far');
    }
    if (linkType !== 'at_uri') {
      throw new Error('only at_uris can be used for @subject loading so far');
    }
    const path = pathstuff.join(':');
    const subjectRecord = await getAtUri(subject);
    // using json path is temporary -- need recordpath convention defined
    const found = JSONPath({
      path,
      json: subjectRecord,
    });
    loaded = loaded.concat(found); // TODO: think about array handling
  }

  return loaded;
}
