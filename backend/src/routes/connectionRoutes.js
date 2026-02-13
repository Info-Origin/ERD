import express from "express";
import {
  testConnection,
  createConnection,
  disconnectConnection,
  listConnections,
} from "../controllers/connectionController.js";
import { requireConnection } from "../middleware/connectionAuthMiddleware.js";

const router = express.Router();

// Test connection (no auth required)
router.post("/connection/test", testConnection);

// Create connection and get token (no auth required)
router.post("/connection/create", createConnection);

// Disconnect connection (requires connection token)
router.delete("/connection/:connectionId", requireConnection, disconnectConnection);

// List active connections (requires connection token)
router.get("/connections", requireConnection, listConnections);

export default router;
