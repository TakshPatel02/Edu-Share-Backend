import jwt from "jsonwebtoken";

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET?.trim();

    if (!secret) {
        const error = new Error("JWT_SECRET is missing. Add it to backend .env and restart the server.");
        error.statusCode = 500;
        throw error;
    }

    return secret;
};

const generateToken = (user) => {
    return jwt.sign(
        user,
        getJwtSecret(),
        { expiresIn: '7d' }
    );
}

export {
    generateToken,
    getJwtSecret,
}