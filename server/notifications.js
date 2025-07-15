import lexicons from 'lexicons';
import psl from 'psl';
import webpush from 'web-push';
import WebSocket from 'ws';

// kind of silly but right now there's no way to tell spacedust that we want an alive connection
// but don't want the notification firehose (everything filtered out)
// so... the final filter is an absolute on this fake did, effectively filtering all notifs.
// (this is only used when there are no subscribers registered)
const DUMMY_DID = 'did:plc:zzzzzzzzzzzzzzzzzzzzzzzz';

let spacedust;
let spacedustEverStarted = false;

const updateSubs = db => {
  if (!spacedust) {
    console.warn('not updating subscription, no spacedust (reconnecting?)');
    return;
  }
  const wantedSubjectDids = db.getSubscribedDids();
  if (wantedSubjectDids.length === 0) {
    wantedSubjectDids.push(DUMMY_DID);
  }
  console.log('updating for wantedSubjectDids', wantedSubjectDids);
  spacedust.send(JSON.stringify({
    type: 'options_update',
    payload: {
      wantedSubjectDids,
    },
  }));
};

const push = async (db, pushSubscription, payload) => {
  const { session, subscription, since_last_push } = pushSubscription;
  if (since_last_push !== null && since_last_push < 1.618) {
    console.warn(`rate limiter: dropping too-soon push (${since_last_push})`);
    return;
  }

  let sub;
  try {
    sub = JSON.parse(subscription);
  } catch (e) {
    console.error('failed to parse subscription json, dropping session', e);
    db.deleteSub(session);
    return;
  }

  try {
    await webpush.sendNotification(sub, payload);
  } catch (err) {
    if (400 <= err.statusCode && err.statusCode < 500) {
      console.info(`removing sub for ${err.statusCode}`);
      db.deleteSub(session);
      return;
    } else {
      console.warn('something went wrong for another reason', err);
    }
  }

  db.updateLastPush(session);
};

const isTorment = source => {
  try {
    const [nsid, ...rp] = source.split(':');

    let parts = nsid.split('.');
    parts.reverse();
    parts = parts.join('.');

    // const unreversed = parts.toReversed().join('.');

    const app = psl.parse(parts)?.domain ?? 'unknown';

    let appPrefix = app.split('.');
    appPrefix.reverse();
    appPrefix = appPrefix.join('.')

    return source.slice(app.length + 1) in lexicons[appPrefix]?.torment_sources;
  } catch (e) {
    console.error('checking tormentedness failed, allowing through', e);
    return false;
  }
};

const handleDust = db => async event => {
  console.log('got', event.data);
  let data;
  try {
    data = JSON.parse(event.data);
  } catch (err) {
    console.error(err);
    return;
  }
  const { link: { subject, source, source_record } } = data;
  if (isTorment(source)) {
    console.log('nope! not today,', source);
    return;
  }
  const timestamp = +new Date();

  let did;
  if (subject.startsWith('did:')) did = subject;
  else if (subject.startsWith('at://')) {
    const [id, ..._] = subject.slice('at://'.length).split('/');
    if (id.startsWith('did:')) did = id;
  }
  if (!did) {
    console.warn(`ignoring link with non-DID subject: ${subject}`)
    return;
  }

  const subs = db.getSubsByDid(did);
  const payload = JSON.stringify({ subject, source, source_record, timestamp });
  let res = await Promise.all(subs.map(pushSubscription => push(db, pushSubscription, payload)));
  console.log('send results', res);
};

export const connectSpacedust = (db, host) => {
  spacedust = new WebSocket(`${host}/subscribe?instant=true&wantedSubjectDids=${DUMMY_DID}`);
  let restarting = false;

  const restart = () => {
    if (restarting) return;
    restarting = true;
    let wait = Math.round(500 + (Math.random() * 1000));
    console.info(`restarting spacedust connection in ${wait}ms...`);
    setTimeout(() => connectSpacedust(db, host), wait);
    spacedust = null;
  }

  spacedust.onopen = () => updateSubs(db);
  spacedust.onmessage = handleDust(db);

  spacedust.onerror = e => {
    console.error('spacedust errored:', e);
    restart();
  };

  spacedust.onclose = () => {
    console.log('spacedust closed');
    restart();
  };

  return updateSubs;
};
