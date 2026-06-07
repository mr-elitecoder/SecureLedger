import dotenv from "dotenv";
dotenv.config();

import { query } from "./config/db.js";

(async function run() {
  try {
    console.log("Using connect string:", process.env.DB_CONNECT_STRING);
    const [rows] = await query("SELECT 1 AS val FROM dual", []);
    console.log("DB test success:", rows);
    process.exit(0);
  } catch (err) {
    console.error("DB test failed:", err);
    process.exit(1);
  }
})();
