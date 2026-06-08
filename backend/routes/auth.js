import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { query, execute } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";
const router = express.Router();

// ─────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { full_name, email, password } = req.body;

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
    const [existing] = await query(
      "SELECT user_id FROM users WHERE email = ?",
      [email],
    );
    if (existing.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Email already registered." });
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("password is hashed");

    await execute(
      "INSERT INTO users (full_name, email, password, balance) VALUES (?, ?, ?, ?)",
      [full_name, email, hashedPassword, 10000.0],
      { autoCommit: true },
    );
    return res
      .status(201)
      .json({ success: true, message: "Account created successfully." });
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
    const [rows] = await query(
      "SELECT user_id, full_name, email, password, balance, role, IS_ACTIVE FROM users WHERE email = ?",
      [email],
    );

    if (rows.length === 0)
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    const user = rows[0];
    console.log(user);
    console.log(user.IS_ACTIVE);

    if (user.IS_ACTIVE !== 1)
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact admin.",
      });
    const isMatch = await bcrypt.compare(password, user.PASSWORD);
    if (!isMatch)
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    const token = jwt.sign(
      { user_id: user.USER_ID, email: user.EMAIL, role: user.ROLE },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        user_id: user.USER_ID,
        full_name: user.FULL_NAME,
        email: user.EMAIL,
        balance: user.BALANCE,
        role: user.ROLE,
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

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const [rows] = await query(
      "SELECT USER_ID, FULL_NAME, EMAIL, BALANCE, ROLE, CREATED_AT FROM users WHERE USER_ID = ?",
      [req.user.USER_ID],
    );
    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    const user = rows[0];
    return res.status(200).json({
      success: true,
      user: {
        user_id: user.USER_ID,
        full_name: user.FULL_NAME,
        email: user.EMAIL,
        balance: user.BALANCE,
        role: user.ROLE,
        created_at: user.CREATED_AT,
      },
    });
  } catch (err) {
    console.error("Profile error:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;
