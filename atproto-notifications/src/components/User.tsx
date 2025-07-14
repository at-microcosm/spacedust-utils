import { resolveDid } from '../atproto/resolve';
import { Fetch } from './fetch';

export function Handle({ did }) {
  return (
    <Fetch
      using={resolveDid}
      args={[did]}
      loading={() => <>@&hellip;</>}
      ok={handle => <>@{handle}</>}
    />
  );
}
