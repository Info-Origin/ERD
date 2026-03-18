import express from "express";
import type { Request, Response } from "express";
import lockService from "../services/lockService.js";

const router = express.Router();

router.post("/acquire", async (req: Request, res: Response) => {
  try {
    const { schemaName, sessionId } = req.body as {
      schemaName?: string;
      sessionId?: string;
    };

    if (!schemaName || !sessionId) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: schemaName, sessionId",
      });
      return;
    }

    const result = await lockService.acquireLock(schemaName, sessionId);

    if (!result.success) {
      res.status(409).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/release", async (req: Request, res: Response) => {
  try {
    const { schemaName, sessionId } = req.body as {
      schemaName?: string;
      sessionId?: string;
    };

    if (!schemaName || !sessionId) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: schemaName, sessionId",
      });
      return;
    }

    const result = await lockService.releaseLock(schemaName, sessionId);

    if (!result.success) {
      res.status(403).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get("/status/:schema", async (req: Request, res: Response) => {
  try {
    const { schema } = req.params;
    const result = await lockService.getLockStatus(schema);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/bulk-status", async (req: Request, res: Response) => {
  try {
    const { schemaNames } = req.body as { schemaNames?: unknown };

    if (!schemaNames || !Array.isArray(schemaNames)) {
      res.status(400).json({
        success: false,
        message: "Missing required field: schemaNames (array)",
      });
      return;
    }

    const result = await lockService.getBulkLockStatus(schemaNames as string[]);
    res.json({ locks: result });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
