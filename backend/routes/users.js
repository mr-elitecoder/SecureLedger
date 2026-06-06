// routes/users.js
// GET /api/users/list       → transfer ke liye recipients list
// GET /api/users/:id        → kisi bhi user ki public profile
// GET /api/users/me/balance → apna latest balance

const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

// ─────────────────────────────────────────
// GET ALL USERS (for transfer dropdown)
// Sirf naam, email, user_id — sensitive data expose nahi
// ─────────────────────────────────────────
router.get("/list", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
            SELECT user_id, full_name, email
            FROM users
            WHERE is_active = TRUE
              AND role = 'user'
              AND user_id != ?
            ORDER BY full_name ASC
        `,
      [req.user.user_id],
    );

    return res.status(200).json({ success: true, users: rows });
  } catch (err) {
    console.error("User list error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch users." });
  }
});

// ─────────────────────────────────────────
// GET OWN LATEST BALANCE
// Transfer ke baad balance refresh karne ke liye
// ─────────────────────────────────────────
router.get("/me/balance", async (req, res) => {
  try {
    const [[row]] = await db.query(
      "SELECT balance FROM users WHERE user_id = ?",
      [req.user.user_id],
    );

    return res.status(200).json({ success: true, balance: row.balance });
  } catch (err) {
    console.error("Balance fetch error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch balance." });
  }
});

// ─────────────────────────────────────────
// GET OWN DASHBOARD SUMMARY
// Aggregated user totals for the dashboard
// ─────────────────────────────────────────
router.get("/me/summary", async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const [[summary]] = await db.query(
      `
            SELECT
                COALESCE(SUM(CASE WHEN sender_id = ? THEN amount ELSE 0 END), 0) AS total_sent,
                COALESCE(SUM(CASE WHEN receiver_id = ? THEN amount ELSE 0 END), 0) AS total_received,
                COUNT(*) AS transaction_count
            FROM transactions
            WHERE sender_id = ? OR receiver_id = ?
        `,
      [user_id, user_id, user_id, user_id],
    );

    const [[flagged]] = await db.query(
      `
            SELECT COUNT(*) AS flagged_count
            FROM fraud_alerts
            WHERE user_id = ?
        `,
      [user_id],
    );

    return res.status(200).json({
      success: true,
      summary: {
        total_sent: Number(summary.total_sent),
        total_received: Number(summary.total_received),
        transaction_count: Number(summary.transaction_count),
        flagged_count: Number(flagged.flagged_count),
      },
    });
  } catch (err) {
    console.error("Dashboard summary error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch dashboard summary." });
  }
});

// ─────────────────────────────────────────
// GET OWN DASHBOARD TRENDS
// Recent transaction trends for the dashboard
// ─────────────────────────────────────────
router.get("/me/trends", async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const [dailyRows] = await db.query(
      `
            SELECT
                DATE(created_at) AS day,
                COALESCE(SUM(CASE WHEN sender_id = ? THEN amount ELSE 0 END), 0) AS sent,
                COALESCE(SUM(CASE WHEN receiver_id = ? THEN amount ELSE 0 END), 0) AS received
            FROM transactions
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            LIMIT 14
        `,
      [user_id, user_id, user_id, user_id],
    );

    const [statusRows] = await db.query(
      `
            SELECT status, COUNT(*) AS count
            FROM transactions
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY status
        `,
      [user_id, user_id],
    );

    return res.status(200).json({
      success: true,
      trends: {
        daily: dailyRows,
        status_breakdown: statusRows,
      },
    });
  } catch (err) {
    console.error("Dashboard trends error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch dashboard trends." });
  }
});

// ─────────────────────────────────────────
// SEARCH USERS BY NAME OR EMAIL
// Real-time search for transfer input
// ─────────────────────────────────────────
router.get("/search", async (req, res) => {
  const query = req.query.q || "";

  if (query.length < 2) {
    return res.status(200).json({ success: true, users: [] });
  }

  try {
    const [rows] = await db.query(
      `
            SELECT user_id, full_name, email
            FROM users
            WHERE is_active = TRUE
              AND role = 'user'
              AND user_id != ?
              AND (full_name LIKE ? OR email LIKE ?)
            LIMIT 8
        `,
      [req.user.user_id, `%${query}%`, `%${query}%`],
    );

    return res.status(200).json({ success: true, users: rows });
  } catch (err) {
    console.error("Search error:", err.message);
    return res.status(500).json({ success: false, message: "Search failed." });
  }
});

module.exports = router;
