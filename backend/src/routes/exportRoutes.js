import express from 'express';
import { exportERDToPDF } from '../controllers/exportController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Export ERD to PDF (server-side)
router.post('/pdf', optionalAuth, exportERDToPDF);

export default router;
