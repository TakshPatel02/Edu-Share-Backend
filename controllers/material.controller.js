import { Material } from '../models/material.model.js';
import { buildPdfViewUrl, uploadPdfToCloudinary } from '../utils/cloudinary.js';

const BRANCHES = new Set(['IT', 'CE', 'CSE']);
const CATEGORIES = new Set(['syllabus', 'papers', 'notes', 'playlists', 'solutions', 'books']);
const TYPES = new Set(['PDF', 'Link']);

const toError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const validateUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

const validateMaterialPayload = ({ title, branch, semester, subject, category, type }) => {
    if (!title || !branch || !semester || !subject || !category || !type) {
        throw toError('title, branch, semester, subject, category and type are required', 400);
    }

    if (!BRANCHES.has(branch)) {
        throw toError('Invalid branch. Allowed: IT, CE, CSE', 400);
    }

    const semesterNum = Number(semester);
    if (!Number.isInteger(semesterNum) || semesterNum < 1 || semesterNum > 8) {
        throw toError('semester must be an integer between 1 and 8', 400);
    }

    if (!CATEGORIES.has(category)) {
        throw toError('Invalid category', 400);
    }

    const normalizedType = String(type).toUpperCase();
    if (!TYPES.has(normalizedType)) {
        throw toError('Invalid type. Allowed: PDF or Link', 400);
    }

    return {
        semesterNum,
        normalizedType,
    };
};

const resolveFileInfo = async ({ type, file, fileUrl }) => {
    if (type === 'PDF') {
        if (!file) {
            throw toError('PDF file is required when type is PDF', 400);
        }

        const cloudinaryResponse = await uploadPdfToCloudinary({
            buffer: file.buffer,
            filename: file.originalname,
        });

        return {
            fileId: cloudinaryResponse.fileId,
            resolvedUrl: cloudinaryResponse.fileUrl,
        };
    }

    if (!fileUrl || !validateUrl(fileUrl)) {
        throw toError('A valid fileUrl is required when type is Link', 400);
    }

    return {
        fileId: null,
        resolvedUrl: fileUrl,
    };
};

const withPdfViewUrl = (materialDoc) => {
    const material = materialDoc?.toObject ? materialDoc.toObject() : materialDoc;

    if (material?.type === 'PDF' && material?.fileId) {
        return {
            ...material,
            fileUrl: buildPdfViewUrl(material.fileId),
        };
    }

    return material;
};

export const getMaterials = async (req, res, next) => {
    try {
        const { branch, semester, subject, category } = req.query;

        const filter = { status: 'approved' };

        if (branch) {
            filter.branch = branch;
        }

        if (semester) {
            filter.semester = Number(semester);
        }

        if (subject) {
            filter.subject = subject;
        }

        if (category) {
            filter.category = category;
        }

        const materials = await Material.find(filter)
            .populate('uploadedBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: materials.length,
            materials: materials.map(withPdfViewUrl),
        });
    } catch (err) {
        next(err);
    }
};

export const createMaterial = async (req, res, next) => {
    try {
        const { title, description, branch, semester, subject, category, type, fileUrl } = req.body;

        const { semesterNum, normalizedType } = validateMaterialPayload({
            title,
            branch,
            semester,
            subject,
            category,
            type,
        });

        const { fileId, resolvedUrl } = await resolveFileInfo({
            type: normalizedType,
            file: req.file,
            fileUrl,
        });

        const material = await Material.create({
            title,
            description,
            branch,
            semester: semesterNum,
            subject,
            category,
            type: normalizedType,
            fileUrl: resolvedUrl,
            fileId,
            uploadedBy: req.user.id,
            status: 'pending',
        });

        res.status(201).json({
            success: true,
            message: 'Material uploaded successfully and sent for approval',
            material: withPdfViewUrl(material),
        });
    } catch (err) {
        next(err);
    }
};

export { validateMaterialPayload, resolveFileInfo };
