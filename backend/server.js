// server.js — Entry point
// Sab kuch yahan se shuru hota hai

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// DB connection (pool banao on startup)
require("./config/db");

const app = express();

// ─────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/admin", require("./routes/admin"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SecureLedger API is running.",
    timestamp: new Date(),
  });
});

// Catch-all — serve frontend for any non-API route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res
    .status(500)
    .json({ success: false, message: "Something went wrong on the server." });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SecureLedger server running on http://localhost:${PORT}`);
});
