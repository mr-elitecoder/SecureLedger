import express from "express";
import { query, execute, oracledb } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";
const router = express.Router();
router.use(verifyToken);

router.post("/transfer", async (req, res) => {
  const { receiver_id, amount, description } = req.body;
  const SENDER_ID = req.user.user_id;
  const ip_address = req.ip || req.connection?.remoteAddress;
  if (!receiver_id || !amount)
    return res
      .status(400)
      .json({ success: false, message: "Receiver and amount are required." });
  if (isNaN(amount) || Number(amount) <= 0)
    return res
      .status(400)
      .json({ success: false, message: "Amount must be a positive number." });
  if (parseInt(receiver_id) === SENDER_ID)
    return res
      .status(400)
      .json({ success: false, message: "Cannot transfer to yourself." });
  try {
    const result = await execute(
      `BEGIN transfer_funds(:SENDER_ID, :receiver_id, :amount, :description, :ip_address, :result); END;`,
      {
        SENDER_ID,
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
  const USER_ID = req.user.user_id;
  // console.log(typeof USER_ID);
  const p_limit = parseInt(req.query.p_limit, 10) || 20;
  // console.log(p_limit);
  let connection;
  let result;
  let resultSet;
  try {
    // Get a dedicated connection for ResultSet
    connection = await oracledb.getConnection();
    // console.log("im ok");

    // yha per fetch array size set kr skta hoon but not in getRows method
    result = await connection.execute(
      `BEGIN get_transaction_history(:USER_ID, :p_limit, :cursor); END;`,
      {
        USER_ID,
        p_limit,
        cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
    );

    resultSet = result.outBinds.cursor;
    // console.log(resultSet);

    // Check if ResultSet is valid
    if (!resultSet) {
      throw new Error("No cursor returned from procedure");
    }

    // Fetch rows with proper options
    const transactions = await resultSet.getRows(p_limit);
    // console.log(transactions);
    // Close ResultSet and connection
    await resultSet.close();
    await connection.close();

    // Format the response aur is ki need nhi ab
    /*const formattedTransactions = transactions.map((row) => ({
      txn_id: row[0],
      amount: row[1],
      status: row[2],
      description: row[3],
      created_at: row[4],
      direction: row[5],
      counterparty: row[6],
      fraud_reason: row[7],
    }));
*/
    const formattedTransactions = transactions;
    console.log(formattedTransactions);

    return res.status(200).json({
      success: true,
      transactions: formattedTransactions,
      count: formattedTransactions.length,
    });
  } catch (err) {
    console.error("History error:", err);

    // Clean up resources
    if (resultSet) {
      try {
        await resultSet.close();
      } catch (cleanupErr) {
        console.error("ResultSet cleanup error:", cleanupErr);
      }
    }
    if (connection) {
      try {
        await connection.close();
      } catch (cleanupErr) {
        console.error("Connection cleanup error:", cleanupErr);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Could not fetch history.",
      error: err.message,
    });
  }
});
export default router;
