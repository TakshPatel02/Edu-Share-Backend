import express from 'express';
import { generatePlan } from '../controllers/studyGuide.controller.js';
import { uploadPdf } from '../middlewares/upload.middleware.js';

const router = express.Router();

// Generate personalized study plan
router.post(
    '/generate-plan',
    uploadPdf.fields([
        { name: 'syllabusPdf', maxCount: 1 },
        { name: 'notesPdf', maxCount: 1 },
    ]),
    generatePlan,
);

export default router;
