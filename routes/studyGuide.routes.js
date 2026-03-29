import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
    generateStudyPlan,
    getStudyPlanChat,
    getChapterGuidance,
    answerQuestion,
    getUserStudyPlans,
    getStudyPlanDetails,
    updateStudyPlanStatus,
} from '../controllers/studyGuide.controller.js';

const router = express.Router();

// Public endpoints (no auth required)
router.post('/generate-plan', generateStudyPlan);
router.post('/chat', getStudyPlanChat);
router.post('/chapter-guidance', getChapterGuidance);
router.post('/answer-question', answerQuestion);

// Protected endpoints (auth required)
router.get('/my-plans', authMiddleware, getUserStudyPlans);
router.get('/plan/:planId', authMiddleware, getStudyPlanDetails);
router.patch('/plan/:planId/status', authMiddleware, updateStudyPlanStatus);

export default router;
