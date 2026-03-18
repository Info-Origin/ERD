import express from "express";
import {
  testConnection,
  createConnection,
  disconnectConnection,
  listConnections,
} from "../controllers/connectionController.js";
import { requireConnection } from "../middleware/connectionAuthMiddleware.js";

const router = express.Router();

router.post("/connection/test", testConnection);
router.post("/connection/create", createConnection);
router.delete("/connection/:connectionId", requireConnection, disconnectConnection);
router.get("/connections", requireConnection, listConnections);

export default router;
