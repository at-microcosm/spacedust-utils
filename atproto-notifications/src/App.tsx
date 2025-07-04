import { useLocalStorage } from "@uidotdev/usehooks";
import { HostContext } from './context'
import { WhoAmI } from './components/WhoAmI';
import './App.css'

function App() {
  const [host, setHost] = useLocalStorage('spacedust-notif-host', 'http://localhost:8000');
  const [user, setUser] = useLocalStorage('spacedust-notif-user', null);

  return (
    <HostContext.Provider value={host}>
      <h1>🎇 atproto notifications demo</h1>

      {user === null
        ? (
          <WhoAmI onSetUser={setUser} />
        )
        : (
          <>
            <p>hi {user.handle}</p>
            <button onClick={() => setUser(null)}>clear</button>
          </>
        )}
    </HostContext.Provider>
  )
}

export default App
