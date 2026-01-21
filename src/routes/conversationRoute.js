import express from "express";
import {
  createConversation,
  getConversations,
  getMessages,
  getDirectConversation,
} from "../controllers/conversationController.js";
import { checkFriendship } from "../middlewares/friendMiddleware.js";

const router = express.Router();

router.post("/", checkFriendship, createConversation);
router.get("/", getConversations);
router.get("/direct/:userId", getDirectConversation); // New route
router.get("/:conversationId/messages", getMessages);

export default router;
