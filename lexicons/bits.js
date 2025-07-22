import psl from 'psl';
import defs from './defs.js';

export function getBits(source) {
  const [nsid, ...rp] = source.split(':');
  const segments = nsid.split('.');
  const group = segments.slice(0, segments.length - 1).join('.') ?? null;
  const unreversed = segments.toReversed().join('.');
  const app = psl.parse(unreversed)?.domain ?? null;
  return { app, group };
}
