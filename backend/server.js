/**
 * SecureShare P2P — Signaling Server + Auth API
 *
 * IMPORTANT: This server NEVER sees file contents. Its only job is to help
 * two browsers find each other (room codes) and exchange WebRTC connection
 * info (SDP offers/answers, ICE candidates). Once the peer connection is
 * established, the file streams directly between the two browsers.
 *
 * No database. No disk writes. Rooms live in memory only, for a few minutes.
 */

require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const friendsRoutes = require("./routes/friends");
const historyRoutes = require("./routes/history");
const { router: notificationsRoutes } = require("./routes/notifications");

const app = express();
const server = http.createServer(app);

// Allow multiple origins: the specific FRONTEND_URL environment variable,
// any Vercel deployment URL (ending in .vercel.app), any Render URL (ending in .onrender.com),
// and localhost for development (any port).
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
];
const corsOptions = {
  origin: (origin, callback) => {
    // Allow all origins in development, reflect specific origin for credentials
    if (!origin) {
      callback(null, true);
      return;
    }
    // Allow any localhost port during development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, origin);
      return;
    }
    // Allow configured origins and known deployment domains
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
      callback(null, origin);
      return;
    }
    // Default: reflect origin (allows credentials)
    callback(null, origin);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  exposedHeaders: ["Set-Cookie"],
};

const io = new Server(server, {
  cors: corsOptions,
  // Allow WebSocket upgrades on Render (required for free tier)
  allowEIO3: true,
  transports: ['websocket', 'polling'],
});

// Lightweight health endpoint for Render's health checks and wake-up requests
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, database: require('mongoose').connection.readyState === 1 ? 'connected' : 'connecting' });
});

// Connect to MongoDB in the background so the HTTP server can start immediately
connectDB();

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Auth API routes
app.use("/api/auth", authRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/notifications", notificationsRoutes);

// In-memory room registry: { code: { senderSocketId, createdAt } }
const rooms = new Map();
const ROOM_TTL_MS = 10 * 60 * 1000; // rooms expire after 10 minutes if unused

// User ID -> Set of socket IDs (for real-time notifications)
const userSockets = new Map();

function addUserSocket(userId, socketId) {
  if (!userId) return;
  const key = userId.toString();
  if (!userSockets.has(key)) userSockets.set(key, new Set());
  userSockets.get(key).add(socketId);
}

function removeUserSocket(userId, socketId) {
  if (!userId) return;
  const key = userId.toString();
  const set = userSockets.get(key);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) userSockets.delete(key);
  }
}

function emitToUser(userId, event, data) {
  if (!userId) return;
  const key = userId.toString();
  const socketIds = userSockets.get(key);
  if (socketIds) {
    socketIds.forEach((sid) => io.to(sid).emit(event, data));
  }
}

// Make emitToUser accessible to route handlers via app.locals
app.locals.emitToUser = emitToUser;

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
  // Register user for real-time notifications
  socket.on("register-user", (userId) => {
    if (userId) {
      socket.data.userId = userId;
      addUserSocket(userId, socket.id);
    }
  });

  // --- Sender creates a room ---
  socket.on("create-room", ({ fileMeta, userId, password }, ack) => {
    const code = generateRoomCode();
    let passwordHash = null;
    if (password) {
      passwordHash = bcrypt.hashSync(password, 10);
    }
    rooms.set(code, {
      senderSocketId: socket.id,
      senderUserId: userId || null,
      createdAt: Date.now(),
      fileMeta, // { name, size, type } — metadata only, no bytes
      passwordHash,
    });
    socket.join(code);
    socket.data.role = "sender";
    socket.data.roomCode = code;
    if (userId) addUserSocket(userId, socket.id);
    ack({ code });
  });

  // --- Receiver joins a room by code ---
  socket.on("join-room", ({ code, userId, password }, ack) => {
    const room = rooms.get(code);
    if (!room) {
      ack({ error: "Room not found or expired." });
      return;
    }
    if (room.passwordHash) {
      if (!password || !bcrypt.compareSync(password, room.passwordHash)) {
        ack({ error: "Invalid password." });
        return;
      }
    }
    if (userId) {
      room.receiverUserId = userId;
    }
    socket.join(code);
    socket.data.role = "receiver";
    socket.data.roomCode = code;
    if (userId) addUserSocket(userId, socket.id);
    
    // Provide sender and receiver info to both parties
    ack({ ok: true, fileMeta: room.fileMeta, senderUserId: room.senderUserId });

    // Tell the sender a receiver has arrived so it can start the WebRTC offer
    io.to(room.senderSocketId).emit("peer-joined", { peerId: socket.id, receiverUserId: room.receiverUserId });
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

  socket.on("cancel-transfer", ({ roomCode, role }) => {
    if (roomCode) {
      socket.to(roomCode).emit("peer-left", { role });
      // If sender cancels, invalidate the room entirely
      if (role === "sender") {
        rooms.delete(roomCode);
      }
    }
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const userId = socket.data.userId;
    if (userId) removeUserSocket(userId, socket.id);
    
    if (code && rooms.has(code) && rooms.get(code).senderSocketId === socket.id) {
      // Sender left — room is no longer valid
      io.to(code).emit("peer-left", { role: "sender" });
      rooms.delete(code);
    } else if (code) {
      io.to(code).emit("peer-left", { role: "receiver" });
    }
  });

  // --- Friend-to-friend file transfer initiation ---
  socket.on("send-file-to-friend", async ({ friendId, fileMeta, userId, password }, ack) => {
    try {
      // Verify friendship exists
      const Friendship = require("./models/Friendship");
      const friendship = await Friendship.findOne({
        $or: [
          { user1: userId, user2: friendId },
          { user1: friendId, user2: userId },
        ],
        status: "active",
      });
      if (!friendship) {
        ack({ error: "Not friends with this user." });
        return;
      }

      // Create room
      const code = generateRoomCode();
      let passwordHash = null;
      if (password) {
        passwordHash = bcrypt.hashSync(password, 10);
      }
      rooms.set(code, {
        senderSocketId: socket.id,
        senderUserId: userId || null,
        intendedReceiverUserId: friendId,
        createdAt: Date.now(),
        fileMeta,
        passwordHash,
      });
      socket.join(code);
      socket.data.role = "sender";
      socket.data.roomCode = code;
      if (userId) addUserSocket(userId, socket.id);

      // Send real-time notification to friend
      const User = require("./models/User");
      const sender = await User.findById(userId).select("displayName email");
      emitToUser(friendId, "file-transfer-request", {
        roomCode: code,
        fileMeta,
        fromUser: { id: userId, displayName: sender?.displayName, email: sender?.email },
        password: password ? true : false, // just indicate if password is set
      });

      // Also create persistent notification
      const { createNotification } = require("./routes/notifications");
      const notification = await createNotification({
        userId: friendId,
        type: "file_transfer_request",
        title: "Incoming File Transfer",
        message: `${sender?.displayName || "A friend"} wants to send you "${fileMeta.name}" (${formatBytes(fileMeta.size)})`,
        data: { roomCode: code, fileMeta, fromUserId: userId },
      });

      if (notification) {
        emitToUser(friendId, "notification", {
          type: "file_transfer_request",
          notification,
        });
      }

      ack({ code });
    } catch (err) {
      console.error("send-file-to-friend error:", err);
      ack({ error: "Server error" });
    }
  });

  // --- Receiver responds to file transfer request ---
  socket.on("file-transfer-response", ({ roomCode, accept, userId }, ack) => {
    const room = rooms.get(roomCode);
    if (!room) {
      ack({ error: "Room not found or expired." });
      return;
    }
    if (!accept) {
      // Notify sender that transfer was declined
      io.to(room.senderSocketId).emit("file-transfer-declined", { roomCode });
      rooms.delete(roomCode);
      ack({ ok: true });
      return;
    }
    // Accepted - proceed with normal join-room flow
    // We'll let the normal join-room handler take over
    ack({ ok: true, proceedToJoin: true });
  });

  // Helper function for formatting bytes
  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SecureShare P2P signaling server running on http://localhost:${PORT}`);
});
