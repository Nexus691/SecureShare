import { useEffect, useRef } from 'react';
import { api } from '../lib/api';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    hour12: true
  });
}
export default function NotificationBell({
  unreadCount,
  notifications,
  showNotifications,
  onToggle,
  onMarkRead,
  onMarkAllRead
}) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (showNotifications) onToggle();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications, onToggle]);

  const handleMarkRead = async (e, id) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      onMarkRead(id);
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      onMarkAllRead?.();
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={onToggle}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%'
        }}
        className={showNotifications ? 'active-bell' : ''}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: 'red',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '10px',
            minWidth: '16px',
            textAlign: 'center'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          width: '320px',
          maxHeight: '400px',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--outline-variant)'
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--outline-variant)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Notifications</h3>
              {notifications.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                No notifications
              </div>
            ) : (
              notifications.map((n) => {
                const isTransferRequest = n.type === 'file_transfer_request';
                const isFriendRequest = n.type === 'friend_request';

                return (
                  <div
                    key={n._id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--outline-variant)',
                      background: n.read ? '#fff' : '#f0f4ff',
                      cursor: n.read && (!isTransferRequest && !isFriendRequest) ? 'default' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                    onClick={(e) => {
                      if (!n.read) {
                        handleMarkRead(e, n._id);
                        if (isTransferRequest || isFriendRequest) {
                          e.stopPropagation();
                        }
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: n.read ? 'normal' : '600', fontSize: '14px', color: 'var(--on-surface)' }}>
                        {n.title}
                      </div>
                      {!n.read && (
                        <div style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', flexShrink: 0, marginTop: '4px' }} />
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                      {n.message}
                    </div>

                    {isTransferRequest && !n.read && n.data?.roomCode && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          className="btn-primary"
                          style={{ padding: '4px 12px', fontSize: '12px', flex: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(e, n._id);

                            window.dispatchEvent(new CustomEvent('accept-transfer', { detail: n.data }));
                          }}
                        >
                          Accept
                        </button>
                        <button
                          style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            background: 'var(--surface-container-low)',
                            color: 'var(--on-surface)',
                            border: '1px solid var(--outline-variant)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            flex: 1
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(e, n._id);

                            window.dispatchEvent(new CustomEvent('decline-transfer', { detail: n.data }));
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {isFriendRequest && !n.read && n.data?.requestId && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          className="btn-primary"
                          style={{ padding: '4px 12px', fontSize: '12px', flex: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(e, n._id);
                            window.dispatchEvent(new CustomEvent('accept-friend', { detail: n.data }));
                          }}
                        >
                          Accept
                        </button>
                        <button
                          style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            background: 'var(--surface-container-low)',
                            color: 'var(--on-surface)',
                            border: '1px solid var(--outline-variant)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            flex: 1
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(e, n._id);
                            window.dispatchEvent(new CustomEvent('decline-friend', { detail: n.data }));
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                      {formatDate(n.createdAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
