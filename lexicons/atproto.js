import { Client, CredentialManager, ok, simpleFetchHandler } from '@atcute/client';
import { CompositeDidDocumentResolver, PlcDidDocumentResolver, WebDidDocumentResolver } from '@atcute/identity-resolver';

// cleanup needed

const docResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver(),
    web: new WebDidDocumentResolver(),
  },
});

async function resolve_did(did) {
  return await docResolver.resolve(did);
}

function pds({ service }) {
  if (!service) {
    throw new Error('missing service from identity doc');
  }
  const { serviceEndpoint } = service[0];
  if (!serviceEndpoint) {
    throw new Error('missing serviceEndpoint from identity service array');
  }
  return serviceEndpoint;
}


async function get_pds_record(endpoint, did, collection, rkey) {
  const handler = simpleFetchHandler({ service: endpoint });
  const rpc = new Client({ handler });
  const { ok, data } = await rpc.get('com.atproto.repo.getRecord', {
    params: { repo: did, collection, rkey },
  });
  if (!ok) throw new Error('fetching pds record failed');
  return data;
}

function parse_at_uri(uri) {
  let collection, rkey;
  if (!uri.startsWith('at://')) {
    throw new Error('invalid at-uri: did not start with "at://"');
  }
  let remaining = uri.slice('at://'.length); // remove the at:// prefix
  remaining = remaining.split('#')[0]; // hash is valid in at-uri but we don't handle them
  remaining = remaining.split('?')[0]; // query is valid in at-uri but we don't handle it
  const segments = remaining.split('/');
  if (segments.length === 0) {
    throw new Error('invalid at-uri: could not find did after "at://"');
  }
  const did = segments[0];
  if (segments.length > 1) {
    collection = segments[1];
  }
  if (segments.length > 2) {
    rkey = segments.slice(2).join('/'); // hmm are slashes actually valid in rkey?
  }
  return { did, collection, rkey };
}

export async function getAtUri(atUri) {
  const { did, collection, rkey } = parse_at_uri(atUri);
  const doc = await resolve_did(did);
  const endpoint = pds(doc);
  const { value } = await get_pds_record(endpoint, did, collection, rkey);
  return value;
}
