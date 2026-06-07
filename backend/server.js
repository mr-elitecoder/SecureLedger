import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import transactionsRouter from "./routes/transactions.js";
import adminRouter from "./routes/admin.js";
import "./config/db.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/admin", adminRouter);
app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    message: "SecureLedger API is running.",
    timestamp: new Date(),
  }),
);
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html")),
);
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res
    .status(500)
    .json({ success: false, message: "Something went wrong on the server." });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 SecureLedger server running on http://localhost:${PORT}`),
);
