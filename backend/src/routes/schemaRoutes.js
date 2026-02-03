import express from "express";
import {
  listSchemas,
  getSchemaErdController,
} from "../controllers/schemaController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/schemas", optionalAuth, listSchemas);
router.get("/schemas/:schema/erd", optionalAuth, getSchemaErdController);

export default router;
