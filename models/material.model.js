import { Schema, model } from 'mongoose';

const BRANCHES = ['IT', 'CE', 'CSE'];
const CATEGORIES = ['syllabus', 'papers', 'notes', 'playlists', 'solutions', 'books'];
const MATERIAL_TYPES = ['PDF', 'Link'];
const MATERIAL_STATUS = ['pending', 'approved', 'rejected'];

const materialSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
        branch: {
            type: String,
            enum: BRANCHES,
            required: true,
        },
        semester: {
            type: Number,
            min: 1,
            max: 8,
            required: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            enum: CATEGORIES,
            required: true,
        },
        type: {
            type: String,
            enum: MATERIAL_TYPES,
            required: true,
        },
        fileUrl: {
            type: String,
            required: true,
            trim: true,
        },
        fileId: {
            type: String,
            default: null,
            trim: true,
        },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: MATERIAL_STATUS,
            default: 'pending',
        },
    },
    { timestamps: true }
);

export const Material = model('Material', materialSchema);
