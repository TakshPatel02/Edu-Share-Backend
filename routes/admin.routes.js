import express from 'express';
import {
    approveMaterial,
    createAdminMaterial,
    getAdminMaterials,
    rejectMaterial,
} from '../controllers/admin.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import isAdmin from '../middlewares/isAdmin.middleware.js';
import { uploadPdf } from '../middlewares/upload.middleware.js';

const router = express.Router();

router.use(authMiddleware, isAdmin);

router.get('/materials', getAdminMaterials);
router.patch('/materials/:id/approve', approveMaterial);
router.patch('/materials/:id/reject', rejectMaterial);
router.post('/materials', uploadPdf.single('file'), createAdminMaterial);

export default router;
