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

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
];
const corsOptions = {
  origin: (origin, callback) => {

    if (!origin) {
      callback(null, true);
      return;
    }

    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, origin);
      return;
    }

    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
      callback(null, origin);
      return;
    }

    callback(null, origin);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  exposedHeaders: ["Set-Cookie"],
};

const io = new Server(server, {
  cors: corsOptions,

  allowEIO3: true,
  transports: ['websocket', 'polling'],
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, database: require('mongoose').connection.readyState === 1 ? 'connected' : 'connecting' });
});

connectDB();

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/notifications", notificationsRoutes);

const rooms = new Map();
const ROOM_TTL_MS = 10 * 60 * 1000;

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

app.locals.emitToUser = emitToUser;

function generateRoomCode() {

  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      alphabet[crypto.randomInt(alphabet.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS) rooms.delete(code);
  }
}, 60 * 1000);

io.on("connection", (socket) => {

  socket.on("register-user", (userId) => {
    if (userId) {
      socket.data.userId = userId;
      addUserSocket(userId, socket.id);
    }
  });

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
      fileMeta,
      passwordHash,
    });
    socket.join(code);
    socket.data.role = "sender";
    socket.data.roomCode = code;
    if (userId) addUserSocket(userId, socket.id);
    ack({ code });
  });

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

    ack({ ok: true, fileMeta: room.fileMeta, senderUserId: room.senderUserId });

    io.to(room.senderSocketId).emit("peer-joined", { peerId: socket.id, receiverUserId: room.receiverUserId });
  });

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

      io.to(code).emit("peer-left", { role: "sender" });
      rooms.delete(code);
    } else if (code) {
      io.to(code).emit("peer-left", { role: "receiver" });
    }
  });

  socket.on("send-file-to-friend", async ({ friendId, fileMeta, userId, password }, ack) => {
    try {

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

      const User = require("./models/User");
      const sender = await User.findById(userId).select("displayName email");
      emitToUser(friendId, "file-transfer-request", {
        roomCode: code,
        fileMeta,
        fromUser: { id: userId, displayName: sender?.displayName, email: sender?.email },
        password: password ? true : false,
      });

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

  socket.on("file-transfer-response", ({ roomCode, accept, userId }, ack) => {
    const room = rooms.get(roomCode);
    if (!room) {
      ack({ error: "Room not found or expired." });
      return;
    }
    if (!accept) {

      io.to(room.senderSocketId).emit("file-transfer-declined", { roomCode });
      rooms.delete(roomCode);
      ack({ ok: true });
      return;
    }

    ack({ ok: true, proceedToJoin: true });
  });

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
