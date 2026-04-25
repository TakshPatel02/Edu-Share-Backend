import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import { StudyPlan } from '../models/studyGuide.model.js';

const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error('Missing Gemini API key. Set GEMINI_API_KEY in your .env file.');
    }
    return new GoogleGenAI({ apiKey });
};

// Parse JSON from Gemini response with fallback
const parseGeminiResponse = (text) => {
    try {
        // Try to find JSON in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch (error) {
        return null;
    }
};

const normalizeChapters = (chaptersInput) => {
    if (Array.isArray(chaptersInput)) {
        return chaptersInput.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof chaptersInput === 'string') {
        const trimmed = chaptersInput.trim();
        if (!trimmed) {
            return [];
        }

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item).trim()).filter(Boolean);
            }
        } catch (error) {
            // Ignore JSON parse error and fallback to comma-separated parsing.
        }

        return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [];
};

const parseSyllabusPdfText = async (file) => {
    if (!file?.buffer) {
        return '';
    }

    const parser = new PDFParse({ data: file.buffer });

    try {
        const textResult = await parser.getText();
        return (textResult?.text || '').trim();
    } finally {
        await parser.destroy();
    }
};

const isValidYoutubePlaylistUrl = (url) => {
    if (!url) {
        return false;
    }

    try {
        const parsed = new URL(url);
        const isYoutubeHost = parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be');
        const hasPlaylistId = parsed.searchParams.has('list');
        return isYoutubeHost && hasPlaylistId;
    } catch (error) {
        return false;
    }
};

const toError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const getPlanPayloadFromDoc = (planDoc) => {
    if (!planDoc) {
        return null;
    }

    return {
        id: planDoc._id,
        subject: planDoc.subject,
        branch: planDoc.branch || '',
        semester: planDoc.semester || '',
        learningGoal: planDoc.learningGoal,
        examType: planDoc.examType,
        chapters: planDoc.chapters || [],
        prepWeeks: planDoc.prepWeeks,
        summary: planDoc.summary,
        roadmap: planDoc.roadmap || [],
        dailyRoutine: planDoc.dailyRoutine || [],
        tips: planDoc.tips || [],
        videoPlan: planDoc.videoPlan || [],
        status: planDoc.status,
        resources: {
            youtubePlaylist: planDoc.youtubePlaylist || '',
            syllabusFileName: planDoc.syllabusFileName || null,
            notesFileName: planDoc.notesFileName || null,
        },
        createdAt: planDoc.createdAt,
        updatedAt: planDoc.updatedAt,
    };
};

const getChatPrompt = ({ subject, question, context }) => {
    return `
You are a friendly and concise study assistant for engineering students.

Subject: ${subject || 'Not provided'}
Question: ${question}
Context: ${context || 'None'}

Provide:
1) A direct answer in 4-8 lines.
2) A short "Next steps" list with 3 bullet points.
3) Keep language clear and practical.
`;
};

const getChapterGuidancePrompt = ({ subject, chapterName, goal, examType }) => {
    return `
You are an expert tutor. Provide focused guidance for one chapter.

Subject: ${subject || 'Not provided'}
Chapter: ${chapterName}
Goal: ${goal || 'Understand concepts'}
Exam Type: ${examType || 'Not provided'}

Return JSON with this shape only:
{
  "overview": "2-3 lines",
  "mustKnowTopics": ["4-7 bullet items"],
  "practicePlan": ["4-6 actionable tasks"],
  "commonMistakes": ["3-5 pitfalls to avoid"]
}
`;
};

const getQuestionAnswerPrompt = ({ subject, question, difficulty }) => {
    return `
You are a subject expert helping a student.

Subject: ${subject || 'Not provided'}
Question: ${question}
Difficulty: ${difficulty || 'medium'}

Return JSON only:
{
  "answer": "clear explanation",
  "keyPoints": ["3-6 key points"],
  "quickRevision": "1 short recap paragraph"
}
`;
};

// Generate a study plan using Gemini API
export const generatePlan = async (req, res) => {
    try {
        const { subject, learningGoal, examType, youtubePlaylist, branch, semester } = req.body;
        const chapters = normalizeChapters(req.body.chapters);
        const prepWeeks = Number(req.body.prepWeeks);
        const syllabusFile = req.files?.syllabusPdf?.[0] || req.file;
        const notesFile = req.files?.notesPdf?.[0] || null;
        const syllabusText = await parseSyllabusPdfText(syllabusFile);
        const notesText = await parseSyllabusPdfText(notesFile);

        // Validate required fields
        if (!subject || chapters.length === 0 || !prepWeeks || Number.isNaN(prepWeeks)) {
            return res.status(400).json({
                success: false,
                message: 'Subject, chapters, and prepWeeks are required',
            });
        }

        if (!syllabusFile) {
            return res.status(400).json({
                success: false,
                message: 'Syllabus PDF is required. Upload it using syllabusPdf field.',
            });
        }

        if (!youtubePlaylist || !isValidYoutubePlaylistUrl(youtubePlaylist)) {
            return res.status(400).json({
                success: false,
                message: 'A valid YouTube playlist URL is required (must include a list parameter).',
            });
        }

        // Create prompt for Gemini
        const prompt = `
You are an expert academic advisor. Create a personalized study plan for the following:

Subject: ${subject}
Branch: ${branch || 'Not provided'}
Semester: ${semester || 'Not provided'}
Learning Goal: ${learningGoal}
Exam Type: ${examType}
Preparation Time: ${prepWeeks} week(s)
Chapters to Cover: ${chapters.join(', ')}
YouTube Playlist: ${youtubePlaylist}
Syllabus from PDF:
${syllabusText.slice(0, 12000) || 'Syllabus text could not be extracted from PDF.'}

Notes from PDF (optional):
${notesText.slice(0, 12000) || 'No notes PDF was uploaded or text could not be extracted.'}

Generate a comprehensive study plan in JSON format with the following structure:
{
    "summary": "A 2-3 sentence personalized study strategy summary",
    "roadmap": [
        "Week-by-week or phase-by-phase study breakdown (4-6 items)",
        "Include specific chapters/topics for each phase",
        "Consider the exam type and learning goal"
    ],
    "dailyRoutine": [
        "Specific daily study activities (4-6 items)",
        "Include timing and activities like 'Review notes for 30 mins'",
        "Balance theory and practice based on learning goal"
    ],
    "tips": [
        "Study tips specific to the subject (5-7 tips)",
        "Include exam-specific strategies",
        "Add tips for the learning goal"
    ],
    "videoPlan": [
        "Week-by-week video watching plan mapped to chapters from the provided playlist (4-7 items)",
        "Mention what to watch, what to skip, and what to revise",
        "Recommend order and approximate watch/revision time"
    ]
}

Ensure all arrays have 4-7 items each. Return ONLY valid JSON, no markdown formatting.`;

        // Call Gemini API using the official GoogleGenAI client.
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        const responseText = response.text || '';

        // Parse the response
        const parsedPlan = parseGeminiResponse(responseText);

        if (!parsedPlan || !parsedPlan.summary || !parsedPlan.roadmap || !parsedPlan.dailyRoutine || !parsedPlan.tips) {
            // Fallback plan if parsing fails
            const fallbackPlan = {
                summary: `Create a focused ${prepWeeks}-week study plan for ${subject} targeting ${(learningGoal || 'your objective').toLowerCase()}. Prioritize understanding key concepts and ${chapters.length > 0 ? chapters.slice(0, 2).join(' and ') : 'core topics'}.`,
                roadmap: [
                    `Week 1: Foundation - Study ${chapters[0] || 'foundational concepts'}`,
                    `Week 2-${Math.floor(prepWeeks / 2)}: Core Concepts - Master ${chapters.slice(1, 3).join(', ') || 'main topics'}`,
                    `Week ${Math.floor(prepWeeks / 2) + 1}-${prepWeeks - 1}: Practice - Work through problems and derivations`,
                    `Final Week: Revision - Consolidate and review all chapters`,
                ],
                dailyRoutine: [
                    '08:00-09:30 AM: Theory Review (30 mins) + Problem Solving (30 mins)',
                    '10:00-11:30 AM: Concept Deep Dive - Study new topics',
                    '02:00-03:30 PM: Practice - Solve numericals/MCQs (Based on learning goal)',
                    '04:00-05:00 PM: Quick Revision - Review key points and formulas',
                ],
                tips: [
                    `Focus on ${(learningGoal || 'your learning objective').toLowerCase()} - align study materials accordingly`,
                    'Create a concept map showing how chapters relate to each other',
                    'Practice past exam papers regularly',
                    'Group similar topics and learn them together',
                    'Take timed practice tests weekly',
                    'Maintain a formula/concept sheet for quick revision',
                ],
                videoPlan: [
                    `Week 1: Watch introductory videos from the playlist for ${chapters[0] || 'core fundamentals'} and note key formulas.`,
                    `Weeks 2-${Math.max(2, Math.floor(prepWeeks / 2))}: Watch concept videos for ${chapters.slice(1, 3).join(', ') || 'core chapters'} and solve related problems after each video.`,
                    `Weeks ${Math.floor(prepWeeks / 2) + 1}-${Math.max(prepWeeks - 1, Math.floor(prepWeeks / 2) + 1)}: Use advanced/problem-solving videos to strengthen exam-level practice.`,
                    `Final Week: Re-watch bookmarked difficult segments from ${youtubePlaylist} at 1.25x and revise notes.`,
                ],
            };

            const savedPlan = await StudyPlan.create({
                subject,
                branch: branch || '',
                semester: semester ? Number(semester) : null,
                learningGoal,
                examType,
                chapters,
                prepWeeks,
                summary: fallbackPlan.summary,
                roadmap: fallbackPlan.roadmap,
                dailyRoutine: fallbackPlan.dailyRoutine,
                tips: fallbackPlan.tips,
                videoPlan: fallbackPlan.videoPlan,
                youtubePlaylist,
                syllabusFileName: syllabusFile?.originalname || null,
                notesFileName: notesFile?.originalname || null,
                userId: req.user?.id || null,
                status: 'active',
            });

            return res.status(200).json({
                success: true,
                message: 'Study plan generated successfully',
                data: {
                    ...fallbackPlan,
                    id: savedPlan._id,
                    resources: {
                        youtubePlaylist,
                        syllabusFileName: syllabusFile?.originalname || null,
                        notesFileName: notesFile?.originalname || null,
                    },
                },
            });
        }

        const resolvedPlan = {
            summary: parsedPlan.summary,
            roadmap: Array.isArray(parsedPlan.roadmap) ? parsedPlan.roadmap : [],
            dailyRoutine: Array.isArray(parsedPlan.dailyRoutine) ? parsedPlan.dailyRoutine : [],
            tips: Array.isArray(parsedPlan.tips) ? parsedPlan.tips : [],
            videoPlan: Array.isArray(parsedPlan.videoPlan) ? parsedPlan.videoPlan : [],
        };

        const savedPlan = await StudyPlan.create({
            subject,
            branch: branch || '',
            semester: semester ? Number(semester) : null,
            learningGoal,
            examType,
            chapters,
            prepWeeks,
            summary: resolvedPlan.summary,
            roadmap: resolvedPlan.roadmap,
            dailyRoutine: resolvedPlan.dailyRoutine,
            tips: resolvedPlan.tips,
            videoPlan: resolvedPlan.videoPlan,
            youtubePlaylist,
            syllabusFileName: syllabusFile?.originalname || null,
            notesFileName: notesFile?.originalname || null,
            userId: req.user?.id || null,
            status: 'active',
        });

        return res.status(200).json({
            success: true,
            message: 'Study plan generated successfully',
            data: {
                id: savedPlan._id,
                summary: resolvedPlan.summary,
                roadmap: resolvedPlan.roadmap,
                dailyRoutine: resolvedPlan.dailyRoutine,
                tips: resolvedPlan.tips,
                videoPlan: resolvedPlan.videoPlan,
                resources: {
                    youtubePlaylist,
                    syllabusFileName: syllabusFile?.originalname || null,
                    notesFileName: notesFile?.originalname || null,
                },
            },
        });
    } catch (error) {
        console.error('Error generating study plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate study plan',
            error: error.message,
        });
    }
};

export const chat = async (req, res, next) => {
    try {
        const { question, subject, context } = req.body;

        if (!question || !String(question).trim()) {
            throw toError('question is required', 400);
        }

        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: getChatPrompt({ subject, question, context }),
        });

        const answer = (response.text || '').trim();

        res.status(200).json({
            success: true,
            message: 'Chat response generated',
            data: {
                answer: answer || 'No response generated. Please try again.',
            },
        });
    } catch (err) {
        next(err);
    }
};

export const getChapterGuidance = async (req, res, next) => {
    try {
        const { chapterName, subject, goal, examType } = req.body;

        if (!chapterName || !String(chapterName).trim()) {
            throw toError('chapterName is required', 400);
        }

        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: getChapterGuidancePrompt({ subject, chapterName, goal, examType }),
        });

        const responseText = response.text || '';
        const parsed = parseGeminiResponse(responseText);

        if (!parsed) {
            return res.status(200).json({
                success: true,
                message: 'Chapter guidance generated',
                data: {
                    overview: `Focus on ${chapterName} by first building concept clarity and then moving to problems.`,
                    mustKnowTopics: [
                        `Core definitions and notation in ${chapterName}`,
                        'Common exam-oriented problem patterns',
                        'Short derivations and frequently tested results',
                        'How this chapter connects to previous units',
                    ],
                    practicePlan: [
                        'Read one concise concept source and make quick notes',
                        'Solve 10-15 representative questions',
                        'Review mistakes and retry without solutions',
                        'End with a timed mini-test',
                    ],
                    commonMistakes: [
                        'Memorizing steps without understanding assumptions',
                        'Skipping unit-wise formula revision',
                        'Not practicing mixed-difficulty questions',
                    ],
                },
            });
        }

        res.status(200).json({
            success: true,
            message: 'Chapter guidance generated',
            data: {
                overview: parsed.overview || '',
                mustKnowTopics: Array.isArray(parsed.mustKnowTopics) ? parsed.mustKnowTopics : [],
                practicePlan: Array.isArray(parsed.practicePlan) ? parsed.practicePlan : [],
                commonMistakes: Array.isArray(parsed.commonMistakes) ? parsed.commonMistakes : [],
            },
        });
    } catch (err) {
        next(err);
    }
};

export const answerQuestion = async (req, res, next) => {
    try {
        const { question, subject, difficulty } = req.body;

        if (!question || !String(question).trim()) {
            throw toError('question is required', 400);
        }

        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: getQuestionAnswerPrompt({ subject, question, difficulty }),
        });

        const parsed = parseGeminiResponse(response.text || '');

        if (!parsed) {
            return res.status(200).json({
                success: true,
                message: 'Answer generated',
                data: {
                    answer: 'Could not parse structured output, but your question is valid. Try rephrasing for a targeted explanation.',
                    keyPoints: [
                        'Identify what exactly is being asked',
                        'List known values and assumptions',
                        'Apply the relevant concept step by step',
                    ],
                    quickRevision: 'Focus on concept basics first, then solve one example and one variation.',
                },
            });
        }

        res.status(200).json({
            success: true,
            message: 'Answer generated',
            data: {
                answer: parsed.answer || '',
                keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
                quickRevision: parsed.quickRevision || '',
            },
        });
    } catch (err) {
        next(err);
    }
};

export const getUserPlans = async (req, res, next) => {
    try {
        const plans = await StudyPlan.find({ userId: req.user.id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: plans.length,
            plans: plans.map(getPlanPayloadFromDoc),
        });
    } catch (err) {
        next(err);
    }
};

export const getPlanDetails = async (req, res, next) => {
    try {
        const { id } = req.params;

        const plan = await StudyPlan.findOne({ _id: id, userId: req.user.id });

        if (!plan) {
            throw toError('Study plan not found', 404);
        }

        res.status(200).json({
            success: true,
            plan: getPlanPayloadFromDoc(plan),
        });
    } catch (err) {
        next(err);
    }
};

export const updatePlanStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'completed', 'archived'].includes(status)) {
            throw toError('Invalid status. Allowed: active, completed, archived', 400);
        }

        const updatedPlan = await StudyPlan.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            { status, updatedAt: new Date() },
            { new: true }
        );

        if (!updatedPlan) {
            throw toError('Study plan not found', 404);
        }

        res.status(200).json({
            success: true,
            message: 'Study plan status updated',
            plan: getPlanPayloadFromDoc(updatedPlan),
        });
    } catch (err) {
        next(err);
    }
};
