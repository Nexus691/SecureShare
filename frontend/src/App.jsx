import { useState, useEffect } from 'react';
import Sender from './components/Sender';
import Receiver from './components/Receiver';
import socket from './socket';

export default function App() {
  const [view, setView] = useState('pick'); // 'pick' | 'send' | 'receive'
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    // Listen for socket connection status
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInitialRoomCode(roomParam.toUpperCase());
      setView('receive');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  if (!isConnected) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px' }}>
        <div className="dot pulsing" style={{ width: '16px', height: '16px', marginBottom: '24px' }}></div>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '24px', marginBottom: '12px', color: 'var(--primary)' }}>Waking up the server...</h2>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '15px', maxWidth: '400px', lineHeight: '1.5' }}>
          Because this is hosted on a free tier, the backend goes to sleep when not in use. It should take about 30–50 seconds to wake up. Hang tight!
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="topbar">
        <div className="brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 5v6c0 5.25 3.4 9.74 8 11 4.6-1.26 8-5.75 8-11V5l-8-3z" fill="#004ac6"/>
          </svg>
          <span>SecureShare</span>
        </div>
        <span className="tag">P2P · no storage</span>
      </header>

      <main className="wrap">
        {view === 'pick' && (
          <section id="mode-picker">
            <h1>Send a file, straight to another device.</h1>
            <p className="sub">No upload, no account, no server storage. The file goes directly from your browser to theirs.</p>
            <div className="mode-cards">
              <button className="mode-card" id="pick-send" onClick={() => setView('send')}>
                <span className="icon">⭱</span>
                <span className="mode-title">Send</span>
                <span className="mode-desc">Pick a file, get a code</span>
              </button>
              <button className="mode-card" id="pick-receive" onClick={() => setView('receive')}>
                <span className="icon">⭳</span>
                <span className="mode-title">Receive</span>
                <span className="mode-desc">Enter a code, get the file</span>
              </button>
            </div>
          </section>
        )}

        {view === 'send' && <Sender onBack={() => setView('pick')} />}
        {view === 'receive' && <Receiver onBack={() => setView('pick')} initialCode={initialRoomCode} />}
      </main>

      <footer className="foot">
        Files never touch a server — this connection is direct, browser to browser.
      </footer>
    </div>
  );
}
