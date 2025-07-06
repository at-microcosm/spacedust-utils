import { CompositeDidDocumentResolver, PlcDidDocumentResolver, WebDidDocumentResolver } from '@atcute/identity-resolver';

const docResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver(),
    web: new WebDidDocumentResolver(),
  },
});

export async function resolveDid(did) {
  let doc;
  try {
    doc = await docResolver.resolve(did);
  } catch (err) {
    throw err;
    // if (err instanceof DocumentNotFoundError) {
    //   // did returned no document
    // }
    // if (err instanceof UnsupportedDidMethodError) {
    //   // resolver doesn't support did method (composite resolver)
    // }
    // if (err instanceof ImproperDidError) {
    //   // resolver considers did as invalid (atproto did:web)
    // }
    // if (err instanceof FailedDocumentResolutionError) {
    //   // document resolution had thrown something unexpected (fetch error)
    // }
    // if (err instanceof HandleResolutionError) {
    //   // the errors above extend this class, so you can do a catch-all.
    // }
  }

  if (!(doc.alsoKnownAs && doc.alsoKnownAs.length >= 1)) {
    console.error('questionable doc', doc);
    throw new Error('doc missing aka');
  }

  const aka = doc.alsoKnownAs[0];
  if (!aka.startsWith('at://')) {
    console.error('questionable aka doesn\'t start with aka://', aka);
    throw new Error('aka not an at-uri');
  }

  const handle = aka.slice('at://'.length);
  if (handle.length === 0) {
    console.error('empty handle? aka:', aka);
    throw new Error('empty handle');
  }

  return handle;
}
