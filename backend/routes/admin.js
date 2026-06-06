// routes/admin.js
// GET  /api/admin/fraud-alerts
// PUT  /api/admin/fraud-alerts/:id/review
// GET  /api/admin/users
// PUT  /api/admin/users/:id/deactivate

const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, adminOnly } = require("../middleware/auth");

// All admin routes require login + admin role
router.use(verifyToken, adminOnly);

// ─────────────────────────────────────────
// ADMIN ANALYTICS
// ─────────────────────────────────────────
router.get("/analytics/overview", async (req, res) => {
  try {
    const [[userStats]] = await db.query(`
            SELECT
                COUNT(*) AS total_users,
                SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active_users,
                SUM(CASE WHEN fa_count > 0 THEN 1 ELSE 0 END) AS flagged_users
            FROM (
                SELECT u.user_id, u.is_active, COUNT(fa.alert_id) AS fa_count
                FROM users u
                LEFT JOIN fraud_alerts fa ON fa.user_id = u.user_id
                GROUP BY u.user_id
            ) AS user_flags
        `);

    const [[txnStats]] = await db.query(`
            SELECT
                COUNT(*) AS total_transactions,
                COALESCE(SUM(amount), 0) AS total_volume
            FROM transactions
        `);

    const [[alertStats]] = await db.query(`
            SELECT
                COUNT(*) AS total_fraud_alerts,
                SUM(CASE WHEN is_reviewed = FALSE THEN 1 ELSE 0 END) AS unreviewed_alerts
            FROM fraud_alerts
        `);

    const [severityRows] = await db.query(`
            SELECT severity, COUNT(*) AS count
            FROM fraud_alerts
            GROUP BY severity
        `);

    const [dailyRows] = await db.query(`
            SELECT DATE(created_at) AS day, COUNT(*) AS count
            FROM fraud_alerts
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            LIMIT 14
        `);

    const [topUsers] = await db.query(`
            SELECT u.user_id, u.full_name, u.email, COUNT(fa.alert_id) AS flags
            FROM users u
            JOIN fraud_alerts fa ON fa.user_id = u.user_id
            GROUP BY u.user_id
            ORDER BY flags DESC
            LIMIT 5
        `);

    return res.status(200).json({
      success: true,
      overview: {
        total_users: userStats.total_users,
        active_users: userStats.active_users,
        flagged_users: userStats.flagged_users,
        total_transactions: txnStats.total_transactions,
        total_volume: Number(txnStats.total_volume),
        total_fraud_alerts: alertStats.total_fraud_alerts,
        unreviewed_alerts: alertStats.unreviewed_alerts,
      },
      severity_breakdown: severityRows,
      daily_fraud: dailyRows,
      top_flagged_users: topUsers,
    });
  } catch (err) {
    console.error("Admin analytics error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch analytics." });
  }
});

// ─────────────────────────────────────────
// GET ALL FRAUD ALERTS
// ─────────────────────────────────────────
router.get("/fraud-alerts", async (req, res) => {
  const reviewed = req.query.reviewed; // ?reviewed=true or false — optional filter

  try {
    let query = `
            SELECT
                fa.alert_id, fa.reason, fa.severity, fa.is_reviewed, fa.created_at,
                t.txn_id, t.amount, t.status AS txn_status, t.ip_address,
                u.full_name AS flagged_user, u.email AS flagged_email,
                r.full_name AS receiver_name
            FROM fraud_alerts fa
            JOIN transactions t ON fa.txn_id  = t.txn_id
            JOIN users u        ON fa.user_id = u.user_id
            JOIN users r        ON t.receiver_id = r.user_id
        `;

    const params = [];

    if (reviewed !== undefined) {
      query += " WHERE fa.is_reviewed = ?";
      params.push(reviewed === "true" ? 1 : 0);
    }

    query += " ORDER BY fa.created_at DESC";

    const [rows] = await db.query(query, params);

    return res.status(200).json({ success: true, alerts: rows });
  } catch (err) {
    console.error("Fraud alerts error:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─────────────────────────────────────────
// MARK FRAUD ALERT AS REVIEWED
// ─────────────────────────────────────────
router.put("/fraud-alerts/:id/review", async (req, res) => {
  const alert_id = parseInt(req.params.id);
  const reviewer_id = req.user.user_id;

  try {
    const [result] = await db.query(
      `
            UPDATE fraud_alerts
            SET is_reviewed = TRUE, reviewed_by = ?, reviewed_at = NOW()
            WHERE alert_id = ?
        `,
      [reviewer_id, alert_id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Alert not found." });
    }

    // Log this admin action
    await db.query(
      `
            INSERT INTO audit_log (actor_id, action_type, target_table, target_id, notes)
            VALUES (?, 'REVIEW_ALERT', 'fraud_alerts', ?, 'Admin reviewed fraud alert')
        `,
      [reviewer_id, alert_id],
    );

    return res
      .status(200)
      .json({ success: true, message: "Alert marked as reviewed." });
  } catch (err) {
    console.error("Review alert error:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─────────────────────────────────────────
// GET ALL USERS (Admin dashboard)
// ─────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT
                u.user_id, u.full_name, u.email, u.balance,
                u.role, u.is_active, u.created_at,
                COUNT(fa.alert_id) AS total_fraud_flags
            FROM users u
            LEFT JOIN fraud_alerts fa ON fa.user_id = u.user_id
            GROUP BY u.user_id
            ORDER BY u.created_at DESC
        `);

    return res.status(200).json({ success: true, users: rows });
  } catch (err) {
    console.error("Get users error:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─────────────────────────────────────────
// DEACTIVATE / REACTIVATE USER
// ─────────────────────────────────────────
router.put("/users/:id/toggle-status", async (req, res) => {
  const target_user_id = parseInt(req.params.id);
  const admin_id = req.user.user_id;

  // Admin cannot deactivate themselves
  if (target_user_id === admin_id) {
    return res.status(400).json({
      success: false,
      message: "Cannot change your own account status.",
    });
  }

  try {
    // Flip is_active
    const [result] = await db.query(
      `
            UPDATE users
            SET is_active = NOT is_active
            WHERE user_id = ? AND role != 'admin'
        `,
      [target_user_id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found or is an admin." });
    }

    // Fetch updated status
    const [[user]] = await db.query(
      "SELECT is_active FROM users WHERE user_id = ?",
      [target_user_id],
    );

    // Audit log
    await db.query(
      `
            INSERT INTO audit_log (actor_id, action_type, target_table, target_id, notes)
            VALUES (?, ?, 'users', ?, ?)
        `,
      [
        admin_id,
        user.is_active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
        target_user_id,
        user.is_active
          ? "Admin activated user account"
          : "Admin deactivated user account",
      ],
    );

    return res.status(200).json({
      success: true,
      message: `User account ${user.is_active ? "activated" : "deactivated"} successfully.`,
    });
  } catch (err) {
    console.error("Toggle user status error:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─────────────────────────────────────────
// GET AUDIT LOG
// ─────────────────────────────────────────
router.get("/audit-log", async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;

  try {
    const [rows] = await db.query(
      `
            SELECT
                al.log_id, al.action_type, al.target_table,
                al.target_id, al.notes, al.created_at,
                u.full_name AS actor_name, u.email AS actor_email
            FROM audit_log al
            LEFT JOIN users u ON al.actor_id = u.user_id
            ORDER BY al.created_at DESC
            LIMIT ?
        `,
      [limit],
    );

    return res.status(200).json({ success: true, logs: rows });
  } catch (err) {
    console.error("Audit log error:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;
