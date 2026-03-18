import jwt from "jsonwebtoken";
import type { Response, NextFunction } from "express";
import connectionManager from "../config/dynamicConnectionManager.js";
import type { AuthenticatedRequest } from "../types/index.js";

export const requireConnection = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: "No connection token provided",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Invalid token format",
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as AuthenticatedRequest["user"] & { connectionId: string };

    if (!connectionManager.pools.has(decoded.connectionId)) {
      res.status(401).json({
        success: false,
        message: "Connection expired or not found. Please reconnect.",
      });
      return;
    }

    req.connectionId = decoded.connectionId;
    req.user = decoded;
    next();
  } catch (error) {
    if ((error as Error & { name: string }).name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        message: "Connection token expired. Please reconnect.",
      });
      return;
    }
    res.status(401).json({
      success: false,
      message: "Invalid connection token",
    });
  }
};
