import express from 'express';
import { createMaterial, getMaterials } from '../controllers/material.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadPdf } from '../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/', getMaterials);
router.post('/', authMiddleware, uploadPdf.single('file'), createMaterial);

export default router;
