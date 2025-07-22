import { default as lexicons, getBits } from 'lexicons';
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

const extractUriDid = at_uri => {
  if (!at_uri.startsWith('at://')) {
    console.warn(`ignoring non-at-uri: ${at_uri}`);
    return null;
  }
  const [id, ..._] = at_uri.slice('at://'.length).split('/');
  if (!id) {
    console.warn(`ignoring at-uri with missing id segment: ${at_uri}`);
    return null;
  }
  if (id.startsWith('@')) {
    console.warn(`ignoring @handle at-uri: ${at_uri}`);
    return null;
  }
  if (!id.startsWith('did:')) {
    console.warn(`ignoring non-did at-uri: ${at_uri}`);
    return null;
  }
  return id;
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

  const did = subject.startsWith('did:') ? subject : extractUriDid(subject);
  if (!did) {
    console.warn(`ignoring link with non-DID subject: ${subject}`)
    return;
  }

  // this works for now since only the account owner is assumed to be a notification target
  // but for "replies on post" etc that won't hold
  const { notify_enabled, notify_self } = db.getNotifyAccountGlobals(did);
  if (!notify_enabled) {
    console.warn('dropping notification for global not-enabled setting');
    return;
  }
  if (!notify_self) {
    const source_did = extractUriDid(source_record);
    if (!source_did) {
      console.warn(`ignoring link with non-DID source_record: ${source_record}`)
      return;
    }
    if (source_did === did) {
      console.warn(`ignoring self-notification`);
      return;
    }
  }

  // like above, this over-assumes that did is the only recipient we could care about for now
  const { app, group } = getBits(source);
  for (const [selector, selection] of [
    ['source', source],
    ['group', group],
    ['app', app],
  ]) {
    const notify = db.getNotificationFilter(did, selector, selection);
    if (notify === true) {
      console.info(`explicitly allowing notification by filter for ${selector}=${selection}`);
      break;
    };
    if (notify === false) {
      console.warn(`ignoring filtered notification for ${selector}=${selection}`);
      return;
    }
  }

  const subs = db.getSubsByDid(did);
  const payload = JSON.stringify({ subject, source, source_record, timestamp });
  try {
    await Promise.all(subs.map(pushSubscription => push(db, pushSubscription, payload)));
  } catch (e) {
    console.warn('at least one notification send failed', e);
  }
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

  return { updateSubs, push };
};
