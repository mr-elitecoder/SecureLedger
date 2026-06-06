import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import logger from "../config/logger.js";

class AuthService {
  // Generate JWT Token
  static generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" },
    );
  }

  // Generate Refresh Token
  static generateRefreshToken(user) {
    return jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d",
    });
  }

  // Hash password
  static async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare passwords
  static async comparePasswords(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Register user
  static async registerUser(userData) {
    try {
      // Check if user exists
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        throw new Error("User already exists");
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user
      const newUser = await User.create({
        ...userData,
        password: hashedPassword,
      });

      logger.info(`New user registered: ${userData.email}`);
      return newUser;
    } catch (error) {
      logger.error("Registration service error:", error);
      throw error;
    }
  }

  // Login user
  static async loginUser(email, password) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error("Invalid credentials");
      }

      const isValidPassword = await this.comparePasswords(
        password,
        user.password,
      );
      if (!isValidPassword) {
        throw new Error("Invalid credentials");
      }

      const accessToken = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      logger.info(`User logged in: ${email}`);
      return { accessToken, refreshToken, user };
    } catch (error) {
      logger.error("Login service error:", error);
      throw error;
    }
  }
}

export default AuthService;
