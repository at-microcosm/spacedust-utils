import ReactTimeAgo from 'react-time-ago';
import psl from 'psl';
import lexicons from 'lexicons';
import { resolveDid } from '../atproto/resolve';
import { Fetch } from './Fetch';

import './Notification.css';

export function Notification({ app, group, source, source_record, source_did, subject, timestamp }) {

  // TODO: clean up / move this to lexicons package?
  let title = source;
  let icon;
  let appName;
  let appPrefix;
  try {
    appPrefix = app.split('.').toReversed().join('.');
  } catch (e) {
    console.error('getting top app failed', e);
  }
  const lex = lexicons[appPrefix];
  icon = lex?.clients[0]?.icon;
  let link = lex?.clients[0]?.notifications;
  appName = lex?.name;
  const sourceRemainder = source.slice(app.length + 1);
  title = lex?.known_sources[sourceRemainder] ?? source;

  let directLink;
  if (subject.startsWith('did:')) {

    const s = source_record.slice('at://'.length).split('/');
    const [sDid, sCollection, sRest] = [s[0], s[1], s.slice(2)]; // yeah did might be a handle oh well

    directLink = lex
      ?.clients[0]
      ?.direct_links?.[`did:${sourceRemainder}`]
      ?.replace('{subject.did}', subject)
      ?.replace('{source_record.did}', sDid)
      ?.replace('{source_record.collection}', sCollection)
      ?.replace('{source_record.rkey}', sRest.join('/') || null);

  } else if (subject.startsWith('at://')) {
    let s = subject.slice('at://'.length).split('/');
    const [did, collection, rest] = [s[0], s[1], s.slice(2)]; // yeah did might be a handle oh well

    s = source_record.slice('at://'.length).split('/');
    const [sDid, sCollection, sRest] = [s[0], s[1], s.slice(2)]; // yeah did might be a handle oh well

    directLink = lex
      ?.clients[0]
      ?.direct_links[`at_uri:${sourceRemainder}`]
      ?.replace('{subject.did}', did)
      ?.replace('{subject.collection}', collection)
      ?.replace('{subject.rkey}', rest.join('/') || null)
      ?.replace('{source_record.did}', sDid)
      ?.replace('{source_record.collection}', sCollection)
      ?.replace('{source_record.rkey}', sRest.join('/') || null);
  }
  link = directLink ?? link;

  const contents = (
    <>
      <div className="notification-info">
        {icon && (
          <img className="app-icon" src={icon} title={appName ?? app} alt="" />
        )}
        {title} from
        {' '}
        {source_did ? (
          <Fetch
            using={resolveDid}
            args={[source_did]}
            ok={handle => <span className="handle">@{handle}</span>}
          />
        ) : (
          source_record
        )}
      </div>
      {timestamp && (
        <div className="notification-when">
          <ReactTimeAgo date={new Date(timestamp)} locale="en-US"/>
        </div>
      )}
    </>
  );

  return link
    ? <a className="notification" href={link} target="_blank">
        {contents}
      </a>
    : <div className="notification">{contents}</div>;
}
