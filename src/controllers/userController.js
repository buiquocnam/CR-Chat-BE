import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import User from "../models/User.js";

export const authMe = async (req, res) => {
  try {
    const user = req.user; // lấy từ authMiddleware

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Lỗi khi gọi authMe", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

import Friend from "../models/Friend.js";
import FriendRequest from "../models/FriendRequest.js";

export const searchUserByUsername = async (req, res) => {
  try {
    const { q, username, limit = 20 } = req.query;
    const queryText = q || username;
    const currentUserId = req.user._id;

    if (!queryText || queryText.trim() === "") {
      return res.status(400).json({ message: "Cần cung cấp từ khóa tìm kiếm." });
    }

    const regex = new RegExp(queryText, "i");

    // Tìm users (không bao gồm chính mình)
    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } },
        {
          $or: [
            { username: regex },
            { displayName: regex },
            { email: regex }
          ]
        }
      ]
    })
      .select("_id displayName username avatarUrl email bio phone createdAt")
      .limit(parseInt(limit))
      .lean();

    // Tính toán relationship cho từng user
    const usersWithStatus = await Promise.all(users.map(async (user) => {
      let relationship = 'none';
      let friendRequestId = undefined;

      // 1. Check friend
      const isFriend = await Friend.exists({
        $or: [
          { userA: currentUserId, userB: user._id },
          { userA: user._id, userB: currentUserId }
        ]
      });

      if (isFriend) {
        relationship = 'friend';
      } else {
        // 2. Check request sent
        const sentRequest = await FriendRequest.findOne({ from: currentUserId, to: user._id });
        if (sentRequest) {
          relationship = 'request_sent';
          friendRequestId = sentRequest._id;
        } else {
          // 3. Check request received
          const receivedRequest = await FriendRequest.findOne({ from: user._id, to: currentUserId });
          if (receivedRequest) {
            relationship = 'request_received';
            friendRequestId = receivedRequest._id;
          }
        }
      }

      return {
        ...user,
        relationship,
        friendRequestId
      };
    }));

    return res.status(200).json({
      data: usersWithStatus,
      meta: {
        hasNext: false, // Simplified for now
        nextCursor: null
      }
    });
  } catch (error) {
    console.error("Lỗi xảy ra khi searchUserByUsername", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user._id;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await uploadImageFromBuffer(file.buffer);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        avatarUrl: result.secure_url,
        avatarId: result.public_id,
      },
      {
        new: true,
      }
    ).select("avatarUrl");

    if (!updatedUser.avatarUrl) {
      return res.status(400).json({ message: "Avatar trả về null" });
    }

    return res.status(200).json({ avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    console.error("Lỗi xảy ra khi upload avatar", error);
    return res.status(500).json({ message: "Upload failed" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { displayName, bio, phone, avatarUrl } = req.body;

    // Build update object with only allowed fields
    const updateData = {};
    if (displayName) updateData.displayName = displayName.trim();
    if (bio !== undefined) updateData.bio = bio; // allow empty string to clear bio
    if (phone !== undefined) updateData.phone = phone;
    if (avatarUrl) updateData.avatarUrl = avatarUrl;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-hashedPassword"); // Exclude password from response

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password -hashedPassword");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Lỗi khi lấy thông tin user", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
