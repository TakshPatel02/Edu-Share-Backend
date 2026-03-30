import express from 'express';
import { generatePlan } from '../controllers/studyGuide.controller.js';

const router = express.Router();

// Generate personalized study plan
router.post('/generate-plan', generatePlan);

export default router;
