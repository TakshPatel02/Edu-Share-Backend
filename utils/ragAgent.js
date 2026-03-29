import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const initializeGemini = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    return new GoogleGenerativeAI(apiKey);
};

// System prompt for study guide generation
const STUDY_GUIDE_SYSTEM_PROMPT = `You are an expert educational advisor and study guide generator. Your role is to create personalized study plans for students preparing for exams.

When generating study plans:
1. Analyze the subject, learning goals, exam type, and available time
2. Create a realistic breakdown of study phases (concept learning, practice, revision)
3. Provide specific recommendations for exam-type preparation (Mid Sem vs End Sem)
4. Generate daily routine suggestions with time allocations
5. Offer smart study tips based on the subject and learning goal
6. Consider chapter/unit-specific strategies

Be encouraging, practical, and specific in your recommendations.`;

// Fallback plan generator (when API is unavailable)
const generateFallbackPlan = ({ subject, goal, examType, weeks, chapters }) => {
    const cleanedChapters = chapters.filter(Boolean);
    const chapterList = cleanedChapters.length > 0 ? cleanedChapters : ['Core syllabus topics'];

    const totalDays = Math.max(7, Number(weeks || 2) * 7);
    const conceptDays = Math.max(2, Math.floor(totalDays * 0.4));
    const practiceDays = Math.max(2, Math.floor(totalDays * 0.35));

    const tone = examType === 'Mid Sem' ? 'focused and selective' : 'comprehensive and depth-first';

    return {
        summary: `You are preparing for ${subject} with a ${tone} approach for ${examType}.`,
        roadmap: [
            `Days 1-${conceptDays}: Build concept clarity with short theory notes and examples from ${chapterList.slice(0, 2).join(' and ')}.`,
            `Days ${conceptDays + 1}-${conceptDays + practiceDays}: Solve previous-year and module questions, especially from ${chapterList.slice(0, 3).join(', ')}.`,
            `Days ${conceptDays + practiceDays + 1}-${totalDays}: Quick revision loops, formula sheet, and timed mock practice.`,
        ],
        dailyRoutine: [
            '45 min concept reading & note-taking',
            '60 min focused question-solving',
            '20 min active recall & error log',
            '10 min planning next day topics',
        ],
        tips: [
            `Primary Goal: ${goal}. Structure your sessions around this objective.`,
            'After each study block, create 3 self-test questions and answer without looking at notes.',
            'Maintain a one-page chapter summary to compress revision load before exam week.',
        ],
        usingFallback: true,
    };
};

export const generatePersonalizedStudyPlan = async ({
    subject,
    learningGoal,
    examType,
    syllabus,
    chapters,
    prepWeeks,
}) => {
    try {
        const genAI = initializeGemini();
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const userPrompt = `${STUDY_GUIDE_SYSTEM_PROMPT}

Generate a comprehensive, personalized study plan with the following details:

**Subject**: ${subject}
**Learning Goal**: ${learningGoal}
**Exam Type**: ${examType}
**Available Preparation Time**: ${prepWeeks} weeks
**Chapters/Units Being Examined**: ${chapters?.join(', ') || 'General syllabus'}
**Syllabus Overview**: ${syllabus || 'Standard curriculum'}

Please provide:
1. A brief summary of the recommended approach
2. Day-wise breakdown of the study roadmap (concept learning → practice → revision)
3. Recommended daily routine with time allocations
4. Specific smart tips for effective preparation
5. Resource recommendations if applicable

Format your response in clear sections with bullet points.`;

        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        const planContent = response.text();

        // Parse the response into sections
        const roadmapMatch = planContent.match(/roadmap[:\s]*([\s\S]*?)(?=daily routine|daily schedule|$)/i);
        const dailyMatch = planContent.match(/daily routine[:\s]*([\s\S]*?)(?=smart tips|tips|$)/i);
        const tipsMatch = planContent.match(/smart tips[:\s]*([\s\S]*?)$/i);

        return {
            summary: `You are preparing for ${subject} with a ${examType === 'Mid Sem' ? 'focused' : 'comprehensive'} approach.`,
            roadmap: roadmapMatch ? roadmapMatch[1].trim().split('\n').filter((l) => l.trim()) : ['Study plan generated successfully'],
            dailyRoutine: dailyMatch ? dailyMatch[1].trim().split('\n').filter((l) => l.trim()).slice(0, 4) : ['45 min concept reading', '60 min practice', '20 min review', '10 min planning'],
            tips: tipsMatch ? tipsMatch[1].trim().split('\n').filter((l) => l.trim()).slice(0, 3) : ['Review regularly', 'Practice consistently', 'Stay motivated'],
            rawPlan: planContent,
        };
    } catch (error) {
        console.warn('Gemini API error, using fallback generator:', error.message);

        // Use fallback generator when LLM fails
        return generateFallbackPlan({
            subject,
            goal: learningGoal,
            examType,
            weeks: prepWeeks,
            chapters: chapters || [],
        });
    }
};

// Chat conversation for interactive study guidance
export const createStudyGuidanceChat = async (messages = [], userMessage) => {
    try {
        const genAI = initializeGemini();
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        // Build conversation context from message history
        let conversationContext = STUDY_GUIDE_SYSTEM_PROMPT + '\n\n';
        if (messages.length > 0) {
            conversationContext += 'Previous conversation:\n';
            messages.forEach(msg => {
                conversationContext += `${msg.role === 'user' ? 'Student' : 'Advisor'}: ${msg.content}\n`;
            });
            conversationContext += '\n';
        }

        const prompt = conversationContext + `Student's current question: ${userMessage}\n\nProvide helpful, specific study advice.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const assistantResponse = response.text();

        return {
            userMessage,
            assistantResponse,
        };
    } catch (error) {
        console.error('Error in study guidance chat:', error.message);
        throw new Error(`Failed to create chat: ${error.message}`);
    }
};

// Generate specific chapter recommendations
export const generateChapterGuidance = async ({ subject, chapter, examType }) => {
    try {
        const genAI = initializeGemini();
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        const prompt = `You are an expert study guide generator for engineering students. Provide focused study guidance for this specific chapter:

**Subject**: ${subject}
**Chapter/Topic**: ${chapter}
**Exam Type**: ${examType}

Provide:
1. Key concepts to focus on (3-5 concepts)
2. Common exam questions/patterns
3. Study strategy for this chapter (time allocation, approach)
4. Practice recommendations
5. Important formulas or definitions (if applicable)

Keep response concise and practical.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const guidance = response.text();

        return {
            chapter,
            guidance,
        };
    } catch (error) {
        console.error('Error generating chapter guidance:', error.message);
        throw new Error(`Failed to generate chapter guidance: ${error.message}`);
    }
};

// Answer student questions about a subject
export const answerSubjectQuestion = async ({ subject, question, context = '' }) => {
    try {
        const genAI = initializeGemini();
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        const prompt = `You are an expert tutor helping engineering students understand complex concepts. Be clear, concise, and educational.

Subject: ${subject}
${context ? `Context/Chapter: ${context}` : ''}

Student Question: ${question}

Provide a clear, educational answer that helps the student understand the concept. Include examples if relevant.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const answer = response.text();

        return {
            question,
            answer,
        };
    } catch (error) {
        console.error('Error answering subject question:', error.message);
        throw new Error(`Failed to answer question: ${error.message}`);
    }
};
