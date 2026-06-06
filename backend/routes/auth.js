// routes/auth.js
// POST /api/auth/register
// POST /api/auth/login

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
require("dotenv").config();

// ─────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { full_name, email, password } = req.body;

  // Basic validation
  if (!full_name || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters.",
    });
  }

  try {
    // Check if email already exists
    const [existing] = await db.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email],
    );
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user — new users start with 10,000 balance (demo purposes)
    const [result] = await db.query(
      "INSERT INTO users (full_name, email, password, balance) VALUES (?, ?, ?, ?)",
      [full_name, email, hashedPassword, 10000.0],
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user_id: result.insertId,
    });
  } catch (err) {
    console.error("Register error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Server error. Please try again." });
  }
});

// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and password required." });
  }

  try {
    // Fetch user
    const [rows] = await db.query(
      "SELECT user_id, full_name, email, password, balance, role, is_active FROM users WHERE email = ?",
      [email],
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    const user = rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact admin.",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        balance: user.balance,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Server error. Please try again." });
  }
});

// ─────────────────────────────────────────
// GET PROFILE  (protected)
// ─────────────────────────────────────────
const { verifyToken } = require("../middleware/auth");

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT user_id, full_name, email, balance, role, created_at FROM users WHERE user_id = ?",
      [req.user.user_id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("Profile error:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;
