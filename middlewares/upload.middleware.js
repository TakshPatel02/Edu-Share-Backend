import multer from 'multer';

const storage = multer.memoryStorage();

const pdfOnlyFilter = (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
        return cb(new Error('Only PDF files are allowed'));
    }

    cb(null, true);
};

export const uploadPdf = multer({
    storage,
    fileFilter: pdfOnlyFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});
