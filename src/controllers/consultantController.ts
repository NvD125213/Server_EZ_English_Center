import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { io } from "../index.js";

const prisma = new PrismaClient();

export const consultationController = {
  createConsultation: async (req: Request, res: Response): Promise<any> => {
    try {
      const { course_id, name, email, phone } = req.body;

      // Validate required fields
      if (!course_id || !name || !email || !phone) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      const consultation = await prisma.consultation.create({
        data: {
          course_id,
          name,
          email,
          phone,
        },
        include: {
          course: {
            select: {
              id: true,
              menu: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Emit socket event for new consultation
      io.emit("newConsultation", {
        consultation: {
          ...consultation,
          timestamp: new Date().toISOString(),
        },
      });

      return res.status(201).json({
        success: true,
        message:
          "Gửi liên hệ thành công! Chúng tôi sẽ liên hệ lại sớm nhất có thể",
        data: consultation,
      });
    } catch (error) {
      console.error("Error creating consultation:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  getAllConsultations: async (req: Request, res: Response): Promise<any> => {
    try {
      const consultations = await prisma.consultation.findMany({
        where: {
          deleted_at: null, // Only get non-deleted consultations
        },
        include: {
          course: {
            select: {
              id: true,
              menu: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          }, // Include course details
        },
        orderBy: {
          create_at: "desc", // Sort by creation date, newest first
        },
      });
      return res.status(200).json({
        data: consultations,
      });
    } catch (error) {
      console.error("Error fetching consultations:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};


