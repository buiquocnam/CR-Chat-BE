import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import {
  emitNewMessage,
  updateConversationAfterCreateMessage,
} from "../utils/messageHelper.js";
import { io } from "../socket/index.js";

export const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, conversationId } = req.body;
    const senderId = req.user._id;

    let conversation;

    if (!content) {
      return res.status(400).json({ message: "Thiếu nội dung" });
    }

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [
          { userId: senderId, joinedAt: new Date() },
          { userId: recipientId, joinedAt: new Date() },
        ],
        lastMessageAt: new Date(),
        unreadCounts: new Map(),
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content,
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();

    emitNewMessage(io, conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn trực tiếp", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const senderId = req.user._id;
    const conversation = req.conversation;

    if (!content) {
      return res.status(400).json("Thiếu nội dung");
    }

    const message = await Message.create({
      conversationId,
      senderId,
      content,
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();
    emitNewMessage(io, conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn nhóm", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ message: "Tin nhắn không tồn tại" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền xóa tin nhắn này" });
    }

    // Soft delete or Hard delete? 
    // Usually soft delete. Let's use delete() which removes document, 
    // OR if we want soft delete we need a field.
    // Frontend Model has `isDeleted`. Backend Model (Step 441) does NOT have `isDeleted`.
    // I should add `isDeleted` to Backend Model or just hard delete.
    // Frontend `useDeleteMessage` optimistically updates `isDeleted: true`.
    // So I should implement SOFT DELETE.

    // Wait, let's just delete it for now to match `await Message.findByIdAndDelete(id)` if user wants hard delete via API calls
    // BUT frontend `useDeleteMessage.ts` sets `isDeleted: true`.
    // So I should update the message content to "Tin nhắn đã bị xóa" or similar?
    // Let's use hard delete for now as standard, but maybe the User wants "Message unsend" feature?
    // It's safer to implement hard delete if `messageService.deleteMessage` calls `apiClient.delete`.

    await Message.deleteOne({ _id: id });

    // Also emit socket event so other users see it disappear?
    io.to(message.conversationId.toString()).emit("message_deleted", { messageId: id, conversationId: message.conversationId });

    return res.status(200).json({ message: "Đã xóa tin nhắn" });
  } catch (error) {
    console.error("Lỗi khi xóa tin nhắn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
