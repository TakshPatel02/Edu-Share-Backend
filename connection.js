import mongoose from "mongoose";

export const connectDB = async (connectionURL) => {
    try {
        if (!connectionURL) {
            throw new Error("MONGODB_URL is not configured");
        }

        const conn = await mongoose.connect(connectionURL);
        return conn;
    } catch (err) {
        console.error("Database connection error:", err);
        throw err;
    }
}