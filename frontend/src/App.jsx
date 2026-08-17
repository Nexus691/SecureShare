import { useState } from 'react';
import Sender from './components/Sender';
import Receiver from './components/Receiver';

export default function App() {
  const [view, setView] = useState('pick'); // 'pick' | 'send' | 'receive'

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
        {view === 'receive' && <Receiver onBack={() => setView('pick')} />}
      </main>

      <footer className="foot">
        Files never touch a server — this connection is direct, browser to browser.
      </footer>
    </div>
  );
}
