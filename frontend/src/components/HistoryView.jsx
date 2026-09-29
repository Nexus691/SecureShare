import { useState, useEffect } from 'react';
import { api } from '../lib/api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

export default function HistoryView({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await api.getHistory();
      setHistory(res.history);
      setError('');
    } catch (err) {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="history-view" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '24px' }}>Transfer History</h2>
      
      {error && <div className="error-banner">{error}</div>}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--on-surface-variant)' }}>Loading...</div>
      ) : history.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗂️</div>
          <h3>No transfers yet</h3>
          <p style={{ color: 'var(--on-surface-variant)' }}>Files you send and receive will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {history.map((record) => {
            const isSender = record.senderId?._id === user.id;
            const otherUser = isSender ? record.receiverId : record.senderId;
            const direction = isSender ? 'Sent' : 'Received';
            const icon = isSender ? '↗️' : '↙️';
            
            return (
              <div key={record._id} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '24px', background: 'var(--surface-container-high)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {icon}
                </div>
                
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {record.fileName}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)', display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <span>{formatBytes(record.fileSize)}</span>
                    <span>•</span>
                    <span>{formatDate(record.createdAt)}</span>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isSender ? 'var(--primary)' : '#28a745' }}>
                    {direction}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                    {otherUser ? otherUser.displayName : 'Anonymous'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
