import express from "express";
import { query } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";
const router = express.Router();
router.use(verifyToken);
router.get("/list", async (req, res) => {
  try {
    const [rows] = await query(
      `SELECT USER_ID, FULL_NAME, EMAIL FROM users WHERE IS_ACTIVE = 1 AND ROLE = 'user' AND USER_ID != ? ORDER BY FULL_NAME ASC`,
      [req.user.user_id],
    );
    const formattedUsers = rows.map((user) => ({
      user_id: user.USER_ID,
      full_name: user.FULL_NAME,
      email: user.EMAIL,
    }));
    console.log(formattedUsers);
    return res.status(200).json({ success: true, users: formattedUsers });
  } catch (err) {
    console.error("User list error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch users." });
  }
});

router.get("/me/balance", async (req, res) => {
  try {
    const [rows] = await query("SELECT BALANCE FROM users WHERE USER_ID = ?", [
      req.user.user_id,
    ]);
    const row = rows[0];
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Balance not found." });
    return res.status(200).json({ success: true, balance: row.BALANCE });
  } catch (err) {
    console.error("Balance fetch error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch balance." });
  }
});
router.get("/me/summary", async (req, res) => {
  const user_id = req.user.user_id;
  try {
    const [summaryRows] = await query(
      `SELECT COALESCE(SUM(CASE WHEN sender_id = ? THEN amount ELSE 0 END), 0) AS total_sent, COALESCE(SUM(CASE WHEN receiver_id = ? THEN amount ELSE 0 END), 0) AS total_received, COUNT(*) AS transaction_count FROM transactions WHERE sender_id = ? OR receiver_id = ?`,
      [user_id, user_id, user_id, user_id],
    );
    const summary = summaryRows[0] || {};
    const [flaggedRows] = await query(
      "SELECT COUNT(*) AS flagged_count FROM fraud_alerts WHERE user_id = ?",
      [user_id],
    );
    const flagged = flaggedRows[0] || { FLAGGED_COUNT: 0 };
    return res.status(200).json({
      success: true,
      summary: {
        total_sent: Number(summary.TOTAL_SENT || 0),
        total_received: Number(summary.TOTAL_RECEIVED || 0),
        transaction_count: Number(summary.TRANSACTION_COUNT || 0),
        flagged_count: Number(flagged.FLAGGED_COUNT || 0),
      },
    });
  } catch (err) {
    console.error("Dashboard summary error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch dashboard summary." });
  }
});
router.get("/me/trends", async (req, res) => {
  const user_id = req.user.user_id;
  try {
    const [dailyRows] = await query(
      `SELECT TRUNC(created_at) AS day, COALESCE(SUM(CASE WHEN sender_id = ? THEN amount ELSE 0 END), 0) AS sent, COALESCE(SUM(CASE WHEN receiver_id = ? THEN amount ELSE 0 END), 0) AS received FROM transactions WHERE sender_id = ? OR receiver_id = ? GROUP BY TRUNC(created_at) ORDER BY day ASC FETCH FIRST 14 ROWS ONLY`,
      [user_id, user_id, user_id, user_id],
    );
    const [statusRows] = await query(
      `SELECT status, COUNT(*) AS count FROM transactions WHERE sender_id = ? OR receiver_id = ? GROUP BY status`,
      [user_id, user_id],
    );
    const formattedDaily = dailyRows.map((row) => ({
      day: row.DAY,
      sent: row.SENT,
      received: row.RECEIVED,
    }));
    const formattedStatus = statusRows.map((row) => ({
      status: row.STATUS,
      count: row.COUNT,
    }));
    return res.status(200).json({
      success: true,
      trends: { daily: formattedDaily, status_breakdown: formattedStatus },
    });
  } catch (err) {
    console.error("Dashboard trends error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch dashboard trends." });
  }
});
router.get("/search", async (req, res) => {
  const q = req.query.q || "";
  if (q.length < 2) return res.status(200).json({ success: true, users: [] });
  try {
    const [rows] = await query(
      `SELECT USER_ID, FULL_NAME, EMAIL FROM users WHERE IS_ACTIVE = 1 AND ROLE = 'user' AND USER_ID != ? AND (UPPER(FULL_NAME) LIKE UPPER(?) OR UPPER(EMAIL) LIKE UPPER(?)) FETCH FIRST 8 ROWS ONLY`,
      [req.user.user_id, `%${q}%`, `%${q}%`],
    );
    const formattedUsers = rows.map((user) => ({
      user_id: user.USER_ID,
      full_name: user.FULL_NAME,
      email: user.EMAIL,
    }));
    return res.status(200).json({ success: true, users: formattedUsers });
  } catch (err) {
    console.error("Search error:", err.message);
    return res.status(500).json({ success: false, message: "Search failed." });
  }
});
export default router;
