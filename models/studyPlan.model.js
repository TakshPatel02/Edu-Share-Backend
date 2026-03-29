import { Schema, model } from "mongoose";

const studyPlanSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        learningGoal: {
            type: String,
            required: true,
        },
        examType: {
            type: String,
            enum: ['Mid Sem', 'End Sem'],
            required: true,
        },
        syllabus: {
            type: String,
            default: '',
        },
        chapters: {
            type: [String],
            default: [],
        },
        prepWeeks: {
            type: Number,
            default: 2,
        },
        personalizationData: {
            summary: String,
            roadmap: [String],
            dailyRoutine: [String],
            tips: [String],
        },
        conversationHistory: [
            {
                role: {
                    type: String,
                    enum: ['user', 'assistant'],
                },
                content: String,
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        status: {
            type: String,
            enum: ['draft', 'active', 'completed'],
            default: 'active',
        },
    },
    { timestamps: true }
);

export const StudyPlan = model('StudyPlan', studyPlanSchema);
