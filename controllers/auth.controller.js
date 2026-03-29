import bcrypt from 'bcrypt';
import { User } from '../models/user.model.js';
import { generateToken } from '../utils/token.js';

const isValidEmail = (email = '') => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const signup = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            const error = new Error('name, email and password are required');
            error.statusCode = 400;
            throw error;
        }

        if (!isValidEmail(email)) {
            const error = new Error('Invalid email format');
            error.statusCode = 400;
            throw error;
        }

        if (String(password).length < 6) {
            const error = new Error('Password must be at least 6 characters long');
            error.statusCode = 400;
            throw error;
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });

        if (existingUser) {
            const error = new Error('User already exists with this email');
            error.statusCode = 409;
            throw error;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'user',
        });

        const token = generateToken({
            id: newUser._id,
            role: newUser.role,
        });

        res.status(201).json({
            success: true,
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            const error = new Error('email and password are required');
            error.statusCode = 400;
            throw error;
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        const token = generateToken({
            id: user._id,
            role: user.role,
        });

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const me = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            user,
        });
    } catch (err) {
        next(err);
    }
};
