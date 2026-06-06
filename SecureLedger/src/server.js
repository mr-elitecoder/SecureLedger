import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import db from "./config/database.js";
import logger from "./config/logger.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await db.getConnection();
    logger.info("Database connected successfully");
  } catch (err) {
    logger.error("Database connection failed:", err);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(
      `Server running on port ${PORT} in ${process.env.NODE_ENV} mode`,
    );
  });

  const gracefulClose = async () => {
    logger.info("Shutdown signal received: closing HTTP server");
    server.close(async () => {
      logger.info("HTTP server closed");
      try {
        await db.end?.();
        logger.info("Database connection closed");
      } catch (e) {
        logger.error("Error closing DB connection", e);
      }
      process.exit(0);
    });
  };

  process.on("SIGTERM", gracefulClose);
  process.on("SIGINT", gracefulClose);
};

start();
