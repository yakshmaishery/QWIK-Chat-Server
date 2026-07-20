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

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/Index.html'));
});

const io = new Server(server, {
  path:"/socket.io",
  transports:["websocket"],
  cors: {
    origin: [
      "https://qwick-chat.vercel.app",
      "http://localhost:5173",
    ], // Qwik dev URL
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  perMessageDeflate:false,
  maxHttpBufferSize:5e6
});

io.on("connection", (socket) => {
  // console.log("Client connected:", socket.id);

  socket.on("SetUser", (data) => {
    socket.broadcast.emit("SetUserCallBack_BROARDCAST", data)
    socket.emit("SetUserCallBack", data);
  });

  socket.on("ConnectUser", (data) => {
    socket.broadcast.emit("ConnectUser_BROARDCAST", data)
  });

  socket.on("SendMessage", (data) => {
    socket.broadcast.emit("SendMessage_BROARDCAST", data)
  });

  socket.on("ConnectUser_CALLBACK", (data) => {
    socket.broadcast.emit("ConnectUser_CALLBACK_BROARDCAST", data)
  });

  // socket.on("disconnect", () => {
  //   socket.broadcast.emit("DISCONNECTED_USER", { sid: socket.id })
  // });

  // Start Sharing File
  socket.on("startFileTransfer", ({ type, name, size, AnotherID, AnotherSocketID }) => {
    if(AnotherSocketID){
      io.to(AnotherSocketID).emit("startFileTransferAnother", { type, name, size, AnotherID })
    }
    else{
      socket.broadcast.emit("startFileTransferAnother", { type, name, size, AnotherID })
    }
  })

  // Sharing Chunk File
  socket.on("chunkFileTransfer", ({ type, name, size, data, offset, AnotherID, AnotherSocketID },callback) => {
    if(AnotherSocketID){
      io.to(AnotherSocketID).emit("chunkFileTransferAnother", { type, name, size, data, offset, AnotherID })
    }
    else{
      socket.broadcast.emit("chunkFileTransferAnother", { type, name, size, data, offset, AnotherID })
    }
    callback(); // ✅ VERY IMPORTANT → sends ACK back to sender
  })

  // End Sharing File
  socket.on("endFileTransfer", ({ type, name, AnotherID,AnotherSocketID }) => {
    if(AnotherSocketID){
      io.to(AnotherSocketID).emit("endFileTransferAnother", { type, name, AnotherID })
    }
    else{
      socket.broadcast.emit("endFileTransferAnother", { type, name, AnotherID })
    }
  })

  // End Sharing File Callback
  socket.on("endFileTransferAnotherCALLBACK", ({ msg, UserID, AnotherID }) => {
    socket.broadcast.emit("endFileTransferUserCALLBACK", { msg, UserID, AnotherID })
  })
  // End Sharing File Callback
  socket.on("DisconnectPreAnUser", (data) => {
    socket.broadcast.emit("DisconnectPreAnUser_CALLBACK", data)
  })

  // ══════════════════════════════════════════
  // ── ROOM / GROUP CHAT (new, additive) ──
  // Scoped with socket.join() — does not touch
  // any of the global broadcast events above.
  // ══════════════════════════════════════════

  // Create a room — creator joins their own new room.
  // No one else is in it yet, so just ack back to the creator.
  socket.on("CreateRoom", ({ roomId, name }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;

    socket.emit("CreateRoomCallBack", { roomId, name, sid: socket.id });
  });

  // Join an existing room — notify only the members already in that room.
  socket.on("JoinRoom", ({ roomId, name }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;

    // Tell existing room members someone joined
    socket.to(roomId).emit("RoomUserJoined", { sid: socket.id, name, roomId });

    // Ack back to the joiner with confirmation
    socket.emit("JoinRoomCallBack", { roomId, name, sid: socket.id });

    // Send the joiner a list of everyone already in the room
    const membersInRoom = [];
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      for (const memberSid of room) {
        if (memberSid !== socket.id) {
          const memberSocket = io.sockets.sockets.get(memberSid);
          if (memberSocket) {
            membersInRoom.push({ sid: memberSid, name: memberSocket.data.name });
          }
        }
      }
    }
    socket.emit("RoomMembersList", { roomId, members: membersInRoom });
  });

  // Send a chat message — scoped to the room only
  socket.on("RoomSendMessage", ({ roomId, name, text }) => {
    if (!roomId) return;
    socket.to(roomId).emit("RoomMessageBroadcast", {
      sid: socket.id,
      roomId,
      name,
      text,
      time: new Date().toISOString()
    });
  });

  // Leave a room explicitly (user clicks "Leave Room")
  socket.on("LeaveRoom", ({ roomId }) => {
    if (!roomId) return;
    socket.leave(roomId);
    socket.to(roomId).emit("RoomUserLeft", { sid: socket.id, roomId });
    socket.emit("LeaveRoomCallBack", { roomId });
    if (socket.data.roomId === roomId) {
      socket.data.roomId = undefined;
    }
  });

  // Auto-cleanup: if the socket disconnects while still in a room,
  // let that room know (separate from your existing global "disconnect" handler above)
  socket.on("disconnect", () => {
    socket.broadcast.emit("DISCONNECTED_USER", { sid: socket.id })
    
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit("RoomUserLeft", { sid: socket.id, roomId });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Socket server running on port "+PORT);
});
