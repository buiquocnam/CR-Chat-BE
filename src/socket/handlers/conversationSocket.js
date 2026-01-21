import Conversation from "../../models/Conversation.js";

export const conversationSocketHandler = (io, socket, user) => {
    socket.on("create_conversation", async (payload, callback) => {
        try {
            const { type, memberIds, name } = payload;
            const userId = user._id;

            // Logic similar to conversationController.createConversation
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
            } else if (type === "group") {
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
                return callback?.({ status: "error", message: "Invalid type" });
            }

            await conversation.populate([
                { path: "participants.userId", select: "displayName avatarUrl" },
                { path: "seenBy", select: "displayName avatarUrl" },
                { path: "lastMessage.senderId", select: "displayName avatarUrl" },
            ]);

            const participants = (conversation.participants || []).map((p) => ({
                _id: p.userId?._id,
                displayName: p.userId?.displayName,
                avatarUrl: p.userId?.avatarUrl ?? null,
                joinedAt: p.joinedAt,
            }));

            const formatted = { ...conversation.toObject(), participants };

            // Notify other participants
            conversation.participants.forEach(p => {
                const pId = p.userId?._id?.toString() || p.userId.toString();
                // Emit new_conversation event to all participants
                io.to(pId).emit("new_conversation", formatted);
            });

            callback?.({ status: "ok", data: formatted });

        } catch (error) {
            console.error("Socket create_conversation error:", error);
            callback?.({ status: "error", message: "Lỗi hệ thống" });
        }
    });
};
