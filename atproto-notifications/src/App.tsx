import { useLocalStorage } from "@uidotdev/usehooks";
import { HostContext } from './context'
import { Hello } from './components/Hello';
import './App.css'

function App() {
  const [host, setHost] = useLocalStorage('spacedust-notif-host', 'http://localhost:8000');
  const [user, setUser] = useLocalStorage('spacedust-notif-user', null);

  return (
    <HostContext.Provider value={host}>
      <h1>🎇 atproto notifications demo</h1>

      {user === null && (
        <Hello onSetUser={setUser} />
      )}
    </HostContext.Provider>
  )
}

export default App
