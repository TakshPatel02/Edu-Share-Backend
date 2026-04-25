import express from 'express';
import {
    answerQuestion,
    chat,
    generatePlan,
    getChapterGuidance,
    getPlanDetails,
    getUserPlans,
    updatePlanStatus,
} from '../controllers/studyGuide.controller.js';
import { uploadPdf } from '../middlewares/upload.middleware.js';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Generate personalized study plan
router.post(
    '/generate-plan',
    optionalAuthMiddleware,
    uploadPdf.fields([
        { name: 'syllabusPdf', maxCount: 1 },
        { name: 'notesPdf', maxCount: 1 },
    ]),
    generatePlan,
);

router.post('/chat', chat);
router.post('/chapter-guidance', getChapterGuidance);
router.post('/answer-question', answerQuestion);

router.get('/my-plans', authMiddleware, getUserPlans);
router.get('/plan/:id', authMiddleware, getPlanDetails);
router.patch('/plan/:id/status', authMiddleware, updatePlanStatus);

export default router;
