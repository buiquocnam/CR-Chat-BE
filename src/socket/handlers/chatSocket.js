import Conversation from "../../models/Conversation.js";

export const chatSocketHandler = (io, socket, user) => {
    socket.on("join_conversation", (payload, callback) => {
        try {
            const conversationId = (payload && typeof payload === 'object') ? payload.conversationId : payload;
            if (conversationId) {
                socket.join(conversationId);
            }
            if (typeof callback === 'function') callback({ status: "ok" });
        } catch (e) {
            console.error("Join conversation error", e);
            if (typeof callback === 'function') callback({ status: "error" });
        }
    });

    socket.on("leave_conversation", (payload, callback) => {
        try {
            const conversationId = (payload && typeof payload === 'object') ? payload.conversationId : payload;
            if (conversationId) {
                socket.leave(conversationId);
            }
            if (typeof callback === 'function') callback({ status: "ok" });
        } catch (e) {
            console.error("Leave conversation error", e);
            if (typeof callback === 'function') callback({ status: "error" });
        }
    });

    socket.on("seen_message", async (payload, callback) => {
        try {
            const { conversationId } = payload;
            const uid = user._id;

            const conversation = await Conversation.findById(conversationId);
            if (conversation) {
                const uniqueIds = new Set(conversation.seenBy.map(id => id.toString()));
                uniqueIds.add(uid.toString());
                conversation.seenBy = Array.from(uniqueIds);
                if (conversation.unreadCounts) {
                    conversation.unreadCounts.set(uid.toString(), 0);
                } else {
                    conversation.unreadCounts = new Map();
                    conversation.unreadCounts.set(uid.toString(), 0);
                }
                await conversation.save();
                io.to(conversationId).emit("conversation_seen", {
                    conversationId,
                    userId: uid,
                    seenAt: new Date()
                });
            }
            callback?.({ status: "ok" });
        } catch (error) {
            console.error("Error seen_message", error);
            callback?.({ status: "error" });
        }
    });
};
