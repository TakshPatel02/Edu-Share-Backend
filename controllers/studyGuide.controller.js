import {
    generatePersonalizedStudyPlan,
    createStudyGuidanceChat,
    generateChapterGuidance,
    answerSubjectQuestion,
} from '../utils/ragAgent.js';
import { StudyPlan } from '../models/studyPlan.model.js';

export const generateStudyPlan = async (req, res, next) => {
    try {
        const { subject, learningGoal, examType, syllabus, chapters, prepWeeks } = req.body;
        const userId = req.user?.id;

        // Validate required fields
        if (!subject || !learningGoal || !examType) {
            const error = new Error('subject, learningGoal, and examType are required');
            error.statusCode = 400;
            throw error;
        }

        if (!['Mid Sem', 'End Sem'].includes(examType)) {
            const error = new Error('examType must be either "Mid Sem" or "End Sem"');
            error.statusCode = 400;
            throw error;
        }

        // Generate personalized study plan using RAG agent
        const studyPlan = await generatePersonalizedStudyPlan({
            subject,
            learningGoal,
            examType,
            syllabus: syllabus || '',
            chapters: chapters || [],
            prepWeeks: prepWeeks || 2,
        });

        // Save study plan to database if user is authenticated
        let savedPlan = null;
        if (userId) {
            savedPlan = await StudyPlan.create({
                userId,
                subject,
                learningGoal,
                examType,
                syllabus: syllabus || '',
                chapters: chapters || [],
                prepWeeks: prepWeeks || 2,
                personalizationData: {
                    summary: studyPlan.summary,
                    roadmap: studyPlan.roadmap,
                    dailyRoutine: studyPlan.dailyRoutine,
                    tips: studyPlan.tips,
                },
            });
        }

        res.status(200).json({
            success: true,
            message: 'Study plan generated successfully',
            data: {
                planId: savedPlan?._id,
                ...studyPlan,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const getStudyPlanChat = async (req, res, next) => {
    try {
        const { planId, userMessage } = req.body;
        const userId = req.user?.id;

        if (!userMessage) {
            const error = new Error('userMessage is required');
            error.statusCode = 400;
            throw error;
        }

        // Retrieve study plan if available
        let existingPlan = null;
        if (planId) {
            existingPlan = await StudyPlan.findById(planId);
            if (!existingPlan) {
                const error = new Error('Study plan not found');
                error.statusCode = 404;
                throw error;
            }
        }

        // Use conversation history if available
        const conversationHistory = existingPlan?.conversationHistory || [];

        // Get response from chat
        const result = await createStudyGuidanceChat(conversationHistory, userMessage);

        // Update conversation history
        if (existingPlan) {
            existingPlan.conversationHistory.push({
                role: 'user',
                content: userMessage,
            });
            existingPlan.conversationHistory.push({
                role: 'assistant',
                content: result.assistantResponse,
            });
            await existingPlan.save();
        }

        res.status(200).json({
            success: true,
            message: 'Chat response generated',
            data: {
                userMessage,
                assistantResponse: result.assistantResponse,
                planId: existingPlan?._id,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const getChapterGuidance = async (req, res, next) => {
    try {
        const { subject, chapter, examType } = req.body;

        if (!subject || !chapter || !examType) {
            const error = new Error('subject, chapter, and examType are required');
            error.statusCode = 400;
            throw error;
        }

        const guidance = await generateChapterGuidance({
            subject,
            chapter,
            examType,
        });

        res.status(200).json({
            success: true,
            message: 'Chapter guidance generated',
            data: guidance,
        });
    } catch (err) {
        next(err);
    }
};

export const answerQuestion = async (req, res, next) => {
    try {
        const { subject, question, context } = req.body;

        if (!subject || !question) {
            const error = new Error('subject and question are required');
            error.statusCode = 400;
            throw error;
        }

        const result = await answerSubjectQuestion({
            subject,
            question,
            context: context || '',
        });

        res.status(200).json({
            success: true,
            message: 'Question answered',
            data: result,
        });
    } catch (err) {
        next(err);
    }
};

export const getUserStudyPlans = async (req, res, next) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }

        const plans = await StudyPlan.find({ userId }).sort({ createdAt: -1 }).select('-conversationHistory');

        res.status(200).json({
            success: true,
            message: 'Study plans retrieved',
            data: plans,
            count: plans.length,
        });
    } catch (err) {
        next(err);
    }
};

export const getStudyPlanDetails = async (req, res, next) => {
    try {
        const { planId } = req.params;
        const userId = req.user?.id;

        const plan = await StudyPlan.findById(planId);

        if (!plan) {
            const error = new Error('Study plan not found');
            error.statusCode = 404;
            throw error;
        }

        // Check authorization
        if (plan.userId.toString() !== userId) {
            const error = new Error('Unauthorized');
            error.statusCode = 403;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: 'Study plan retrieved',
            data: plan,
        });
    } catch (err) {
        next(err);
    }
};

export const updateStudyPlanStatus = async (req, res, next) => {
    try {
        const { planId } = req.params;
        const { status } = req.body;
        const userId = req.user?.id;

        if (!['draft', 'active', 'completed'].includes(status)) {
            const error = new Error('Invalid status');
            error.statusCode = 400;
            throw error;
        }

        const plan = await StudyPlan.findById(planId);

        if (!plan) {
            const error = new Error('Study plan not found');
            error.statusCode = 404;
            throw error;
        }

        // Check authorization
        if (plan.userId.toString() !== userId) {
            const error = new Error('Unauthorized');
            error.statusCode = 403;
            throw error;
        }

        plan.status = status;
        await plan.save();

        res.status(200).json({
            success: true,
            message: 'Study plan status updated',
            data: plan,
        });
    } catch (err) {
        next(err);
    }
};
