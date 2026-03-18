import express from "express";
import type { Request, Response } from "express";

const router = express.Router();

interface RelationshipBody {
  fromTable?: string;
  fromColumn?: string;
  toTable?: string;
  toColumn?: string;
  isUserCreated?: boolean;
  isJunctionRelationship?: boolean;
}

router.delete("/:schemaName/relationships", async (req: Request, res: Response) => {
  const { schemaName } = req.params;
  const { relationships, junctionTables } = req.body as {
    relationships?: RelationshipBody[];
    junctionTables?: string[];
  };

  if (!relationships || !Array.isArray(relationships) || relationships.length === 0) {
    res.status(400).json({ error: "Relationships array is required" });
    return;
  }

  try {
    const results: { fromTable?: string; fromColumn?: string; toTable?: string; toColumn?: string; table?: string; status: string }[] = [];

    for (const rel of relationships) {
      const { fromTable, fromColumn, toTable, toColumn } = rel;

      if (!fromTable || !fromColumn || !toTable || !toColumn) {
        throw new Error("Invalid relationship data: missing required fields");
      }

      if (!rel.isUserCreated && !rel.isJunctionRelationship) {
        throw new Error(
          `Cannot delete database-existing relationship: ${fromTable}.${fromColumn} -> ${toTable}.${toColumn}`
        );
      }

      results.push({ fromTable, fromColumn, toTable, toColumn, status: "deleted_virtually" });
    }

    if (junctionTables && Array.isArray(junctionTables)) {
      for (const junctionTable of junctionTables) {
        results.push({ table: junctionTable, status: "junction_table_deleted_virtually" });
      }
    }

    res.json({
      success: true,
      message: `${results.length} item(s) deleted virtually (no database changes)`,
      results,
      virtual: true,
    });
  } catch (error) {
    console.error("Error validating relationship deletion:", error);
    res.status(500).json({
      error: "Failed to delete relationships",
      message: (error as Error).message,
    });
  }
});

export default router;
