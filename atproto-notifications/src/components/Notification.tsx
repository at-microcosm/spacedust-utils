import { useState, useEffect } from 'react';
import ReactTimeAgo from 'react-time-ago';
import psl from 'psl';
import { default as lexicons, getLink, getContext } from 'lexicons';
import { resolveDid } from '../atproto/resolve';
import { Fetch } from './Fetch';

import './Notification.css';

export function fallbackRender({ error, resetErrorBoundary }) {
  console.error('rendering fallback for error', error);
  return (
    <div className="notification error">
      <p>sorry, something went wrong trying to show this notification</p>
      <p><button onClick={resetErrorBoundary}>retry</button></p>
    </div>
  );
}

export function Notification({ app, group, source, source_record, source_did, subject, timestamp }) {
  const [resolvedLink, setResolvedLink] = useState(null);
  const [resolvedContext, setResolvedContext] = useState([]);

  useEffect(() => {
    (async () => {
      const link = await getLink(source, source_record, subject);
      if (link) setResolvedLink(link);
    })();
    (async() => {
      const context = await getContext(source, source_record, subject);
      setResolvedContext(context);
    })();
  }, [source, source_record, subject]);

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
  title = lex?.known_sources[sourceRemainder]?.name ?? source;

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
      ?.direct_links?.[`at_uri:${sourceRemainder}`]
      ?.replace('{subject.did}', did)
      ?.replace('{subject.collection}', collection)
      ?.replace('{subject.rkey}', rest.join('/') || null)
      ?.replace('{source_record.did}', sDid)
      ?.replace('{source_record.collection}', sCollection)
      ?.replace('{source_record.rkey}', sRest.join('/') || null);
  }
  link = resolvedLink ?? directLink ?? link;

  let contextClipped = resolvedContext.join(' ');
  if (contextClipped.length > 240) {
    contextClipped = contextClipped.slice(0, 239) + '…';
  }

  const contents = (
    <>
      <div className="notification-info">
        {icon && (
          <img className="app-icon" src={icon} title={appName ?? app} alt="" />
        )}
        <div>
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
          {contextClipped.length > 0 && (
            <p className="notification-context">{contextClipped}</p>
          )}
        </div>
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
