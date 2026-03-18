import express from "express";
import type { Request, Response } from "express";
import persistenceService from "../services/persistenceService.js";

const router = express.Router();

// ==================== VIRTUAL SCHEMAS ====================

router.get("/virtual-schema/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.loadVirtualSchema(schemaName);
    if (!result) {
      res.status(404).json({ success: false, message: "Virtual schema not found" });
      return;
    }
    res.json({ success: true, schema: result.schema, timestamp: result.timestamp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post("/virtual-schema/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const { virtualSchema } = req.body as { virtualSchema?: unknown };
    if (!virtualSchema) {
      res.status(400).json({ success: false, error: "virtualSchema is required" });
      return;
    }
    await persistenceService.saveVirtualSchema(schemaName, virtualSchema);
    res.json({ success: true, message: "Virtual schema saved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/virtual-schema/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.deleteVirtualSchema(schemaName);
    res.json({ success: true, deleted: result.deleted, message: result.deleted ? "Virtual schema deleted" : "Virtual schema not found" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get("/virtual-schema/:schemaName/timestamp", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.getVirtualSchemaTimestamp(schemaName);
    if (!result) {
      res.status(404).json({ success: false, message: "Virtual schema not found" });
      return;
    }
    res.json({ success: true, timestamp: result.timestamp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== TABLE POSITIONS ====================

router.get("/table-positions/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.loadTablePositions(schemaName);
    if (!result) {
      res.status(404).json({ success: false, message: "Table positions not found" });
      return;
    }
    res.json({ success: true, positions: result.positions, timestamp: result.timestamp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post("/table-positions/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const { positions } = req.body as { positions?: unknown };
    if (!positions) {
      res.status(400).json({ success: false, error: "positions is required" });
      return;
    }
    await persistenceService.saveTablePositions(schemaName, positions);
    res.json({ success: true, message: "Table positions saved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/table-positions/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.deleteTablePositions(schemaName);
    res.json({ success: true, deleted: result.deleted, message: result.deleted ? "Table positions deleted" : "Table positions not found" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== BASELINE SCHEMAS ====================

router.get("/baseline-schema/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.loadBaselineSchema(schemaName);
    if (!result) {
      res.status(404).json({ success: false, message: "Baseline schema not found" });
      return;
    }
    res.json({ success: true, schema: result.schema, timestamp: result.timestamp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post("/baseline-schema/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const { baselineSchema } = req.body as { baselineSchema?: unknown };
    if (!baselineSchema) {
      res.status(400).json({ success: false, error: "baselineSchema is required" });
      return;
    }
    await persistenceService.saveBaselineSchema(schemaName, baselineSchema);
    res.json({ success: true, message: "Baseline schema saved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/baseline-schema/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.deleteBaselineSchema(schemaName);
    res.json({ success: true, deleted: result.deleted, message: result.deleted ? "Baseline schema deleted" : "Baseline schema not found" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== REAL DB HISTORY ====================

router.get("/real-db-history/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.loadRealDbHistory(schemaName);
    if (!result) {
      res.status(404).json({ success: false, message: "Real DB history not found" });
      return;
    }
    res.json({ success: true, history: result.history, timestamp: result.timestamp });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post("/real-db-history/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const { history } = req.body as { history?: unknown };
    if (!history) {
      res.status(400).json({ success: false, error: "history is required" });
      return;
    }
    await persistenceService.saveRealDbHistory(schemaName, history);
    res.json({ success: true, message: "Real DB history saved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/real-db-history/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.deleteRealDbHistory(schemaName);
    res.json({ success: true, deleted: result.deleted, message: result.deleted ? "Real DB history deleted" : "Real DB history not found" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ==================== BULK OPERATIONS ====================

router.delete("/clear-all/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    await persistenceService.clearAllForSchema(schemaName);
    res.json({ success: true, message: "All persistence data cleared for schema" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await persistenceService.getStorageStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get("/schemas", async (_req: Request, res: Response) => {
  try {
    const schemas = await persistenceService.getAllVirtualSchemas();
    res.json({ success: true, schemas });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
