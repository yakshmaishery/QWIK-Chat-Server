import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from 'cors';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
// Enable CORS for all origins
app.use(cors());
const server = http.createServer(app);

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/Index.html'));
});

const io = new Server(server, {
  cors: {
    origin: "*", // Qwik dev URL
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  // console.log("Client connected:", socket.id);

  // socket.on("message", (data) => {
  //   console.log("Received:", data);
  //   socket.emit("message", "Hello from server");
  // });
  socket.on("SetUser", (data) => {
    socket.broadcast.emit("SetUserCallBack_BROARDCAST",data)
    socket.emit("SetUserCallBack", data);
  });

  socket.on("ConnectUser", (data) => {
    socket.broadcast.emit("ConnectUser_BROARDCAST",data)
  });

  socket.on("SendMessage", (data) => {
    socket.broadcast.emit("SendMessage_BROARDCAST",data)
  });

  socket.on("ConnectUser_CALLBACK", (data) => {
    socket.broadcast.emit("ConnectUser_CALLBACK_BROARDCAST",data)
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    socket.broadcast.emit("DISCONNECTED_USER",{sid:socket.id})
  });
});

server.listen(3000, () => {
  console.log("Socket server running on port 3000");
});
