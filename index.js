import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { connectDB } from './connection.js';
import authRouter from './routes/auth.routes.js';
import materialRouter from './routes/material.routes.js';
import adminRouter from './routes/admin.routes.js';
import studyGuideRouter from './routes/studyGuide.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT;
connectDB(process.env.MONGODB_URL).then(() => console.log('Database connected'));

app.use(cors({
    origin: true,
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'EduShare backend is running',
    });
});

app.use('/api/auth', authRouter);
app.use('/api/materials', materialRouter);
app.use('/api/admin', adminRouter);
app.use('/api/study-guide', studyGuideRouter);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});