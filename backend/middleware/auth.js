// middleware/auth.js
// Har protected route pe ye pehle chalega
// Token verify karega — valid hai toh next(), nahi toh 401

const jwt = require("jsonwebtoken");
require("dotenv").config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  // Token format: "Bearer <token>"
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { user_id, email, role } — available in all routes
    next();
  } catch (err) {
    return res
      .status(403)
      .json({ success: false, message: "Invalid or expired token." });
  }
};

// Admin only middleware — verifyToken ke baad use karo
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Admin access required." });
  }
  next();
};

module.exports = { verifyToken, adminOnly };
