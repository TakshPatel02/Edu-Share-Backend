import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { getJwtSecret } from "../utils/token.js";

export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, getJwtSecret());

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        req.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        };

        next();

    } catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }
}