import { GoogleGenAI } from '@google/genai';

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

// Generate a study plan using Gemini API
export const generatePlan = async (req, res) => {
    try {
        const { subject, learningGoal, examType, syllabus, chapters, prepWeeks } = req.body;

        // Validate required fields
        if (!subject || !chapters || chapters.length === 0 || !prepWeeks) {
            return res.status(400).json({
                success: false,
                message: 'Subject, chapters, and prepWeeks are required',
            });
        }

        // Create prompt for Gemini
        const prompt = `
You are an expert academic advisor. Create a personalized study plan for the following:

Subject: ${subject}
Learning Goal: ${learningGoal}
Exam Type: ${examType}
Preparation Time: ${prepWeeks} week(s)
Chapters to Cover: ${chapters.join(', ')}
${syllabus ? `Syllabus Overview: ${syllabus}` : ''}

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
                summary: `Create a focused ${prepWeeks}-week study plan for ${subject} targeting ${learningGoal.toLowerCase()}. Prioritize understanding key concepts and ${chapters.length > 0 ? chapters.slice(0, 2).join(' and ') : 'core topics'}.`,
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
                    `Focus on ${learningGoal.toLowerCase()} - align study materials accordingly`,
                    'Create a concept map showing how chapters relate to each other',
                    'Practice past exam papers regularly',
                    'Group similar topics and learn them together',
                    'Take timed practice tests weekly',
                    'Maintain a formula/concept sheet for quick revision',
                ]
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
