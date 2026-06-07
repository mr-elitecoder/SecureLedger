import jwt from "jsonwebtoken";
import "dotenv/config";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token)
    return res
      .status(401)
      .json({ success: false, message: "Access denied. No token provided." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res
      .status(403)
      .json({ success: false, message: "Invalid or expired token." });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin")
    return res
      .status(403)
      .json({ success: false, message: "Admin access required." });
  next();
};
