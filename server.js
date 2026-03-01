const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

io.on("connection", (socket) => {

  socket.on("join-room", ({ room, username, avatar }) => {
    socket.join(room);

    socket.room = room;
    socket.username = username;
    socket.avatar = avatar;

    if (!rooms[room]) rooms[room] = [];
    rooms[room].push(socket.id);

    io.to(room).emit("update-users", rooms[room]);
  });

  socket.on("send-message", (data) => {
    socket.to(data.room).emit("receive-message", {
      message: data.message,
      avatar: socket.avatar
    });
  });

  socket.on("typing", (room) => {
    socket.to(room).emit("show-typing", socket.username);
  });

  socket.on("stop-typing", (room) => {
    socket.to(room).emit("hide-typing");
  });

  socket.on("disconnect", () => {
    const room = socket.room;
    if (room && rooms[room]) {
      rooms[room] = rooms[room].filter(id => id !== socket.id);
      io.to(room).emit("update-users", rooms[room]);
    }
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 SecureChat running on port " + PORT);
});