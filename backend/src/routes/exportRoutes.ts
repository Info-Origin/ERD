import express from "express";
import { exportERDToPDF } from "../controllers/exportController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/pdf", optionalAuth, exportERDToPDF);

export default router;
