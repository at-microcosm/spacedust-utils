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
  const link = lex?.clients[0]?.notifications;
  appName = lex?.name;
  title = lex?.known_sources[source.slice(app.length + 1)] ?? source;

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
