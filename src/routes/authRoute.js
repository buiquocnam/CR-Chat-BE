import express from "express";
import {
  refreshToken,
  signIn,
  signOut,
  signUp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", signUp);

router.post("/login", signIn);

router.post("/logout", signOut);

router.post("/refresh", refreshToken);

export default router;
