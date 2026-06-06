import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { auth } from "../middleware/auth.js";
import {
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/UserController.js";

const router = express.Router();

// @route   GET /api/v1/users/profile
// @desc    Get current user profile
// @access  Private
router.get("/profile", auth, asyncHandler(getProfile));

// @route   PUT /api/v1/users/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", auth, asyncHandler(updateProfile));

// @route   GET /api/v1/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get("/", auth, asyncHandler(getAllUsers));

// @route   GET /api/v1/users/:id
// @desc    Get user by ID
// @access  Private
router.get("/:id", auth, asyncHandler(getUserById));

// @route   PUT /api/v1/users/:id
// @desc    Update user (admin only)
// @access  Private/Admin
router.put("/:id", auth, asyncHandler(updateUser));

// @route   DELETE /api/v1/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete("/:id", auth, asyncHandler(deleteUser));

export default router;
