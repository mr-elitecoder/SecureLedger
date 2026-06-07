import express from "express";
import { query } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";
const router = express.Router();
router.use(verifyToken);
router.get("/list", async (req, res) => {
  try {
    const [rows] = await query(
      `SELECT user_id, full_name, email FROM users WHERE is_active = 1 AND role = 'user' AND user_id != ? ORDER BY full_name ASC`,
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
router.get("/me/balance", async (req, res) => {
  try {
    const [rows] = await query("SELECT balance FROM users WHERE user_id = ?", [
      req.user.user_id,
    ]);
    const row = rows[0];
    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Balance not found." });
    return res.status(200).json({ success: true, balance: row.balance });
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
    const flagged = flaggedRows[0] || { flagged_count: 0 };
    return res
      .status(200)
      .json({
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
    return res
      .status(200)
      .json({
        success: true,
        trends: { daily: dailyRows, status_breakdown: statusRows },
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
      `SELECT user_id, full_name, email FROM users WHERE is_active = 1 AND role = 'user' AND user_id != ? AND (full_name LIKE ? OR email LIKE ?) FETCH FIRST 8 ROWS ONLY`,
      [req.user.user_id, `%${q}%`, `%${q}%`],
    );
    return res.status(200).json({ success: true, users: rows });
  } catch (err) {
    console.error("Search error:", err.message);
    return res.status(500).json({ success: false, message: "Search failed." });
  }
});
export default router;
