import { sendEmailOTP } from "../middlewares/auth";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import "../config/passport";
import { sendOTP } from "../libs/mailer";
import prisma from "../config/prisma";
import admin from "../libs/firebase-admin";
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
export const tokenBlacklist = new Set();
export const AuthController = {
    register: async (req, res) => {
        try {
            const { full_name, phone_number, email, password } = req.body;
            if (await prisma.user.findUnique({
                where: {
                    email,
                    phone_number,
                },
            })) {
                return res.status(409).json({
                    message: "Email or phone already exists",
                });
            }
            // Băm mật khẩu ra
            const hashPassword = await bcrypt.hash(password, 10);
            const newUser = await prisma.user.create({
                data: {
                    ...req.body,
                    password: hashPassword,
                },
            });
            return res.status(201).json({
                message: "User created successfully!",
                user: newUser,
            });
        }
        catch (err) {
            return res.status(500).json({
                error: err.message,
            });
        }
    },
    login: async (req, res) => {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            return res.status(401).json({ message: "Email or password is invalid" });
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Email or password is invalid" });
        }
        if (user.role === 1 || user.role === 2) {
            try {
                // Generate OTP
                const otp = `${Math.floor(1000 + Math.random() * 9000)}`;
                // Send OTP to email (assuming sendOTP is a function that handles email sending)
                await sendOTP(email, otp);
                // Hash the OTP for storage in the database
                const saltRound = 10;
                const hashOtp = await bcrypt.hash(otp, saltRound);
                // Delete any existing OTPs for this user
                await prisma.userVerifyOtp.deleteMany({ where: { userId: user.id } });
                // Store the new OTP in the database with expiration time
                const userVerify = await prisma.userVerifyOtp.create({
                    data: {
                        userId: user.id,
                        otp: hashOtp,
                        expiredAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiration
                    },
                });
                // Send a response back indicating OTP has been sent
                return res.status(202).json({
                    status: "PENDING",
                    message: "Verify OTP email sent",
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
        }
        // Xóa refresh token cũ trước khi tạo mới
        await prisma.refreshToken.deleteMany({
            where: { userId: user.id },
        });
        const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.ACCESS_TOKEN_PRIVATE_KEY, { subject: "accessApi", expiresIn: "1h" });
        const refreshToken = jwt.sign({ id: user.id, role: user.role }, process.env.REFRESH_TOKEN_PRIVATE_KEY, { subject: "refreshToken", expiresIn: "7d" });
        await prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshToken,
            },
        });
        return res.status(200).json({
            message: "Login successfully",
            user: user,
            access_token: accessToken,
            refresh_token: refreshToken,
        });
    },
    refreshToken: async (req, res) => {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(403).json({
                message: "Refresh token not found",
            });
        }
        try {
            const decodedRefreshToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_PRIVATE_KEY);
            const userRefreshToken = await prisma.refreshToken.findUnique({
                where: {
                    token: refreshToken,
                },
            });
            if (!userRefreshToken) {
                return res.status(401).json({
                    message: "Refresh token invalid or expired",
                });
            }
            // Kiểm tra thời gian hết hạn của refresh token
            const refreshTokenExp = decodedRefreshToken.exp;
            const currentTime = Math.floor(Date.now() / 1000);
            // Nếu refresh token đã hết hạn, xóa nó
            if (refreshTokenExp && refreshTokenExp < currentTime) {
                await prisma.refreshToken.delete({
                    where: {
                        id: userRefreshToken.id,
                    },
                });
                return res.status(401).json({
                    message: "Refresh token expired",
                });
            }
            // Tạo access token mới
            const accessToken = jwt.sign({
                id: decodedRefreshToken.id,
                role: decodedRefreshToken.role,
            }, process.env.ACCESS_TOKEN_PRIVATE_KEY, {
                subject: "accessApi",
                expiresIn: "1h",
            });
            return res.status(200).json({
                message: "New access token issued successfully",
                access_token: accessToken,
            });
        }
        catch (err) {
            if (err instanceof jwt.TokenExpiredError) {
                // Khi token hết hạn, xóa nó khỏi database
                try {
                    await prisma.refreshToken.delete({
                        where: {
                            token: refreshToken,
                        },
                    });
                }
                catch (deleteError) {
                    console.error("Error deleting expired refresh token:", deleteError);
                }
                return res.status(401).json({
                    message: "Session expired",
                });
            }
            if (err instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({
                    message: "Refresh token không hợp lệ",
                });
            }
            return res.status(500).json({
                message: err.message,
            });
        }
    },
    logout: async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).json({ message: "Access token not found" });
            }
            const accessToken = authHeader.split(" ")[1];
            const refreshToken = req.body.refreshToken;
            if (!accessToken || !refreshToken) {
                return res.status(400).json({ message: "Token missing" });
            }
            // 1. Blacklist accessToken nếu cần
            tokenBlacklist.add(accessToken);
            // 2. Tìm và xoá refresh token khỏi DB
            const userRefreshToken = await prisma.refreshToken.findUnique({
                where: {
                    token: refreshToken,
                },
            });
            if (userRefreshToken) {
                await prisma.refreshToken.delete({
                    where: {
                        id: userRefreshToken.id,
                    },
                });
            }
            res.clearCookie("refreshToken");
            return res.json({ message: "Logout successful" });
        }
        catch (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
    },
    verifyOtp: async (req, res) => {
        try {
            const { otp, userId } = req.body;
            if (!otp || !userId) {
                return res.status(422).json({
                    message: "Empty Otp detail not allowed",
                });
            }
            const userOtpVerify = await prisma.userVerifyOtp.findFirst({
                where: {
                    userId: userId,
                },
            });
            if (!userOtpVerify) {
                return res.status(401).json({
                    message: "Account doesn't exists. Please sign up or sign in account valid",
                });
            }
            const expiredAt = userOtpVerify.expiredAt;
            const hashedOtp = userOtpVerify.otp;
            if (expiredAt.getTime() < Date.now()) {
                await prisma.userVerifyOtp.deleteMany({
                    where: {
                        userId: userId,
                    },
                });
                return res.status(401).json({
                    message: "Otp expired. Please request again",
                });
            }
            else {
                const validOtp = await bcrypt.compare(otp, hashedOtp);
                if (!validOtp) {
                    return res.status(401).json({
                        message: "Otp invalid. Check your email",
                    });
                }
                else {
                    await prisma.userVerifyOtp.deleteMany({
                        where: {
                            userId: userId,
                        },
                    });
                    await prisma.refreshToken.deleteMany({
                        where: { userId: userId },
                    });
                    const user = await prisma.user.findUnique({
                        where: { id: userId },
                    });
                    const accessToken = jwt.sign({ id: userId, role: user?.role }, process.env.ACCESS_TOKEN_PRIVATE_KEY, { subject: "accessApi", expiresIn: "1h" });
                    const refreshToken = jwt.sign({ id: user?.id, role: user?.role }, process.env.REFRESH_TOKEN_PRIVATE_KEY, { subject: "refreshToken", expiresIn: "7d" });
                    if (!user || !user.id) {
                        return res.status(404).json({
                            message: "User not found",
                        });
                    }
                    await prisma.refreshToken.create({
                        data: {
                            userId: user?.id,
                            token: refreshToken,
                        },
                    });
                    return res.status(200).json({
                        status: "VERIFIED",
                        message: "Login successfully",
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                }
            }
        }
        catch (err) {
            return res.status(500).json({
                status: "FAILED",
                message: err.message,
            });
        }
    },
    resendVerifyOtp: async (req, res) => {
        try {
            let { userId, email } = req.body;
            if (!email || !userId) {
                return res.status(422).json({
                    message: "Empty email detail is not allowed",
                });
            }
            else {
                await prisma.userVerifyOtp.deleteMany({
                    where: {
                        userId: userId,
                    },
                });
                await sendEmailOTP({ email, id: userId }, res);
            }
        }
        catch (err) {
            return res.status(500).json({
                status: "FAILED",
                message: err.message,
            });
        }
    },
    getCurrentUser: async (req, res) => {
        try {
            const userId = req.user.id;
            const user = await prisma.user.findUnique({
                where: {
                    id: userId,
                },
                include: {
                    staffs: {
                        select: {
                            position: true,
                            photo: true,
                        },
                    },
                },
            });
            return res.status(200).json(user);
        }
        catch (err) {
            return res.status(500).json({
                status: "FAILED",
                message: err.message,
            });
        }
    },
    GoogleSignInFirebase: async (req, res) => {
        try {
            // Lấy chuỗi idToken từ req.body.idToken.idToken
            const idToken = req.body.idToken?.idToken;
            // Kiểm tra idToken
            if (!idToken || typeof idToken !== "string" || idToken.trim() === "") {
                console.error("Token ID không hợp lệ:", idToken);
                return res
                    .status(400)
                    .json({ message: "Token ID không hợp lệ: Phải là chuỗi không rỗng" });
            }
            console.log("Đang xác minh idToken:", idToken.substring(0, 10) + "...");
            // Xác minh token ID bằng Firebase Admin
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const { email, name } = decodedToken;
            if (!email) {
                return res.status(400).json({ message: "Email là bắt buộc" });
            }
            // Kiểm tra người dùng
            let user = await prisma.user.findUnique({
                where: { email },
            });
            if (!user) {
                // Tạo người dùng mới nếu chưa tồn tại
                user = await prisma.user.create({
                    data: {
                        email,
                        full_name: name || email.split("@")[0],
                        password: "", // Mật khẩu rỗng cho đăng nhập qua Google
                        role: 3,
                        phone_number: "",
                        is_active: true,
                    },
                });
            }
            // Xóa refresh token cũ
            await prisma.refreshToken.deleteMany({
                where: { userId: user.id },
            });
            // Tạo token mới
            const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.ACCESS_TOKEN_PRIVATE_KEY, { subject: "accessApi", expiresIn: "1h" });
            const refreshToken = jwt.sign({ id: user.id, role: user.role }, process.env.REFRESH_TOKEN_PRIVATE_KEY, { subject: "refreshToken", expiresIn: "7d" });
            // Lưu refresh token
            await prisma.refreshToken.create({
                data: {
                    userId: user.id,
                    token: refreshToken,
                },
            });
            return res.status(200).json({
                message: "Đăng nhập thành công",
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role,
                },
                access_token: accessToken,
                refresh_token: refreshToken,
            });
        }
        catch (error) {
            console.error("Lỗi đăng nhập Google:", error);
            return res.status(500).json({
                message: "Xác thực thất bại",
                error: error.message,
            });
        }
    },
};
