import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';

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

            return res.status(200).json({
                success: true,
                message: 'Study plan generated successfully',
                data: fallbackPlan,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Study plan generated successfully',
            data: {
                summary: parsedPlan.summary,
                roadmap: Array.isArray(parsedPlan.roadmap) ? parsedPlan.roadmap : [],
                dailyRoutine: Array.isArray(parsedPlan.dailyRoutine) ? parsedPlan.dailyRoutine : [],
                tips: Array.isArray(parsedPlan.tips) ? parsedPlan.tips : [],
                videoPlan: Array.isArray(parsedPlan.videoPlan) ? parsedPlan.videoPlan : [],
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
