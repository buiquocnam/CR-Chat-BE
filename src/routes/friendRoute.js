import express from "express";

import {
  getAllFriends,
  getFriendRequests,
  getOnlineFriends,
} from "../controllers/friendController.js";

const router = express.Router();

router.get("/online", getOnlineFriends);

router.get("/", getAllFriends);
router.get("/requests", getFriendRequests);

export default router;
