import express from "express";
import {
  listSchemas,
  getSchemaErdController,
} from "../controllers/schemaController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { requireConnection } from "../middleware/connectionAuthMiddleware.js";

const router = express.Router();

// Try connection auth first, fallback to optional auth
const tryConnectionAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Try connection auth
    requireConnection(req, res, (err) => {
      if (err) {
        // If connection auth fails, try optional auth
        optionalAuth(req, res, next);
      } else {
        next();
      }
    });
  } else {
    // No auth header, use optional auth
    optionalAuth(req, res, next);
  }
};

router.get("/schemas", tryConnectionAuth, listSchemas);
router.get("/schemas/:schema/erd", tryConnectionAuth, getSchemaErdController);

export default router;
