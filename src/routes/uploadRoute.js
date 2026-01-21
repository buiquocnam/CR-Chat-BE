import express from "express";
import { upload } from "../middlewares/uploadMiddleware.js";
import {
    uploadFile,
    uploadUserAvatar,
    uploadConversationAvatar,
} from "../controllers/uploadController.js";
import { protectedRoute } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Apply auth middleware to all upload routes
router.use(protectedRoute);

router.post("/file", upload.single("file"), uploadFile);
router.post("/user/avatar", upload.single("avatar"), uploadUserAvatar);
router.post("/conversation/:id/avatar", upload.single("avatar"), uploadConversationAvatar);

export default router;
