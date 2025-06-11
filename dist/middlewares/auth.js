import jwt from "jsonwebtoken";
import { sendOTP } from "../libs/mailer";
import bcrypt from "bcryptjs";
import { tokenBlacklist } from "../controllers/authController";
import prisma from "../config/prisma";
export const ensureAuthenticated = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ message: "Access token not found" });
        return;
    }
    const accessToken = authHeader.split(" ")[1];
    // Kiểm tra token có trong blacklist hay không
    if (tokenBlacklist.has(accessToken)) {
        res.status(401).json({ message: "Access token is blacklisted" });
    }
    try {
        const decodedAccessToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_PRIVATE_KEY);
        req.accessToken = {
            value: accessToken,
            exp: decodedAccessToken.exp,
        };
        req.user = decodedAccessToken;
        next();
    }
    catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                message: "Access token expired",
                code: "AccessTokenExpired",
            });
        }
        else if (err instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                message: "Access token invalid",
                code: "AccessTokenInvalid",
            });
        }
        else {
            res.status(500).json({
                message: err.message,
            });
        }
    }
};
export function authorize(roles) {
    return async (req, res, next) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
            });
            if (!user || !roles.includes(user.role)) {
                res.status(403).json({ message: "Access denied" });
                return;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
export const sendEmailOTP = async ({ email, id }, res) => {
    try {
        const otp = `${Math.floor(1000 + Math.random() * 9000)}`;
        await sendOTP(email, otp);
        const saltRound = 10;
        const hashOtp = await bcrypt.hash(otp, saltRound);
        // Xoá OTP cũ nếu có
        await prisma.userVerifyOtp.deleteMany({ where: { userId: id } });
        const userVerify = await prisma.userVerifyOtp.create({
            data: {
                userId: id,
                otp: hashOtp,
                expiredAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            },
        });
        return res.status(202).json({
            status: "PENDING",
            message: "Verify otp email sent",
            data: { id: userVerify.userId, expiredAt: userVerify.expiredAt },
        });
    }
    catch (err) {
        console.error("verifyOtp error:", err);
        return res.status(500).json({
            message: "Internal Server Error",
            error: err.message,
        });
    }
};
export function checkStaffPosition(allowedPositions) {
    return async (req, res, next) => {
        try {
            // If user is admin (role = 1), allow access
            if (req.user.role === 1) {
                return next();
            }
            // Get staff information from the database
            const staff = await prisma.staff.findFirst({
                where: {
                    user_id: req.user.id,
                    deleted_at: null,
                },
            });
            if (!staff) {
                res.status(403).json({
                    message: "Staff not found or has been deleted",
                });
                return;
            }
            if (!allowedPositions.includes(staff.position)) {
                res.status(403).json({
                    message: "You don't have permission to access this resource",
                });
                return;
            }
            // Add staff info to request for later use
            req.staff = staff;
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
