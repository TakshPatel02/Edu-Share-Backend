import { google } from 'googleapis';
import { Readable } from 'stream';

const getGoogleDriveClient = () => {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        throw new Error('Google Drive credentials are not configured');
    }

    const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({
        version: 'v3',
        auth,
    });
};

const buildPublicUrl = (fileId) => {
    return `https://drive.google.com/uc?id=${fileId}&export=download`;
};

const getDriveFolderId = () => {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

    if (!folderId) {
        const error = new Error('GOOGLE_DRIVE_FOLDER_ID is missing. Set it to a folder inside a Shared Drive that the service account can access.');
        error.statusCode = 500;
        throw error;
    }

    return folderId;
};

const normalizeDriveError = (err) => {
    const apiMessage = err?.response?.data?.error?.message || err?.message || 'Google Drive upload failed';

    if (String(apiMessage).includes('Service Accounts do not have storage quota')) {
        const error = new Error('Google Drive upload failed: Service account cannot upload to My Drive. Use a Shared Drive folder, share it with the service account, and set GOOGLE_DRIVE_FOLDER_ID to that folder.');
        error.statusCode = 500;
        return error;
    }

    const error = new Error(apiMessage);
    error.statusCode = 500;
    return error;
};

const ensureSharedDriveFolderAccess = async (drive, folderId) => {
    try {
        const folder = await drive.files.get({
            fileId: folderId,
            supportsAllDrives: true,
            fields: 'id,name,mimeType,driveId',
        });

        if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
            const error = new Error('GOOGLE_DRIVE_FOLDER_ID must reference a folder, not a file.');
            error.statusCode = 500;
            throw error;
        }

        if (!folder.data.driveId) {
            const error = new Error('Configured folder is in My Drive. Service accounts require a Shared Drive folder. Move/create this folder in a Shared Drive and update GOOGLE_DRIVE_FOLDER_ID.');
            error.statusCode = 500;
            throw error;
        }
    } catch (err) {
        throw normalizeDriveError(err);
    }
};

export const uploadPdfToDrive = async ({ buffer, filename, mimeType }) => {
    const drive = getGoogleDriveClient();
    const folderId = getDriveFolderId();

    await ensureSharedDriveFolderAccess(drive, folderId);

    try {
        const uploadResponse = await drive.files.create({
            supportsAllDrives: true,
            requestBody: {
                name: filename,
                parents: [folderId],
            },
            media: {
                mimeType,
                body: Readable.from(buffer),
            },
            fields: 'id,name',
        });

        const fileId = uploadResponse.data.id;

        await drive.permissions.create({
            fileId,
            supportsAllDrives: true,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return {
            fileId,
            fileUrl: buildPublicUrl(fileId),
        };
    } catch (err) {
        throw normalizeDriveError(err);
    }
};
