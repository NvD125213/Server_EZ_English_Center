import { PrismaClient } from "@prisma/client";
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { UserType } from "../Types/userType";
import { sendOTP } from "../libs/mailer";
import bcrypt from "bcryptjs";
import { tokenBlacklist } from "../controllers/authController";

const prisma = new PrismaClient();

interface EmailOtpType {
  email: string;
  id: number;
}

export const ensureAuthenticated = (
  req: Request<{}, {}, UserType>,
  res: Response,
  next: NextFunction
): void => {
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
    const decodedAccessToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_PRIVATE_KEY!
    ) as jwt.JwtPayload;

    (req as any).accessToken = {
      value: accessToken,
      exp: decodedAccessToken.exp,
    };

    (req as any).user = decodedAccessToken;

    next();
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        message: "Access token expired",
        code: "AccessTokenExpired",
      });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        message: "Access token invalid",
        code: "AccessTokenInvalid",
      });
    } else {
      res.status(500).json({
        message: err.message,
      });
    }
  }
};

export function authorize(roles: number[]): RequestHandler {
  return async (req, res, next): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: (req as any).user.id },
      });

      if (!user || !roles.includes(user.role)) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export const sendEmailOTP = async (
  { email, id }: EmailOtpType,
  res: Response
): Promise<any> => {
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
  } catch (err: any) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({
      message: "Internal Server Error",
      error: err.message,
    });
  }
};
