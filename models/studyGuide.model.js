import mongoose from 'mongoose';

const StudyPlanSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true,
    },
    learningGoal: {
        type: String,
        enum: [
            'Understand concepts from zero',
            'Revise quickly before exam',
            'Practice numericals and derivations',
            'Score 9+ CGPA in this subject'
        ],
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
        required: true,
    },
    prepWeeks: {
        type: Number,
        required: true,
        min: 1,
        max: 8,
    },
    // AI Generated Content
    summary: {
        type: String,
        required: true,
    },
    roadmap: {
        type: [String],
        required: true,
    },
    dailyRoutine: {
        type: [String],
        required: true,
    },
    tips: {
        type: [String],
        required: true,
    },
    // User association (optional)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'archived'],
        default: 'active',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update updatedAt on save
StudyPlanSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

export const StudyPlan = mongoose.model('StudyPlan', StudyPlanSchema);
