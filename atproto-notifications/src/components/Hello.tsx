import { useState } from 'react';

export function Hello({ onSetUser }) {
  const [userVal, setUserVal] = useState('');
  return (
    <div className="hello card">
      <label>
        <input />
      </label>
      <button onClick={() => {}}>
        count is
      </button>
    </div>
  );
}