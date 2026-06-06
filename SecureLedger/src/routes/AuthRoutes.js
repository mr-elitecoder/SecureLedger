import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { auth } from "../middleware/auth.js";
import {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
} from "../controllers/AuthController.js ";

const router = express.Router();

// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", asyncHandler(register));

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post("/login", asyncHandler(login));

// @route   POST /api/v1/auth/refresh-token
// @desc    Refresh access token
// @access  Public
router.post("/refresh-token", asyncHandler(refreshToken));

// @route   POST /api/v1/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", auth, asyncHandler(logout));

// @route   POST /api/v1/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post("/forgot-password", asyncHandler(forgotPassword));

// @route   POST /api/v1/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post("/reset-password", asyncHandler(resetPassword));

export default router;
