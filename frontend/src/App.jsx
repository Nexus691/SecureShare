import { useEffect, useState } from 'react';
import Sender from './components/Sender';
import Receiver from './components/Receiver';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import FriendsView from './components/FriendsView';
import HistoryView from './components/HistoryView';
import NotificationBell from './components/NotificationBell';
import ProfileView from './components/ProfileView';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import socket from './socket';

function BrandHeader({ user, onSignOut, tab, onTabChange, unreadCount, notifications, showNotifications, onToggleNotifications, onMarkRead }) {
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
          <div className="nav-tabs">
            <button
              className={`nav-tab ${tab === 'transfer' ? 'active' : ''}`}
              onClick={() => onTabChange('transfer')}
            >
              Transfer
            </button>
            <button
              className={`nav-tab ${tab === 'history' ? 'active' : ''}`}
              onClick={() => onTabChange('history')}
            >
              History
            </button>
            <button
              className={`nav-tab ${tab === 'friends' ? 'active' : ''}`}
              onClick={() => onTabChange('friends')}
            >
              Friends
            </button>
          <button
            className={`nav-tab ${tab === 'profile' ? 'active' : ''}`}
            onClick={() => onTabChange('profile')}
          >
            Profile
          </button>
          </div>
          <div className="account-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <NotificationBell
              unreadCount={unreadCount}
              notifications={notifications}
              showNotifications={showNotifications}
              onToggle={onToggleNotifications}
              onMarkRead={onMarkRead}
            />
            <div className="profile-trigger" onClick={() => onTabChange('profile')} title="Profile">
              {user.photoUrl ? (
                <img src={user.photoUrl} alt="Profile" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e5edff', color: '#004ac6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {(user.displayName || 'U').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="account-name">{user.displayName}</span>
            </div>
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
  const [view, setView] = useState('pick'); // pick | send | receive
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    
    // Listen for file-transfer-request via socket for immediate UI response
    const onTransferRequest = (data) => {
      // This allows immediate response even if the DB notification is slightly delayed
      console.log('Incoming transfer request:', data);
    };

    const onNotification = (data) => {
      setUnreadCount((c) => c + 1);
      setNotifications((n) => [data.notification, ...n]);
      
      // Auto-refresh relevant views based on notification type
      if (data.type === 'friend_request' || data.type === 'friend_accepted') {
        window.dispatchEvent(new CustomEvent('refresh-friends'));
      } else if (data.type === 'history_updated') {
        window.dispatchEvent(new CustomEvent('refresh-history'));
      }
      if (data.type === 'history_updated') { // Assuming we add this soon
        window.dispatchEvent(new CustomEvent('refresh-history'));
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('notification', onNotification);
    socket.on('file-transfer-request', onTransferRequest);

    // Listen for custom events from NotificationBell
    const onAcceptTransfer = (e) => {
      const { roomCode, password } = e.detail;
      socket.emit('file-transfer-response', { roomCode, accept: true, userId: user?.id }, (res) => {
        if (res.error) {
          alert(res.error);
        } else if (res.proceedToJoin) {
          setInitialRoomCode(roomCode);
          setTab('transfer');
          setView('receive');
          setShowNotifications(false);
        }
      });
    };
    
    const onDeclineTransfer = (e) => {
      const { roomCode } = e.detail;
      socket.emit('file-transfer-response', { roomCode, accept: false, userId: user?.id }, () => {
        setShowNotifications(false);
      });
    };

    const onAcceptFriend = async (e) => {
      const { requestId } = e.detail;
      try {
        await api.acceptFriendRequest(requestId);
        window.dispatchEvent(new CustomEvent('refresh-friends'));
      } catch (err) {
        console.error('Failed to accept friend via notification', err);
      }
    };

    const onDeclineFriend = async (e) => {
      const { requestId } = e.detail;
      try {
        await api.declineFriendRequest(requestId);
        window.dispatchEvent(new CustomEvent('refresh-friends'));
      } catch (err) {
        console.error('Failed to decline friend via notification', err);
      }
    };

    window.addEventListener('accept-transfer', onAcceptTransfer);
    window.addEventListener('decline-transfer', onDeclineTransfer);
    window.addEventListener('accept-friend', onAcceptFriend);
    window.addEventListener('decline-friend', onDeclineFriend);

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
      socket.off('file-transfer-request', onTransferRequest);
      window.removeEventListener('accept-transfer', onAcceptTransfer);
      window.removeEventListener('decline-transfer', onDeclineTransfer);
      window.removeEventListener('accept-friend', onAcceptFriend);
      window.removeEventListener('decline-friend', onDeclineFriend);
    };
  }, [user]);

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
      <BrandHeader
        user={user}
        onSignOut={onSignOut}
        tab={tab}
        onTabChange={setTab}
        unreadCount={unreadCount}
        notifications={notifications}
        showNotifications={showNotifications}
        onToggleNotifications={() => setShowNotifications(!showNotifications)}
        onMarkRead={(id) => {
          setNotifications((n) => n.map((n) => n._id === id ? {...n, read: true} : n));
          setUnreadCount((c) => Math.max(0, c - 1));
        }}
      />
      <main className="wrap" style={{ maxWidth: tab === 'friends' ? '800px' : undefined }}>
        {tab === 'profile' ? (
          <ProfileView onClose={() => setTab('transfer')} />
        ) : tab === 'transfer' ? (
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
            {view === 'send' && <Sender onBack={() => { setView('pick'); setSelectedFriend(null); }} selectedFriend={selectedFriend} />}
            {view === 'receive' && <Receiver onBack={() => setView('pick')} initialCode={initialRoomCode} />}
          </>
        ) : tab === 'history' ? (
          <HistoryView user={user} />
        ) : (
          <FriendsView
            user={user}
            onSendFile={(friend) => {
              setSelectedFriend(friend);
              setView('send');
              setTab('transfer');
            }}
          />
        )}
      </main>
      {tab === 'transfer' && (
        <footer className="foot">Files never touch a server — this connection is direct, browser to browser.</footer>
      )}
    </div>
  );
}

export default function App() {
  return <AuthGate />;
}
