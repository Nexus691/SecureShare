import { useEffect, useState } from 'react';
import Sender from './components/Sender';
import Receiver from './components/Receiver';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import FriendsView from './components/FriendsView';
import HistoryView from './components/HistoryView';
import NotificationBell from './components/NotificationBell';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import socket from './socket';

function BrandHeader({ user, onSignOut, tab, onTabChange }) {
  return (
    <header className="topbar">
      <div className="brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L4 5v6c0 5.25 3.4 9.74 8 11 4.6-1.26 8-5.75 8-11V5l-8-3z" fill="#004ac6" />
        </svg>
        <span>SecureShare</span>
      </div>
      {user ? (
        <>
          <div className="nav-tabs" style={{ display: 'flex', gap: '1rem', marginLeft: '2rem', flex: 1 }}>
            <button
              className={`nav-tab ${tab === 'transfer' ? 'active' : ''}`}
              onClick={() => onTabChange('transfer')}
              style={{ padding: '0.5rem 1rem', background: tab === 'transfer' ? '#f0f4ff' : 'transparent', color: tab === 'transfer' ? '#004ac6' : '#6b7280', borderRadius: '0.5rem', fontWeight: 500 }}
            >
              Transfer
            </button>
            <button
              className={`nav-tab ${tab === 'history' ? 'active' : ''}`}
              onClick={() => onTabChange('history')}
              style={{ padding: '0.5rem 1rem', background: tab === 'history' ? '#f0f4ff' : 'transparent', color: tab === 'history' ? '#004ac6' : '#6b7280', borderRadius: '0.5rem', fontWeight: 500 }}
            >
              History
            </button>
            <button
              className={`nav-tab ${tab === 'friends' ? 'active' : ''}`}
              onClick={() => onTabChange('friends')}
              style={{ padding: '0.5rem 1rem', background: tab === 'friends' ? '#f0f4ff' : 'transparent', color: tab === 'friends' ? '#004ac6' : '#6b7280', borderRadius: '0.5rem', fontWeight: 500 }}
            >
              Friends
            </button>
          </div>
          <div className="account-controls">
            <span className="account-email">{user.email}</span>
            <button className="auth-link" onClick={onSignOut}>Sign out</button>
          </div>
        </>
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
  const [tab, setTab] = useState('transfer');
  const [view, setView] = useState('pick');
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onNotification = (data) => {
      setUnreadCount((c) => c + 1);
      setNotifications((n) => [data.notification, ...n]);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('notification', onNotification);

    if (user) {
      api.getUnreadNotificationCount().then(res => setUnreadCount(res.count)).catch(() => {});
      api.getNotifications({ limit: 20 }).then(res => setNotifications(res.notifications)).catch(() => {});
    }

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInitialRoomCode(roomParam.toUpperCase());
      setTab('transfer');
      setView('receive');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification', onNotification);
    };
  }, []);

  if (!isConnected) {
    return (
      <div className="app-shell">
        <BrandHeader user={user} onSignOut={onSignOut} tab={tab} onTabChange={setTab} />
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
      <BrandHeader user={user} onSignOut={onSignOut} tab={tab} onTabChange={setTab} />
      <main className="wrap" style={{ maxWidth: tab === 'friends' ? '800px' : undefined }}>
        {tab === 'transfer' ? (
          <>
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
          </>
        ) : tab === 'history' ? (
          <HistoryView user={user} />
        ) : (
          <FriendsView user={user} />
        )}
      </main>
      {tab === 'transfer' && (
        <footer className="foot">Files never touch a server — this connection is direct, browser to browser.</footer>
      )}
      <NotificationBell
        unreadCount={unreadCount}
        notifications={notifications}
        showNotifications={showNotifications}
        onToggle={() => setShowNotifications(!showNotifications)}
        onMarkRead={(id) => {
          setNotifications((n) => n.map((n) => n._id === id ? {...n, read: true} : n));
          setUnreadCount((c) => Math.max(0, c - 1));
        }}
      />
    </div>
  );
}

export default function App() {
  return <AuthGate />;
}
