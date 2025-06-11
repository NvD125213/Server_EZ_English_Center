import { Request, Response } from "express";
import prisma from "../config/prisma.js";

export const PartController = {
  get: async (req: Request, res: Response): Promise<any> => {
    try {
      const parts = await prisma.part.findMany({
        where: {
          deleted_at: null,
        },
        orderBy: {
          order: "asc",
        },
      });

      if (parts.length === 0) {
        return res.status(200).json({
          message: "Không có dữ liệu",
        });
      }

      return res.status(200).json(parts);
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  },

  getByID: async (req: Request, res: Response): Promise<any> => {},

  create: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id, name, order } = req.body;

      if (!name) {
        return res.status(422).json({ error: "Name is required!" });
      }

      const existing = await prisma.part.findFirst({
        where: { name: name },
      });

      if (existing && !existing.deleted_at) {
        return res.status(409).json({
          error: `${name} already exists!`,
        });
      }

      let finalOrder = order;

      if (order === undefined || order === null) {
        const maxOrderPart = await prisma.part.findFirst({
          where: { id: id },
          orderBy: { order: "desc" },
        });

        finalOrder = maxOrderPart ? maxOrderPart.order + 1 : 1;
      }

      const newPart = await prisma.part.create({
        data: {
          name,
          order: finalOrder,
        },
      });

      // 🆕 Tự động thêm part mới vào tất cả các exam hiện có
      const allExams = await prisma.exam.findMany();

      const examPartData = allExams.map((exam) => ({
        exam_id: exam.id,
        part_id: newPart.id,
      }));

      if (examPartData.length > 0) {
        await prisma.examPart.createMany({
          data: examPartData,
          skipDuplicates: true,
        });
      }

      return res.status(201).json({
        message: "Add part successfully and associated with all exams",
        part: newPart,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  update: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id, name } = req.body;

      if (!name) {
        return res.status(422).json({ error: "Name is required!" });
      }

      const updatedPart = await prisma.part.update({
        where: { id: id },
        data: {
          name,
        },
      });

      return res.status(200).json(updatedPart);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  delete: async (req: Request, res: Response): Promise<any> => {
    try {
      const partId = parseInt(req.params.id);
      if (isNaN(partId)) {
        return res.status(400).json({ error: "Invalid part ID" });
      }

      const part = await prisma.part.findUnique({
        where: { id: partId },
      });

      if (!part) {
        return res.status(404).json({ error: "Part not found!" });
      }

      if (part.deleted_at) {
        return res.status(410).json({ error: "Part already deleted!" });
      }

      const deletedPart = await prisma.part.update({
        where: { id: part.id },
        data: { deleted_at: new Date() },
      });

      return res.status(200).json({
        message: "Part was deleted!",
        data: deletedPart,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  },
};
