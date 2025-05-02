import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { UserType } from "../Types/userType";

const prisma = new PrismaClient();

export const UserController = {
  getCurrentUser: async (req: Request, res: Response): Promise<any> => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: (req as any).user.id,
        },
      });

      return res.status(200).json({
        name: user?.full_name,
        email: user?.email,
        role: user?.role,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  },
};
