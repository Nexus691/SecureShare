/**
 * SecureShare P2P — Signaling Server
 *
 * IMPORTANT: This server NEVER sees file contents. Its only job is to help
 * two browsers find each other (room codes) and exchange WebRTC connection
 * info (SDP offers/answers, ICE candidates). Once the peer connection is
 * established, the file streams directly between the two browsers.
 *
 * No database. No disk writes. Rooms live in memory only, for a few minutes.
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

// In-memory room registry: { code: { senderSocketId, createdAt } }
const rooms = new Map();
const ROOM_TTL_MS = 10 * 60 * 1000; // rooms expire after 10 minutes if unused

function generateRoomCode() {
  // 6-character, easy to read aloud/type, avoids ambiguous chars (0/O, 1/I)
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      alphabet[crypto.randomInt(alphabet.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

// Periodic cleanup of stale rooms (in-memory only, so this is cheap)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS) rooms.delete(code);
  }
}, 60 * 1000);

io.on("connection", (socket) => {
  // --- Sender creates a room ---
  socket.on("create-room", (fileMeta, ack) => {
    const code = generateRoomCode();
    rooms.set(code, {
      senderSocketId: socket.id,
      createdAt: Date.now(),
      fileMeta, // { name, size, type } — metadata only, no bytes
    });
    socket.join(code);
    socket.data.role = "sender";
    socket.data.roomCode = code;
    ack({ code });
  });

  // --- Receiver joins a room by code ---
  socket.on("join-room", (code, ack) => {
    const room = rooms.get(code);
    if (!room) {
      ack({ error: "Room not found or expired." });
      return;
    }
    socket.join(code);
    socket.data.role = "receiver";
    socket.data.roomCode = code;
    ack({ ok: true, fileMeta: room.fileMeta });

    // Tell the sender a receiver has arrived so it can start the WebRTC offer
    io.to(room.senderSocketId).emit("peer-joined", { peerId: socket.id });
  });

  // --- Relay WebRTC signaling data (SDP offer/answer, ICE candidates) ---
  // This is the only "content" that passes through the server, and it is
  // just connection metadata — never file bytes.
  socket.on("signal", ({ roomCode, targetId, data }) => {
    if (targetId) {
      io.to(targetId).emit("signal", { from: socket.id, data });
    } else {
      socket.to(roomCode).emit("signal", { from: socket.id, data });
    }
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (code && rooms.has(code) && rooms.get(code).senderSocketId === socket.id) {
      // Sender left — room is no longer valid
      io.to(code).emit("peer-left", { role: "sender" });
      rooms.delete(code);
    } else if (code) {
      io.to(code).emit("peer-left", { role: "receiver" });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SecureShare P2P signaling server running on http://localhost:${PORT}`);
});
