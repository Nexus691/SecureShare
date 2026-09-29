import { useState, useRef, useCallback } from 'react';
import { useSender } from '../hooks/useWebRTC';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function Sender({ onBack, selectedFriend = null }) {
  const { user } = useAuth();
  const [file, setFileState] = useState(null);
  const [roomCode, setRoomCode] = useState('------');
  const [phase, setPhase] = useState('idle'); // idle | waiting | transferring | done
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Waiting for someone to enter this code…');
  const [dragover, setDragover] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);
  const [password, setPassword] = useState('');

  const { createRoom, createFriendRoom, setFile, cancelTransfer } = useSender({
    onPeerJoined: () => setStatusMsg('Receiver connected — establishing secure link…'),
    onProgress: (pct) => {
      setProgress(pct);
      setPhase('transferring');
    },
    onComplete: () => {
      setProgress(100);
      setPhase('done');
      
      // Log history
      if (file) {
        api.logHistory({
          roomCode,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          senderId: user?.id,
          status: 'completed'
        }).then(() => {
          window.dispatchEvent(new CustomEvent('refresh-history'));
        }).catch(err => console.error('Failed to log history:', err));
      }
    },
    onPeerLeft: (role) => {
      if (role === 'declined') {
        setStatusMsg(`${selectedFriend?.displayName || 'Friend'} declined the file transfer.`);
        setPhase('error');
      } else {
        setStatusMsg('Receiver canceled or disconnected.');
        setPhase('error');
      }
    },
  });

  const handleFileSelected = useCallback((f) => {
    setFileState(f);
    setFile(f);
    setPhase('waiting');
    setProgress(0);

    if (selectedFriend) {
      setStatusMsg(`Waiting for ${selectedFriend.displayName} to accept…`);
      createFriendRoom(f, user?.id, selectedFriend.id, undefined, ({ code, error }) => {
        if (error) {
          setStatusMsg(error);
          return;
        }
        setRoomCode(code);
      });
      return;
    }

    createRoom(f, user?.id, password || undefined, ({ code }) => setRoomCode(code));
  }, [createRoom, createFriendRoom, setFile, user, password, selectedFriend]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files.length) handleFileSelected(e.dataTransfer.files[0]);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="send-view">
      <button className="back-link" onClick={onBack}>← Back</button>

      {!file ? (
        <div
          id="send-dropzone"
          className={`dropzone${dragover ? ' dragover' : ''}`}
          onClick={() => fileInputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={handleDrop}
        >
          <div className="dz-icon">☁↑</div>
          <div className="dz-title">{selectedFriend ? `Send a file to ${selectedFriend.displayName}` : 'Drag and drop a file here'}</div>
          <div className="dz-sub">{selectedFriend ? 'Drop or choose one file — they get a one-click accept notification' : 'or click to browse'}</div>
          
          {/* Password input before file selection - hidden for friend transfers */}
          {!selectedFriend && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--outline-variant)' }}
            >
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', color: 'var(--on-surface-variant)' }}>
                Optional password (leave empty for no password)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to protect this transfer"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface)', color: 'var(--on-surface)', fontSize: '14px' }}
              />
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            id="file-input"
            hidden
            onChange={(e) => e.target.files[0] && handleFileSelected(e.target.files[0])}
          />
        </div>
      ) : (
        <div id="send-status" className="card">
          <div className="file-row">
            <div className="file-icon">📄</div>
            <div className="file-meta">
              <div id="send-filename" className="file-name">{file.name}</div>
              <div id="send-filesize" className="file-size">{formatBytes(file.size)}</div>
            </div>
          </div>

          {phase === 'error' && (
            <div style={{ color: 'var(--error)', marginTop: '16px', textAlign: 'center', padding: '12px', background: '#ffdad6', borderRadius: '8px' }}>
              {statusMsg}
            </div>
          )}

          {/* Waiting block */}
          {phase === 'waiting' && (
            <div id="waiting-block">
              {selectedFriend ? (
                <>
                  <div className="code-label">Transfer request sent to</div>
                  <div className="room-code" id="room-code" style={{ fontSize: '24px' }}>{selectedFriend.displayName}</div>
                </>
              ) : (
                <>
                  <div className="code-label">Share this code with the receiver</div>
                  <div
                    className="room-code"
                    id="room-code"
                    onClick={() => {
                      navigator.clipboard.writeText(roomCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Click to copy code"
                  >
                    {roomCode}
                  </div>
                  {copied && (
                    <div style={{ textAlign: 'center', color: 'var(--primary)', fontSize: '12px', marginTop: '-12px', marginBottom: '16px' }}>
                      Code copied!
                    </div>
                  )}
                </>
              )}
              
              {password && (
                <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f4ff', borderRadius: '8px', border: '1px solid var(--outline-variant)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 500 }}>
                    🔒 This transfer is password protected
                  </div>
                </div>
              )}

              {!selectedFriend && (
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <button
                    className="btn-primary"
                    onClick={copyLink}
                    style={{ fontSize: '13px', padding: '8px 16px', background: 'var(--surface-container-low)', color: 'var(--primary)', border: '1px solid var(--outline-variant)' }}
                  >
                    {copied ? '✓ Copied!' : '🔗 Copy Share Link'}
                  </button>
                </div>
              )}

              <div className="status-line" id="send-status-line">
                <span className="dot pulsing"></span> {statusMsg}
              </div>
            </div>
          )}

          {/* Transfer block */}
          {(phase === 'transferring' || phase === 'done') && (
            <div id="transfer-block">
              <div className="status-line" id="send-transfer-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{phase === 'done' ? 'Transfer complete ✓' : 'Sending…'}</span>
                {phase === 'transferring' && (
                  <button
                    onClick={() => { cancelTransfer(); onBack(); }}
                    style={{ background: 'none', border: 'none', color: '#dc3545', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="progress-track">
                <div className="progress-fill" id="send-progress" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-pct" id="send-progress-pct">{progress}%</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
