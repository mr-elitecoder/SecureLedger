// routes/transactions.js
// POST /api/transactions/transfer
// GET  /api/transactions/history
// GET  /api/transactions/:id

const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");

// All transaction routes require login
router.use(verifyToken);

// ─────────────────────────────────────────
// TRANSFER FUNDS
// Calls the stored procedure we wrote in SQL
// ─────────────────────────────────────────
router.post("/transfer", async (req, res) => {
  const { receiver_id, amount, description } = req.body;
  const sender_id = req.user.user_id;
  const ip_address = req.ip || req.connection.remoteAddress;

  // Validation
  if (!receiver_id || !amount) {
    return res
      .status(400)
      .json({ success: false, message: "Receiver and amount are required." });
  }

  if (isNaN(amount) || Number(amount) <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Amount must be a positive number." });
  }

  if (parseInt(receiver_id) === sender_id) {
    return res
      .status(400)
      .json({ success: false, message: "Cannot transfer to yourself." });
  }

  try {
    // Call stored procedure
    // OUT parameter comes back as a result set row in mysql2
    const [results] = await db.query(
      "CALL transfer_funds(?, ?, ?, ?, ?, @p_result)",
      [
        sender_id,
        parseInt(receiver_id),
        parseFloat(amount),
        description || null,
        ip_address,
      ],
    );

    // Fetch the OUT parameter
    const [[outRow]] = await db.query("SELECT @p_result AS result");
    const result = outRow.result;

    if (result.startsWith("ERROR")) {
      return res.status(400).json({ success: false, message: result });
    }

    return res.status(200).json({ success: true, message: result });
  } catch (err) {
    console.error("Transfer error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Transfer failed. Please try again." });
  }
});

// ─────────────────────────────────────────
// TRANSACTION HISTORY
// Calls get_transaction_history stored procedure
// ─────────────────────────────────────────
router.get("/history", async (req, res) => {
  const user_id = req.user.user_id;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const [results] = await db.query("CALL get_transaction_history(?, ?)", [
      user_id,
      limit,
    ]);

    // mysql2 returns stored procedure results as results[0]
    return res.status(200).json({
      success: true,
      transactions: results[0],
    });
  } catch (err) {
    console.error("History error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch history." });
  }
});

// ─────────────────────────────────────────
// GET SINGLE TRANSACTION BY ID
// ─────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const txn_id = parseInt(req.params.id);
  const user_id = req.user.user_id;

  try {
    const [rows] = await db.query(
      `
            SELECT
                t.txn_id, t.amount, t.status, t.description, t.created_at,
                s.full_name AS sender_name,   s.email AS sender_email,
                r.full_name AS receiver_name, r.email AS receiver_email,
                fa.reason   AS fraud_reason,  fa.severity AS fraud_severity
            FROM transactions t
            JOIN users s ON t.sender_id   = s.user_id
            JOIN users r ON t.receiver_id = r.user_id
            LEFT JOIN fraud_alerts fa ON fa.txn_id = t.txn_id
            WHERE t.txn_id = ?
              AND (t.sender_id = ? OR t.receiver_id = ?)
        `,
      [txn_id, user_id, user_id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found." });
    }

    return res.status(200).json({ success: true, transaction: rows[0] });
  } catch (err) {
    console.error("Get transaction error:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;
