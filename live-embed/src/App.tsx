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
      <h1>zero bluesky infra post rendering (WIP)</h1>
      <p className="with">with real-time interaction count updates</p>
      <div className="posts">
        {currentPair.map(p => (
          <Post key={p} atUri={p} updatedLinks={updates[p]} />
        ))}
      </div>

      <div className="explain">
        <h2>How does it work?</h2>
        <ul>
          <li><strong>Post content</strong>: fetches direct from PDS with <a href="https://github.com/mary-ext/atcute" target="_blank">atcute</a>.</li>
          <li><strong>Interaction counts</strong>: queries <a href="https://constellation.microcosm.blue/" target="_blank">constellation</a>.</li>
          <li><strong>Interaction updates</strong>: subscribes to <a href="https://spacedust.microcosm.blue/" target="_blank">spacedust</a>.</li>
          <li>There is no backend.</li>
        </ul>
        <p>The post selection takes a couple top posts from the public bluesky Discover feed so I guess it's kind of cheating but hey.</p>
        <p>Oh and media files load from Bluesky's CDN so that's also cheating.</p>

        <h2>If you actually want to embed a post</h2>
        <p>See <a href="https://mary-ext.codeberg.page/bluesky-embed/" target="_blank"><code>&lt;bluesky-embed&gt;</code></a> from <a href="https://mary.my.id" target="_blank">mary</a>. It's a very solid post renderer, unlike this demo.</p>
      </div>

    </>
  )
}

export default App
