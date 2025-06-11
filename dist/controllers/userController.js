import prisma from "../config/prisma";
export const UserController = {
    getCurrentUser: async (req, res) => {
        try {
            const user = await prisma.user.findUnique({
                where: {
                    id: req.user.id,
                },
            });
            return res.status(200).json({
                name: user?.full_name,
                email: user?.email,
                role: user?.role,
            });
        }
        catch (err) {
            return res.status(500).json({
                error: err.message,
            });
        }
    },
};
