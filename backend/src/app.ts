import express from "express";
import cors from "cors";
import schemaRoutes from "./routes/schemaRoutes.js";
import connectionRoutes from "./routes/connectionRoutes.js";
import relationshipRoutes from "./routes/relationshipRoutes.js";
import exportRoutes from "./routes/exportRoutes.js";
import persistenceRoutes from "./routes/persistenceRoutes.js";
import columnNotesRoutes from "./routes/columnNotesRoutes.js";
import lockRoutes from "./routes/lockRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", connectionRoutes);
app.use("/api/schemas", relationshipRoutes);
app.use("/api", schemaRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/persistence", persistenceRoutes);
app.use("/api/column-notes", columnNotesRoutes);
app.use("/api/locks", lockRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
