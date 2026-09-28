# SecureShare P2P

> **Phase 1** — Browser-to-browser file transfer via WebRTC. No uploads, no accounts, no server storage.

## How it works

1. **Sender** picks a file → gets a 6-character room code
2. **Receiver** enters the code → WebRTC peer connection is established
3. File streams **directly** between the two browsers — the server never sees the bytes

The signaling server (Express + Socket.io) only exchanges room codes and WebRTC handshake data (SDP/ICE). Once peers connect, the server is out of the picture.

---

## Project Structure

```
secureshare-p2p/
├── backend/          # Node + Express + Socket.io signaling server
│   ├── server.js
│   └── package.json
└── frontend/         # Vite + React UI
    ├── src/
    │   ├── App.jsx
    │   ├── socket.js          # Shared socket.io-client instance
    │   ├── hooks/
    │   │   └── useWebRTC.js   # All WebRTC + signaling logic
    │   └── components/
    │       ├── Sender.jsx
    │       └── Receiver.jsx
    └── index.html
```

---

## Running locally

### 1. Backend (signaling server)
```bash
cd backend
npm install
node server.js
# → http://localhost:3000
```

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Open **two browser windows** at `localhost:5173`. Send a file from one, enter the code in the other.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Signaling server | Node.js, Express, Socket.io |
| P2P transport | WebRTC `RTCDataChannel` |
| Frontend | React (Vite) |
| Styling | Vanilla CSS (Plus Jakarta Sans, Inter, JetBrains Mono) |

---

## Roadmap

- [x] **Phase 1** — Real-time P2P transfer (this repo)
- [ ] **Phase 2** — Secure async link sharing (Supabase, expiry, optional password)
- [ ] **Phase 3** — Directed delivery via email (Nodemailer)
