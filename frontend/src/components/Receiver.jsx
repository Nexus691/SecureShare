import { useState, useEffect } from 'react';
import { useReceiver } from '../hooks/useWebRTC';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function Receiver({ onBack, initialCode = '' }) {
  const [code, setCode] = useState(initialCode);
  const [phase, setPhase] = useState('idle'); // idle | joined | receiving | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const [fileMeta, setFileMeta] = useState(null);
  const [progress, setProgress] = useState(0);
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [joining, setJoining] = useState(false);

  const { joinRoom, cancelTransfer } = useReceiver({
    onMeta: (meta) => {
      setFileMeta(meta);
      setPhase('receiving');
    },
    onProgress: (pct) => setProgress(pct),
    onComplete: (blob, name) => {
      const url = URL.createObjectURL(blob);
      setDownloadInfo({ url, name });
      setProgress(100);
      setPhase('done');
      setStatusMsg('Transfer complete ✓');
    },
    onPeerLeft: () => setStatusMsg('Sender disconnected.'),
  });

  const handleJoin = (codeToJoin = code) => {
    const trimmed = codeToJoin.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setStatusMsg('Enter the 6-character code.');
      return;
    }
    setJoining(true);
    setStatusMsg('Connecting…');

    joinRoom(trimmed, (res) => {
      if (res.error) {
        setStatusMsg(res.error);
        setPhase('error');
        setJoining(false);
        return;
      }
      setFileMeta(res.fileMeta);
      setPhase('joined');
      setJoining(false);
      setStatusMsg('Waiting for sender to connect…');
    });
  };

  // Auto-join if opened via share link
  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      handleJoin(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  return (
    <section id="receive-view">
      <button className="back-link" onClick={onBack}>← Back</button>

      <div className="card">
        <div className="center-icon">🔒</div>
        <h2 className="card-title">Enter the code</h2>
        <p className="card-sub">Ask the sender for their 6-character share code.</p>

        <div className="code-input-row">
          <input
            type="text"
            id="code-input"
            maxLength={6}
            placeholder="ABC123"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && !joining && handleJoin()}
          />
          <button
            id="join-btn"
            className="btn-primary"
            onClick={() => handleJoin()}
            disabled={joining || code.trim().length !== 6}
          >
            Connect
          </button>
        </div>

        {statusMsg && (
          <div className="status-line" id="receive-status-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {(phase === 'joined' || phase === 'receiving') && <span className="dot pulsing"></span>}
              {phase === 'done' && <span className="dot connected"></span>}
              &nbsp;{statusMsg}
            </div>
            {(phase === 'joined' || phase === 'receiving') && (
              <button 
                onClick={() => { cancelTransfer(); onBack(); }}
                style={{ background: 'none', border: 'none', color: '#dc3545', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {(phase === 'joined' || phase === 'receiving' || phase === 'done') && fileMeta && (
          <div id="incoming-block">
            <div className="file-row">
              <div className="file-icon">📄</div>
              <div className="file-meta">
                <div id="recv-filename" className="file-name">{fileMeta.name}</div>
                <div id="recv-filesize" className="file-size">{formatBytes(fileMeta.size)}</div>
              </div>
            </div>
            <div className="progress-track">
              <div className="progress-fill" id="recv-progress" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="progress-pct" id="recv-progress-pct">{progress}%</div>

            {phase === 'done' && downloadInfo && (
              <a
                id="download-link"
                className="btn-primary download-btn"
                href={downloadInfo.url}
                download={downloadInfo.name}
              >
                Save File
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
