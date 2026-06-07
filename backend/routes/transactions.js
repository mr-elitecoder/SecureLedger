import express from "express";
import { query, execute, oracledb } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";
const router = express.Router();
router.use(verifyToken);
router.post("/transfer", async (req, res) => {
  const { receiver_id, amount, description } = req.body;
  const sender_id = req.user.user_id;
  const ip_address = req.ip || req.connection?.remoteAddress;
  if (!receiver_id || !amount)
    return res
      .status(400)
      .json({ success: false, message: "Receiver and amount are required." });
  if (isNaN(amount) || Number(amount) <= 0)
    return res
      .status(400)
      .json({ success: false, message: "Amount must be a positive number." });
  if (parseInt(receiver_id) === sender_id)
    return res
      .status(400)
      .json({ success: false, message: "Cannot transfer to yourself." });
  try {
    const result = await execute(
      `BEGIN transfer_funds(:sender_id, :receiver_id, :amount, :description, :ip_address, :result); END;`,
      {
        sender_id,
        receiver_id: parseInt(receiver_id, 10),
        amount: parseFloat(amount),
        description: description || null,
        ip_address,
        result: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 200 },
      },
      { autoCommit: true },
    );
    const procedureResult = result.outBinds.result;
    if (String(procedureResult).startsWith("ERROR"))
      return res.status(400).json({ success: false, message: procedureResult });
    return res.status(200).json({ success: true, message: procedureResult });
  } catch (err) {
    console.error("Transfer error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Transfer failed. Please try again." });
  }
});
router.get("/history", async (req, res) => {
  const user_id = req.user.user_id;
  const limit = parseInt(req.query.limit, 10) || 20;
  try {
    const result = await execute(
      `BEGIN get_transaction_history(:user_id, :limit, :cursor); END;`,
      {
        user_id,
        limit,
        cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
    );
    const resultSet = result.outBinds.cursor;
    const transactions = await resultSet.getRows(limit);
    await resultSet.close();
    return res.status(200).json({ success: true, transactions });
  } catch (err) {
    console.error("History error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch history." });
  }
});
router.get("/:id", async (req, res) => {
  const txn_id = parseInt(req.params.id, 10);
  const user_id = req.user.user_id;
  try {
    const [rows] = await query(
      `SELECT t.txn_id, t.amount, t.status, t.description, t.created_at, s.full_name AS sender_name, s.email AS sender_email, r.full_name AS receiver_name, r.email AS receiver_email, fa.reason AS fraud_reason, fa.severity AS fraud_severity FROM transactions t JOIN users s ON t.sender_id = s.user_id JOIN users r ON t.receiver_id = r.user_id LEFT JOIN fraud_alerts fa ON fa.txn_id = t.txn_id WHERE t.txn_id = ? AND (t.sender_id = ? OR t.receiver_id = ?)`,
      [txn_id, user_id, user_id],
    );
    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found." });
    return res.status(200).json({ success: true, transaction: rows[0] });
  } catch (err) {
    console.error("Get transaction error:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});
export default router;
