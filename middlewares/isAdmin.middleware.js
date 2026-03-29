const isAdmin = async (req, res, next) => {
    try {
        const user = req.user;

        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Admins only'
            });
        }

        next();

    } catch (err) {
        console.error('Authorization error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        })
    }
}

export default isAdmin;