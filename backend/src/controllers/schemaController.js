import { getSchemas, getSchemaErd } from "../services/schemaService.js";
export const listSchemas = async (req, res, next) => {
  try {
    const schemas = await getSchemas();
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

    const erd = await getSchemaErd(schema);
    res.json(erd);
  } catch (err) {
    next(err);
  }
};
