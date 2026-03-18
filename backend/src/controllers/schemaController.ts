import type { Response, NextFunction } from "express";
import { getSchemas, getSchemaErd } from "../services/schemaService.js";
import {
  getSchemas as getDynamicSchemas,
  getSchemaErd as getDynamicSchemaErd,
} from "../services/dynamicSchemaService.js";
import type { AuthenticatedRequest } from "../types/index.js";

export const listSchemas = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const applicationUuid = req.query.applicationUuid as string | undefined;

    if (req.connectionId) {
      const schemas = await getDynamicSchemas(req.connectionId);
      res.json({ schemas });
      return;
    }

    const schemas = await getSchemas(applicationUuid);
    res.json({ schemas });
  } catch (err) {
    next(err);
  }
};

export const getSchemaErdController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { schema } = req.params;
    if (!schema) {
      res.status(400).json({ message: "Schema name is required" });
      return;
    }

    if (req.connectionId) {
      const erd = await getDynamicSchemaErd(req.connectionId, schema);
      res.json(erd);
      return;
    }

    const erd = await getSchemaErd(schema);
    res.json(erd);
  } catch (err) {
    next(err);
  }
};
