import { getSchemas, getSchemaErd } from "../services/schemaService.js";
import { getSchemas as getDynamicSchemas, getSchemaErd as getDynamicSchemaErd } from "../services/dynamicSchemaService.js";

export const listSchemas = async (req, res, next) => {
  try {
    // Get application UUID from query parameter
    const { applicationUuid } = req.query;
    
    // Check if using dynamic connection
    if (req.connectionId) {
      const schemas = await getDynamicSchemas(req.connectionId, applicationUuid);
      return res.json({ schemas });
    }
    
    // Fallback to default .env connection
    const schemas = await getSchemas(applicationUuid);
    res.json({ schemas });
  } catch (err) {
    next(err);
  }
};

export const getSchemaErdController = async (req, res, next) => {
  try {
    const { schema } = req.params;
    if (!schema) {
      return res.status(400).json({ message: "Schema name is required" });
    }

    // Check if using dynamic connection
    if (req.connectionId) {
      const erd = await getDynamicSchemaErd(req.connectionId, schema);
      return res.json(erd);
    }

    // Fallback to default .env connection
    const erd = await getSchemaErd(schema);
    res.json(erd);
  } catch (err) {
    next(err);
  }
};
