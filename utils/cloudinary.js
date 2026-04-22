import { v2 as cloudinary } from 'cloudinary';

let isCloudinaryConfigured = false;

const getCloudinaryConfig = () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
        const error = new Error('Cloudinary credentials are not configured');
        error.statusCode = 500;
        throw error;
    }

    return { cloudName, apiKey, apiSecret };
};

const configureCloudinary = () => {
    if (isCloudinaryConfigured) {
        return;
    }

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    isCloudinaryConfigured = true;
};

const getCloudinaryFolder = () => {
    return process.env.CLOUDINARY_FOLDER?.trim() || 'edushare/materials';
};

const normalizePublicIdForPdf = (publicId = '') => {
    if (publicId.toLowerCase().endsWith('.pdf')) {
        return publicId.slice(0, -4);
    }

    return publicId;
};

export const buildPdfViewUrl = (publicId) => {
    configureCloudinary();

    const normalizedPublicId = normalizePublicIdForPdf(publicId);

    return cloudinary.url(normalizedPublicId, {
        resource_type: 'image',
        type: 'upload',
        format: 'pdf',
        secure: true,
        sign_url: false,
    });
};

export const uploadPdfToCloudinary = async ({ buffer, filename }) => {
    configureCloudinary();

    if (!buffer || !filename) {
        const error = new Error('Invalid file payload for Cloudinary upload');
        error.statusCode = 400;
        throw error;
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'image',
                type: 'upload',
                folder: getCloudinaryFolder(),
                use_filename: true,
                unique_filename: true,
                filename_override: filename,
                format: 'pdf',
                overwrite: false,
            },
            (err, result) => {
                if (err || !result) {
                    const error = new Error(err?.message || 'Cloudinary upload failed');
                    error.statusCode = 500;
                    reject(error);
                    return;
                }

                resolve({
                    fileId: result.public_id,
                    fileUrl: buildPdfViewUrl(result.public_id),
                });
            },
        );

        uploadStream.end(buffer);
    });
};
