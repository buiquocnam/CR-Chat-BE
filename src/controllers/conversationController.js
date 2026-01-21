import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { io } from "../socket/index.js";

export const createConversation = async (req, res) => {
  try {
    const { type, name, memberIds } = req.body;
    const userId = req.user._id;

    if (
      !type ||
      (type === "group" && !name) ||
      !memberIds ||
      !Array.isArray(memberIds) ||
      memberIds.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Tên nhóm và danh sách thành viên là bắt buộc" });
    }

    let conversation;

    if (type === "direct") {
      const participantId = memberIds[0];

      conversation = await Conversation.findOne({
        type: "direct",
        "participants.userId": { $all: [userId, participantId] },
      });

      if (!conversation) {
        conversation = new Conversation({
          type: "direct",
          participants: [{ userId }, { userId: participantId }],
          lastMessageAt: new Date(),
        });

        await conversation.save();
      }
    }

    if (type === "group") {
      conversation = new Conversation({
        type: "group",
        participants: [{ userId }, ...memberIds.map((id) => ({ userId: id }))],
        group: {
          name,
          createdBy: userId,
        },
        lastMessageAt: new Date(),
      });

      await conversation.save();
    }

    if (!conversation) {
      return res.status(400).json({ message: "Conversation type không hợp lệ" });
    }

    await conversation.populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      {
        path: "seenBy",
        select: "displayName avatarUrl",
      },
      { path: "lastMessage.senderId", select: "displayName avatarUrl" },
    ]);

    const participants = (conversation.participants || []).map((p) => ({
      _id: p.userId?._id,
      displayName: p.userId?.displayName,
      avatarUrl: p.userId?.avatarUrl ?? null,
      joinedAt: p.joinedAt,
    }));

    const formatted = { ...conversation.toObject(), participants };

    if (type === "group") {
      memberIds.forEach((userId) => {
        io.to(userId).emit("new-group", formatted);
      });
    }

    return res.status(201).json({ conversation: formatted });
  } catch (error) {
    console.error("Lỗi khi tạo conversation", error);
    return res.status(500).json({ message: error.message || "Lỗi hệ thống" });
  }
};

export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cursor, limit = 20 } = req.query;
    const limitNum = parseInt(limit);

    const query = {
      "participants.userId": userId,
    };

    if (cursor) {
      // Assuming sorting by lastMessageAt descending
      query.lastMessageAt = { $lt: new Date(cursor) };
    }

    const conversations = await Conversation.find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(limitNum + 1)
      .populate({
        path: "participants.userId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "lastMessage.senderId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "seenBy",
        select: "displayName avatarUrl",
      });

    let hasNext = false;
    let nextCursor = null;

    if (conversations.length > limitNum) {
      hasNext = true;
      const lastItem = conversations[limitNum - 1];
      nextCursor = lastItem.lastMessageAt ? lastItem.lastMessageAt.toISOString() : null;
      conversations.pop(); // Remove the extra item
    }

    const formatted = conversations.map((convo) => {
      const participants = (convo.participants || []).map((p) => ({
        _id: p.userId?._id,
        displayName: p.userId?.displayName,
        avatarUrl: p.userId?.avatarUrl ?? null,
        joinedAt: p.joinedAt,
      }));

      return {
        ...convo.toObject(),
        unreadCounts: convo.unreadCounts || {},
        participants,
      };
    });

    return res.status(200).json({
      data: formatted,
      meta: {
        hasNext,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Lỗi xảy ra khi lấy conversations", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, cursor } = req.query;

    const query = { conversationId };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    // Parallel fetch: Messages and Conversation Details
    const [messages, conversation] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit) + 1),
      Conversation.findById(conversationId).populate([
        { path: "participants.userId", select: "displayName avatarUrl" },
        { path: "seenBy", select: "displayName avatarUrl" },
        { path: "lastMessage.senderId", select: "displayName avatarUrl" },
      ])
    ]);

    let nextCursor = null;
    let finalMessages = messages;

    if (messages.length > Number(limit)) {
      const nextMessage = messages[messages.length - 1];
      nextCursor = nextMessage.createdAt.toISOString();
      finalMessages.pop();
    }

    finalMessages = finalMessages.reverse();

    if (!conversation) {
      // If conversation doesn't exist but we are here, it's weird 
      // (unless checking messages for non-existent convo, which returns empty)
      // But for getConversationById use-case, this 404 is important.
      return res.status(404).json({ message: "Conversation not found" });
    }

    const participants = (conversation.participants || []).map((p) => ({
      _id: p.userId?._id,
      displayName: p.userId?.displayName,
      avatarUrl: p.userId?.avatarUrl ?? null,
      joinedAt: p.joinedAt,
    }));

    const formattedConversation = { ...conversation.toObject(), participants };

    return res.status(200).json({
      conversation: formattedConversation,
      messages: finalMessages,
      nextCursor,
    });
  } catch (error) {
    console.error("Lỗi xảy ra khi lấy messages", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};


export const getUserConversationsForSocketIO = async (userId) => {
  try {
    const conversations = await Conversation.find(
      { "participants.userId": userId },
      { _id: 1 }
    );

    return conversations.map((c) => c._id.toString());
  } catch (error) {
    console.error("Lỗi khi fetch conversations: ", error);
    return [];
  }
};



export const getDirectConversation = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user._id;

    // 1. Try to find the conversation
    const conversation = await Conversation.findOne({
      type: "direct",
      "participants.userId": { $all: [currentUserId, targetUserId] },
    }).populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      { path: "seenBy", select: "displayName avatarUrl" },
      { path: "lastMessage.senderId", select: "displayName avatarUrl" },
    ]);

    if (conversation) {
      const participants = (conversation.participants || []).map((p) => ({
        _id: p.userId?._id,
        displayName: p.userId?.displayName,
        avatarUrl: p.userId?.avatarUrl ?? null,
        joinedAt: p.joinedAt,
      }));

      const formatted = { ...conversation.toObject(), participants };
      return res.status(200).json({ conversation: formatted });
    }

    // 2. If NO conversation, find User to return info for New Chat UI
    const user = await User.findById(targetUserId).select("displayName avatarUrl email");

    if (user) {
      return res.status(200).json({
        conversation: null,
        otherUser: user
      });
    }

    return res.status(404).json({ message: "User not found" });

  } catch (error) {
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};




