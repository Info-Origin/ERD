import express from "express";
import type { Response, NextFunction } from "express";
import {
  listSchemas,
  getSchemaErdController,
} from "../controllers/schemaController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { requireConnection } from "../middleware/connectionAuthMiddleware.js";
import type { AuthenticatedRequest } from "../types/index.js";

const router = express.Router();

const tryConnectionAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    requireConnection(req, res, (err?: unknown) => {
      if (err) {
        optionalAuth(req, res, next);
      } else {
        next();
      }
    });
  } else {
    optionalAuth(req, res, next);
  }
};

router.get("/schemas", tryConnectionAuth, listSchemas);
router.get("/schemas/:schema/erd", tryConnectionAuth, getSchemaErdController);

export default router;
