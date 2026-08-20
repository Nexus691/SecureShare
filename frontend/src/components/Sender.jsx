import { useState, useRef, useCallback } from 'react';
import { useSender } from '../hooks/useWebRTC';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function Sender({ onBack }) {
  const [file, setFileState] = useState(null);
  const [roomCode, setRoomCode] = useState('------');
  const [phase, setPhase] = useState('idle'); // idle | waiting | transferring | done
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Waiting for someone to enter this code…');
  const [dragover, setDragover] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const { createRoom, setFile } = useSender({
    onPeerJoined: () => setStatusMsg('Receiver connected — establishing secure link…'),
    onProgress: (pct) => {
      setProgress(pct);
      setPhase('transferring');
    },
    onComplete: () => {
      setProgress(100);
      setPhase('done');
    },
    onPeerLeft: () => setStatusMsg('Receiver disconnected.'),
  });

  const handleFileSelected = useCallback((f) => {
    setFileState(f);
    setFile(f);
    setPhase('waiting');
    setProgress(0);
    createRoom(f, ({ code }) => setRoomCode(code));
  }, [createRoom, setFile]);

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
          <div className="dz-title">Drag and drop a file here</div>
          <div className="dz-sub">or click to browse</div>
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

          {/* Waiting block */}
          {phase === 'waiting' && (
            <div id="waiting-block">
              <div className="code-label">Share this code with the receiver</div>
              <div className="room-code" id="room-code">{roomCode}</div>
              
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <button 
                  className="btn-primary" 
                  onClick={copyLink}
                  style={{ fontSize: '13px', padding: '8px 16px', background: 'var(--surface-container-low)', color: 'var(--primary)', border: '1px solid var(--outline-variant)' }}
                >
                  {copied ? '✓ Copied!' : '🔗 Copy Share Link'}
                </button>
              </div>

              <div className="status-line" id="send-status-line">
                <span className="dot pulsing"></span> {statusMsg}
              </div>
            </div>
          )}

          {/* Transfer block */}
          {(phase === 'transferring' || phase === 'done') && (
            <div id="transfer-block">
              <div className="status-line" id="send-transfer-line">
                {phase === 'done' ? 'Transfer complete ✓' : 'Sending…'}
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
