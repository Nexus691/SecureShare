import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function FriendsView({ onSendFile }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [friendsRes, reqRes] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
      ]);
      setFriends(friendsRes.friends || []);
      setRequests(reqRes || { incoming: [], outgoing: [] });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    const onRefresh = () => loadData();
    window.addEventListener('refresh-friends', onRefresh);
    return () => window.removeEventListener('refresh-friends', onRefresh);
  }, []);

  const sendRequest = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    try {
      setError(null);
      setSuccessMsg(null);
      await api.sendFriendRequest(emailInput.trim());
      setSuccessMsg(`Friend request sent to ${emailInput}`);
      setEmailInput('');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await api.acceptFriendRequest(requestId);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDecline = async (requestId) => {
    try {
      await api.declineFriendRequest(requestId);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendFile = (friend) => {
    onSendFile?.(friend);
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
      await api.removeFriend(friendId);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--on-surface-variant)' }}>
        Loading friends...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Add Friend Form */}
      <section className="card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Add Friend</h3>
        <form onSubmit={sendRequest} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Friend's email address"
            required
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--outline-variant)',
              background: 'var(--surface)',
              color: 'var(--on-surface)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '14px', whiteSpace: 'nowrap' }}
          >
            Send Request
          </button>
        </form>
        {error && (
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#dc3545' }}>{error}</p>
        )}
        {successMsg && (
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#28a745' }}>{successMsg}</p>
        )}
      </section>

      {/* Incoming Requests */}
      {requests.incoming.length > 0 && (
        <section>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Incoming Requests
            <span style={{
              background: '#e8f0fe',
              color: 'var(--primary)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              {requests.incoming.length}
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requests.incoming.map((r) => (
              <div
                key={r.id}
                className="card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '15px' }}>{r.from.displayName}</div>
                  <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{r.from.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleAccept(r.id)}
                    className="btn-primary"
                    style={{ padding: '6px 16px', fontSize: '13px' }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(r.id)}
                    style={{
                      padding: '6px 16px',
                      fontSize: '13px',
                      background: 'var(--surface-container-low)',
                      color: 'var(--on-surface)',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Outgoing Requests */}
      {requests.outgoing.length > 0 && (
        <section>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
            Sent Requests
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requests.outgoing.map((r) => (
              <div
                key={r.id}
                className="card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '15px' }}>{r.to.displayName}</div>
                  <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{r.to.email}</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
                  Pending…
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends List */}
      <section>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>My Friends</h3>
        {friends.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <h3>No friends yet</h3>
            <p style={{ color: 'var(--on-surface-variant)' }}>Send a friend request using their email address above.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #004ac6, #0066ff)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '16px',
                  }}>
                    {friend.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '15px' }}>{friend.displayName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{friend.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleSendFile(friend)}
                    className="btn-primary"
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  >
                    📤 Send File
                  </button>
                  <button
                    onClick={() => handleRemoveFriend(friend.id)}
                    title="Remove friend"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--on-surface-variant)',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      opacity: 0.5,
                      transition: 'opacity 0.2s, color 0.2s',
                    }}
                    onMouseEnter={(e) => { e.target.style.opacity = 1; e.target.style.color = '#dc3545'; }}
                    onMouseLeave={(e) => { e.target.style.opacity = 0.5; e.target.style.color = 'var(--on-surface-variant)'; }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
