import { useEffect, useState } from 'react';
import Sender from './components/Sender';
import Receiver from './components/Receiver';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import { useAuth } from './context/AuthContext';
import socket from './socket';

function BrandHeader({ user, onSignOut }) {
  return (
    <header className="topbar">
      <div className="brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L4 5v6c0 5.25 3.4 9.74 8 11 4.6-1.26 8-5.75 8-11V5l-8-3z" fill="#004ac6" />
        </svg>
        <span>SecureShare</span>
      </div>
      {user ? (
        <div className="account-controls">
          <span className="account-email">{user.email}</span>
          <button className="auth-link" onClick={onSignOut}>Sign out</button>
        </div>
      ) : <span className="tag">P2P · no storage</span>}
    </header>
  );
}

function AuthGate() {
  const { user, loading, signOut } = useAuth();
  const [authView, setAuthView] = useState('login');

  if (loading) {
    return <div className="auth-loading">Restoring your secure session…</div>;
  }

  if (!user) {
    return authView === 'login'
      ? <LoginPage onShowSignUp={() => setAuthView('signup')} />
      : <SignUpPage onShowLogin={() => setAuthView('login')} />;
  }

  return <SecureShareApp user={user} onSignOut={signOut} />;
}

function SecureShareApp({ user, onSignOut }) {
  const [view, setView] = useState('pick');
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
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
      <div className="app-shell">
        <BrandHeader user={user} onSignOut={onSignOut} />
        <div className="connection-loading">
          <div className="dot pulsing" />
          <h2>Waking up the server...</h2>
          <p>Because this is hosted on a free tier, the backend goes to sleep when not in use. It should take about 30–50 seconds to wake up. Hang tight!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <BrandHeader user={user} onSignOut={onSignOut} />
      <main className="wrap">
        {view === 'pick' && (
          <section id="mode-picker">
            <h1>Send a file, straight to another device.</h1>
            <p className="sub">No upload, no server storage. The file goes directly from your browser to theirs.</p>
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
      <footer className="foot">Files never touch a server — this connection is direct, browser to browser.</footer>
    </div>
  );
}

export default function App() {
  return <AuthGate />;
}
