/**
 * useWebRTC — custom hook that encapsulates all WebRTC + Socket.io logic.
 * Keeps the Sender and Receiver components clean.
 */

import { useEffect, useRef, useCallback } from 'react';
import socket from '../socket';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CHUNK_SIZE = 16 * 1024; // 16 KB
const BUFFERED_AMOUNT_LOW_THRESHOLD = 1 * 1024 * 1024; // 1 MB

export function useSender({ onProgress, onComplete, onPeerJoined, onPeerLeft }) {
  const pcRef = useRef(null);
  const channelRef = useRef(null);

  const createRoom = useCallback((file, cb) => {
    socket.emit('create-room', { name: file.name, size: file.size, type: file.type }, cb);
  }, []);

  useEffect(() => {
    const handlePeerJoined = async ({ peerId }) => {
      onPeerJoined?.();
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('signal', { targetId: peerId, data: { type: 'ice', candidate: e.candidate } });
        }
      };

      const channel = pc.createDataChannel('file');
      channel.binaryType = 'arraybuffer';
      channelRef.current = channel;

      channel.onopen = () => {
        // file passed via ref below
        sendFile(channel);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { targetId: peerId, data: { type: 'offer', sdp: offer } });

      const handleSignal = async ({ from, data }) => {
        if (from !== peerId) return;
        if (data.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === 'ice') {
          try { await pc.addIceCandidate(data.candidate); } catch (_) {}
        }
      };
      socket.on('signal', handleSignal);
      // Cleanup stored so the effect cleanup can remove it
      pc.__signalHandler = handleSignal;
    };

    const handlePeerLeft = ({ role }) => onPeerLeft?.(role);

    socket.on('peer-joined', handlePeerJoined);
    socket.on('peer-left', handlePeerLeft);

    return () => {
      socket.off('peer-joined', handlePeerJoined);
      socket.off('peer-left', handlePeerLeft);
      if (pcRef.current?.__signalHandler) {
        socket.off('signal', pcRef.current.__signalHandler);
      }
      pcRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // File ref so the channel.onopen closure can access the latest file
  const fileRef = useRef(null);
  const setFile = (f) => { fileRef.current = f; };

  function sendFile(channel) {
    const file = fileRef.current;
    if (!file) return;

    channel.send(JSON.stringify({ type: 'meta', name: file.name, size: file.size, mime: file.type }));

    file.arrayBuffer().then((buffer) => {
      let offset = 0;

      function sendNextChunk() {
        while (offset < buffer.byteLength) {
          if (channel.bufferedAmount > BUFFERED_AMOUNT_LOW_THRESHOLD) {
            channel.onbufferedamountlow = () => {
              channel.onbufferedamountlow = null;
              sendNextChunk();
            };
            return;
          }
          const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
          channel.send(chunk);
          offset += chunk.byteLength;

          const pct = Math.min(100, Math.round((offset / buffer.byteLength) * 100));
          onProgress?.(pct);
        }
        channel.send(JSON.stringify({ type: 'done' }));
        onComplete?.();
      }

      channel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD / 2;
      sendNextChunk();
    });
  }

  return { createRoom, setFile };
}

export function useReceiver({ onMeta, onProgress, onComplete, onPeerLeft }) {
  const pcRef = useRef(null);
  const chunksRef = useRef([]);
  const receivedBytesRef = useRef(0);
  const expectedMetaRef = useRef(null);
  const senderPeerIdRef = useRef(null);

  useEffect(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    chunksRef.current = [];
    receivedBytesRef.current = 0;

    pc.onicecandidate = (e) => {
      if (e.candidate && senderPeerIdRef.current) {
        socket.emit('signal', {
          targetId: senderPeerIdRef.current,
          data: { type: 'ice', candidate: e.candidate },
        });
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      channel.binaryType = 'arraybuffer';
      channel.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'meta') {
            expectedMetaRef.current = msg;
            onMeta?.(msg);
          } else if (msg.type === 'done') {
            const blob = new Blob(chunksRef.current, {
              type: expectedMetaRef.current?.mime || 'application/octet-stream',
            });
            onComplete?.(blob, expectedMetaRef.current?.name || 'download');
          }
        } else {
          chunksRef.current.push(ev.data);
          receivedBytesRef.current += ev.data.byteLength;
          const total = expectedMetaRef.current?.size || 1;
          onProgress?.(Math.min(100, Math.round((receivedBytesRef.current / total) * 100)));
        }
      };
    };

    const handleSignal = async ({ from, data }) => {
      if (data.type === 'offer') {
        senderPeerIdRef.current = from;
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { targetId: from, data: { type: 'answer', sdp: answer } });
      } else if (data.type === 'ice') {
        try { await pc.addIceCandidate(data.candidate); } catch (_) {}
      }
    };

    const handlePeerLeft = ({ role }) => onPeerLeft?.(role);

    socket.on('signal', handleSignal);
    socket.on('peer-left', handlePeerLeft);

    return () => {
      socket.off('signal', handleSignal);
      socket.off('peer-left', handlePeerLeft);
      pc.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const joinRoom = useCallback((code, cb) => {
    socket.emit('join-room', code, cb);
  }, []);

  return { joinRoom };
}
