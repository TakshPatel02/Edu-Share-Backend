import { Material } from '../models/material.model.js';
import { resolveFileInfo, validateMaterialPayload } from './material.controller.js';
import { buildPdfViewUrl } from '../utils/cloudinary.js';

const toError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
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

export const getAdminMaterials = async (req, res, next) => {
    try {
        const { status = 'pending' } = req.query;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            throw toError('Invalid status filter', 400);
        }

        const materials = await Material.find({ status })
            .populate('uploadedBy', 'name email role')
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

export const approveMaterial = async (req, res, next) => {
    try {
        const { id } = req.params;

        const material = await Material.findByIdAndUpdate(
            id,
            { status: 'approved' },
            { new: true }
        );

        if (!material) {
            throw toError('Material not found', 404);
        }

        res.status(200).json({
            success: true,
            message: 'Material approved successfully',
            material: withPdfViewUrl(material),
        });
    } catch (err) {
        next(err);
    }
};

export const rejectMaterial = async (req, res, next) => {
    try {
        const { id } = req.params;

        const material = await Material.findByIdAndUpdate(
            id,
            { status: 'rejected' },
            { new: true }
        );

        if (!material) {
            throw toError('Material not found', 404);
        }

        res.status(200).json({
            success: true,
            message: 'Material rejected successfully',
            material: withPdfViewUrl(material),
        });
    } catch (err) {
        next(err);
    }
};

export const createAdminMaterial = async (req, res, next) => {
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
            status: 'approved',
        });

        res.status(201).json({
            success: true,
            message: 'Material uploaded and approved',
            material: withPdfViewUrl(material),
        });
    } catch (err) {
        next(err);
    }
};
