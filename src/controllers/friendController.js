import Friend from "../models/Friend.js";
import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";

// Simplified Service Function (Socket Only)
export const sendFriendRequest = async ({ from, to, message }) => {
  if (from.toString() === to.toString()) {
    throw { status: 400, message: "Không thể gửi lời mời kết bạn cho chính mình" };
  }

  const userExists = await User.exists({ _id: to });
  if (!userExists) {
    throw { status: 404, message: "Người dùng không tồn tại" };
  }

  const [userA, userB] = from.toString() < to.toString()
    ? [from.toString(), to.toString()]
    : [to.toString(), from.toString()];

  const [alreadyFriends, existingRequest] = await Promise.all([
    Friend.findOne({ userA, userB }),
    FriendRequest.findOne({
      $or: [
        { from, to },
        { from: to, to: from },
      ],
    }),
  ]);

  if (alreadyFriends) {
    throw { status: 400, message: "Hai người đã là bạn bè" };
  }

  if (existingRequest) {
    throw { status: 400, message: "Đã có lời mời kết bạn đang chờ" };
  }

  const request = await FriendRequest.create({
    from,
    to,
    message,
  });

  return request;
};

// Pure Function
export const acceptFriendRequest = async ({ requestId, userId }) => {
  const request = await FriendRequest.findById(requestId);

  if (!request) {
    throw { status: 404, message: "Không tìm thấy lời mời kết bạn" };
  }

  if (request.to.toString() !== userId.toString()) {
    throw { status: 403, message: "Bạn không có quyền chấp nhận lời mời này" };
  }

  const friend = await Friend.create({
    userA: request.from,
    userB: request.to,
  });

  await FriendRequest.findByIdAndDelete(requestId);

  const from = await User.findById(request.from)
    .select("_id displayName avatarUrl username email bio phone createdAt")
    .lean();

  return {
    newFriend: {
      _id: from?._id,
      displayName: from?.displayName,
      avatarUrl: from?.avatarUrl,
      username: from?.username,
      email: from?.email,
      bio: from?.bio,
      phone: from?.phone,
      createdAt: from?.createdAt
    }
  };
};

// Pure Function
export const declineFriendRequest = async ({ requestId, userId }) => {
  const request = await FriendRequest.findById(requestId);

  if (!request) {
    throw { status: 404, message: "Không tìm thấy lời mời kết bạn" };
  }

  if (
    request.to.toString() !== userId.toString() &&
    request.from.toString() !== userId.toString()
  ) {
    throw { status: 403, message: "Bạn không có quyền từ chối hoặc hủy lời mời này" };
  }

  await FriendRequest.findByIdAndDelete(requestId);

  return true;
};

// Pure Function
export const unfriend = async ({ friendId, userId }) => {
  const deleted = await Friend.findOneAndDelete({
    $or: [
      { userA: userId, userB: friendId },
      { userA: friendId, userB: userId },
    ],
  });

  if (!deleted) {
    throw { status: 404, message: "Không tìm thấy quan hệ bạn bè" };
  }

  return true;
};

import { onlineUsers } from "../socket/index.js";

export const getAllFriends = async (req, res) => {
  try {
    const userId = req.user._id;
    // Currently fetching all friends, pretending it's one page
    // TODO: Implement actual cursor pagination if list gets large

    const friendships = await Friend.find({
      $or: [
        { userA: userId },
        { userB: userId },
      ],
    })
      .populate("userA", "_id displayName avatarUrl username email bio phone createdAt")
      .populate("userB", "_id displayName avatarUrl username email bio phone createdAt")
      .lean();

    if (!friendships.length) {
      return res.status(200).json({
        data: [],
        meta: { hasNext: false, nextCursor: null }
      });
    }

    const friends = friendships.map((f) =>
      f.userA._id.toString() === userId.toString() ? f.userB : f.userA
    );

    return res.status(200).json({
      data: friends,
      meta: { hasNext: false, nextCursor: null }
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bạn bè", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    const populateFields = "_id username displayName avatarUrl email bio phone createdAt";

    const [sent, received] = await Promise.all([
      FriendRequest.find({ from: userId }).populate("to", populateFields),
      FriendRequest.find({ to: userId }).populate("from", populateFields),
    ]);

    res.status(200).json({ sent, received });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách yêu cầu kết bạn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getOnlineFriends = async (req, res) => {
  try {
    const userId = req.user._id;

    const friendships = await Friend.find({
      $or: [
        { userA: userId },
        { userB: userId },
      ],
    })
      .populate("userA", "_id displayName avatarUrl username email bio phone createdAt")
      .populate("userB", "_id displayName avatarUrl username email bio phone createdAt")
      .lean();

    if (!friendships.length) {
      return res.status(200).json({
        data: [],
        meta: {
          hasNext: false,
          nextCursor: null
        }
      });
    }

    const friends = friendships.map((f) =>
      f.userA._id.toString() === userId.toString() ? f.userB : f.userA
    );

    const onlineFriends = friends.filter((friend) => onlineUsers.has(friend?._id?.toString()));

    return res.status(200).json({
      data: onlineFriends,
      meta: {
        hasNext: false, // Simplified
        nextCursor: null
      }
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bạn bè online", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
