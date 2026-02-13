import express from "express";
import cors from "cors";
import schemaRoutes from "./routes/schemaRoutes.js";
import connectionRoutes from "./routes/connectionRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", connectionRoutes);
app.use("/api", schemaRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
