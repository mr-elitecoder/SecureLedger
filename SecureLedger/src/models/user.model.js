import db from "../config/database.js";
import logger from "../config/logger.js";

class User {
  // Create new user
  static async create(userData) {
    try {
      const query = `
        INSERT INTO users (email, firstName, lastName, password, phone, role, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      const [result] = await db.execute(query, [
        userData.email,
        userData.firstName,
        userData.lastName,
        userData.password,
        userData.phone || null,
        userData.role || "user",
        "active",
      ]);
      return result;
    } catch (error) {
      logger.error("Error creating user:", error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const query = "SELECT * FROM users WHERE email = ?";
      const [rows] = await db.execute(query, [email]);
      return rows[0] || null;
    } catch (error) {
      logger.error("Error finding user by email:", error);
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const query = "SELECT * FROM users WHERE id = ?";
      const [rows] = await db.execute(query, [id]);
      return rows[0] || null;
    } catch (error) {
      logger.error("Error finding user by ID:", error);
      throw error;
    }
  }

  // Get all users
  static async findAll(limit = 10, offset = 0) {
    try {
      const query =
        "SELECT id, email, firstName, lastName, phone, role, status, createdAt FROM users LIMIT ? OFFSET ?";
      const [rows] = await db.execute(query, [limit, offset]);
      return rows;
    } catch (error) {
      logger.error("Error finding all users:", error);
      throw error;
    }
  }

  // Update user
  static async update(id, userData) {
    try {
      const fields = [];
      const values = [];

      Object.keys(userData).forEach((key) => {
        if (userData[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(userData[key]);
        }
      });

      fields.push("updatedAt = NOW()");
      values.push(id);

      const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
      const [result] = await db.execute(query, values);
      return result;
    } catch (error) {
      logger.error("Error updating user:", error);
      throw error;
    }
  }

  // Delete user
  static async delete(id) {
    try {
      const query = "DELETE FROM users WHERE id = ?";
      const [result] = await db.execute(query, [id]);
      return result;
    } catch (error) {
      logger.error("Error deleting user:", error);
      throw error;
    }
  }
}

export default User;
