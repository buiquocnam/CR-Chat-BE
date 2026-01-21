import { Server } from "socket.io";
import http from "http";
import express from "express";
import { socketAuthMiddleware } from "../middlewares/socketMiddleware.js";
import { getUserConversationsForSocketIO } from "../controllers/conversationController.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";

import Friend from "../models/Friend.js";
import FriendRequest from "../models/FriendRequest.js";
import { friendSocketHandler } from "./handlers/friendSocket.js";
import { chatSocketHandler } from "./handlers/chatSocket.js";
import { conversationSocketHandler } from "./handlers/conversationSocket.js";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

const onlineUsers = new Map(); // {userId: socketId}

io.on("connection", async (socket) => {
  const user = socket.user;
  const userId = user._id.toString();

  // console.log(`${user.displayName} online với socket ${socket.id}`);

  onlineUsers.set(userId, socket.id);

  // Emit to all clients that this user is online
  io.emit("user_online", {
    _id: user._id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    username: user.username,
    isOnline: true
  });

  const conversationIds = await getUserConversationsForSocketIO(user._id);
  conversationIds.forEach((id) => {
    socket.join(id);
  });

  // Register modular handlers
  chatSocketHandler(io, socket, user);
  friendSocketHandler(io, socket, user);
  conversationSocketHandler(io, socket, user);


});

export { io, app, server, onlineUsers };

