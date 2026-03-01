/* ==============================
   SecureChat - Production Server
   ============================== */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

/* ==============================
   Socket.io Setup
   ============================== */

const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

/* ==============================
   Middleware
   ============================== */

app.set("trust proxy", 1);
app.use(express.static("public"));

/* ==============================
   In-Memory Room Storage
   ============================== */

let roomUsers = {};

/* ==============================
   Socket Connection
   ============================== */

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  /* ===== Join Room ===== */

  socket.on("join-room", ({ room, username, avatar }) => {
    socket.join(room);

    socket.room = room;
    socket.username = username;
    socket.avatar = avatar;

    if (!roomUsers[room]) {
      roomUsers[room] = [];
    }

    roomUsers[room].push({
      id: socket.id,
      username,
      avatar
    });

    io.to(room).emit("update-users", roomUsers[room]);

    console.log(`${username} joined room ${room}`);
  });

  /* ===== Send Message ===== */

  socket.on("send-message", (data) => {
    if (!socket.room) return;

    socket.to(socket.room).emit("receive-message", {
      message: data.message,
      avatar: socket.avatar
    });
  });

  /* ===== Typing Indicator ===== */

  socket.on("typing", () => {
    socket.to(socket.room).emit("show-typing", socket.username);
  });

  socket.on("stop-typing", () => {
    socket.to(socket.room).emit("hide-typing");
  });

  /* ===== Disconnect ===== */

  socket.on("disconnect", () => {
    if (!socket.room) return;

    if (roomUsers[socket.room]) {
      roomUsers[socket.room] = roomUsers[socket.room].filter(
        user => user.id !== socket.id
      );

      io.to(socket.room).emit("update-users", roomUsers[socket.room]);

      if (roomUsers[socket.room].length === 0) {
        delete roomUsers[socket.room];
      }
    }

    console.log("User disconnected:", socket.id);
  });

});

/* ==============================
   Server Start (Render Ready)
   ============================== */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 SecureChat running on port " + PORT);
});