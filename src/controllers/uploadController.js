import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";

// Upload generic file (for chat)
export const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Default options (can be customized based on query params if needed)
        const options = {
            folder: "moji_chat/files",
            resource_type: "auto", // Automatically detect (image, video, raw)
            // Remove generic crop for files to keep original quality/aspect unless specified
        };

        const result = await uploadImageFromBuffer(req.file.buffer, options);

        return res.status(200).json({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
        });
    } catch (error) {
        console.error("Upload file error:", error);
        return res.status(500).json({ message: "Upload failed" });
    }
};

// Upload User Avatar
export const uploadUserAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No avatar uploaded" });
        }

        const userId = req.user._id;

        // Specific options for avatars
        const options = {
            folder: "moji_chat/avatars",
            resource_type: "image",
            transformation: [{ width: 300, height: 300, crop: "fill", gravity: "face" }], // Square crop face
        };

        const result = await uploadImageFromBuffer(req.file.buffer, options);

        // Update user profile
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.avatarUrl = result.secure_url;
        await user.save();

        return res.status(200).json({ avatarUrl: user.avatarUrl });
    } catch (error) {
        console.error("Upload user avatar error:", error);
        return res.status(500).json({ message: "Upload failed" });
    }
};

// Upload Conversation Avatar (Group)
export const uploadConversationAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No avatar uploaded" });
        }

        const { id: conversationId } = req.params;
        // const userId = req.user._id; // Check permissions? (usually any member can update group photo)

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        const options = {
            folder: "moji_chat/groups",
            resource_type: "image",
            transformation: [{ width: 300, height: 300, crop: "fill" }],
        };

        const result = await uploadImageFromBuffer(req.file.buffer, options);

        conversation.groupAvatar = result.secure_url; // Adjust model field name if different
        await conversation.save();

        return res.status(200).json({ avatar: conversation.groupAvatar });
    } catch (error) {
        console.error("Upload conversation avatar error:", error);
        return res.status(500).json({ message: "Upload failed" });
    }
};
