import express from 'express';
import { dashboard, login, me, signup } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authMiddleware, me);
router.get('/dashboard', authMiddleware, dashboard);

export default router;
