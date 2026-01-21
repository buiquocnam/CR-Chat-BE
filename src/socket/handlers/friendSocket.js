import {
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    unfriend
} from "../../controllers/friendController.js";

export const friendSocketHandler = (io, socket, user) => {
    socket.on("send_friend_request", async (payload, callback) => {
        try {
            const { receiverId } = payload;
            const senderId = user._id;

            if (receiverId === senderId.toString()) {
                return callback?.({ status: "error", message: "Không thể kết bạn với chính mình" });
            }

            // Use shared logic from controller via direct call
            const newRequest = await sendFriendRequest({
                from: senderId,
                to: receiverId,
                message: "Sent via socket"
            });

            const requestPopulated = await newRequest.populate("from", "displayName avatarUrl username");

            // Notify receiver
            io.to(receiverId).emit("new_friend_request", requestPopulated);

            callback?.({ status: "ok", data: { request: newRequest } });

        } catch (error) {
            console.error("Socket send_friend_request error:", error);
            callback?.({ status: "error", message: error.message || "Lỗi hệ thống" });
        }
    });

    socket.on("accept_friend_request", async (payload, callback) => {
        try {
            const { requestId } = payload;
            const userId = user._id;

            const { newFriend } = await acceptFriendRequest({ requestId, userId });

            // Notify sender
            io.to(newFriend._id.toString()).emit("friend_request_accepted", {
                newFriend: {
                    _id: user._id,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                    username: user.username
                },
                requestId: requestId
            });

            callback?.({ status: "ok", data: { newFriend } });

        } catch (error) {
            console.error("Socket accept_friend_request error:", error);
            callback?.({ status: "error", message: error.message || "Lỗi hệ thống" });
        }
    });

    socket.on("cancel_friend_request", async (payload, callback) => {
        try {
            const { requestId } = payload;
            const userId = user._id;

            await declineFriendRequest({ requestId, userId });

            callback?.({ status: "ok", data: { success: true } });

        } catch (error) {
            console.error("Socket cancel_friend_request error:", error);
            callback?.({ status: "error", message: error.message || "Lỗi hệ thống" });
        }
    });

    socket.on("unfriend", async (payload, callback) => {
        try {
            const { friendId } = payload;
            const userId = user._id;

            await unfriend({ friendId, userId });
            // Logic for notifying friend about unfriend is optional but recommended
            io.to(friendId).emit("unfriended", { friendId: userId }); // Notify user they were unfriended by userId

            callback?.({ status: "ok", data: { success: true } });
        } catch (error) {
            console.error("Socket unfriend error:", error);
            callback?.({ status: "error", message: error.message || "Lỗi hệ thống" });
        }
    });
};
