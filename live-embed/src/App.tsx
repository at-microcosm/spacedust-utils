import { useEffect, useState } from 'react';
import { Post } from './Post';
import { rotatingPair } from './samplePosts';
import { Spacedust } from './spacedust';

import './App.css'

function App() {
  const [currentPair, setCurrentPair] = useState([]);
  const [updates, setUpdates] = useState({});

  useEffect(() => {
    let iMightBeAZombie = false;

    const spacedust = new Spacedust(handleLink);
    const cancelRotation = rotatingPair(updatedPair => {
      if (iMightBeAZombie) return;

      setCurrentPair(updatedPair);
      spacedust.setSubjects(updatedPair);
      setUpdates(current => { // cleanup, probably should combine with pair directly
        const next = {};
        updatedPair.forEach(uri => next[uri] = current[uri] ?? {});
        return next;
      });
    });

    function handleLink({ subject, source }) {
      setUpdates(current => ({
        ...current,
        [subject]: {
          ...current[subject],
          [source]: (current[subject][source] ?? 0) + 1
        },
      }));
    }

    return () => {
      cancelRotation();
      spacedust.close();
      iMightBeAZombie = true;
    };
  }, []);

  return (
    <>
      <h1>live post interactions</h1>
      {currentPair.map(p => (
        <Post key={p} atUri={p} updatedLinks={updates[p]} />
      ))}
    </>
  )
}

export default App
