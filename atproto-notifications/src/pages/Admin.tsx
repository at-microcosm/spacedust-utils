import { useContext } from 'react';
import { RoleContext } from '../context';

export function Admin({}) {
  const role = useContext(RoleContext);
  if (role !== 'admin') {
    return <p>sorry, this page is admin-only</p>
  }

  return 'sup';
}