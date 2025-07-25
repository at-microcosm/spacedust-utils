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
        console.log('hi??');
        const next = {};
        updatedPair.forEach(uri => next[uri] = current[uri] ?? {});
        return next;
      });
    });

    function handleLink({ subject, source }) {
      console.log('i only run once', source, subject);

      setUpdates(current => {
        console.log('i run twice??', source, subject);
        const next = Object.assign({}, current);
        if (!next[subject][source]) next[subject][source] = 0;
        next[subject][source] += 1;
        return next;
      });
    }

    return () => {
      console.log('byeeee');
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
