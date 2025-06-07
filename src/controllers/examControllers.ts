import { Request, Response } from "express";
import prisma from "../config/prisma";

export const ExamController = {
  get: async (req: Request, res: Response): Promise<any> => {
    try {
      const getAll = req.query.all === "true";

      let exams = [];
      let total = 0;

      if (getAll) {
        [exams, total] = await Promise.all([
          prisma.exam.findMany({
            where: { deleted_at: null },
            include: { subject: { select: { name: true } } },
            orderBy: {
              create_at: "desc",
            },
          }),
          prisma.exam.count({
            where: { deleted_at: null },
          }),
        ]);
        exams = exams.map((exam) => ({
          ...exam,
          subject_name: exam.subject?.name || "",
        }));

        return res.status(200).json({
          data: exams,
          total,
          page: 1,
          limit: total,
          totalPages: 1,
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      [exams, total] = await Promise.all([
        prisma.exam.findMany({
          where: {
            deleted_at: null,
          },
          skip,
          take: limit,
          include: { subject: { select: { name: true } } }, // Include subject and select the name
          orderBy: {
            create_at: "desc",
          },
        }),
        prisma.exam.count({
          where: {
            deleted_at: null,
          },
        }),
      ]);

      if (exams.length === 0) {
        return res.status(200).json({
          message: "Không có dữ liệu",
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      return res.status(200).json({
        data: exams,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  },

  getByID: async (req: Request, res: Response): Promise<any> => {},

  create: async (req: Request, res: Response): Promise<any> => {
    try {
      const { subject_id, name } = req.body;

      if (!subject_id || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const existingName = await prisma.exam.findFirst({
        where: {
          name: name,
          subject_id: Number(subject_id),
        },
      });

      if (existingName) {
        return res.status(409).json({
          message: "Exam already exists",
        });
      }
      // 1. Tạo Exam
      const newExam = await prisma.exam.create({
        data: {
          subject_id: Number(subject_id),
          name,
        },
      });

      // 2. Lấy tất cả các Part còn hoạt động (chưa bị soft-delete)
      const parts = await prisma.part.findMany({
        where: {
          deleted_at: null,
        },
      });

      // 3. Tạo các ExamPart tương ứng
      const examPartsData = parts.map((part) => ({
        exam_id: newExam.id,
        part_id: part.id,
      }));

      await prisma.examPart.createMany({
        data: examPartsData,
        skipDuplicates: true, // để tránh lỗi nếu có dữ liệu trùng
      });

      return res.status(201).json({
        message: "Exam created successfully.",
        exam: newExam,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  update: async (req: Request, res: Response): Promise<any> => {
    try {
      const examId = Number(req.params.id);
      const { name, subject_id } = req.body;

      if (!name) {
        return res.status(422).json({ error: "Name is required!" });
      }

      const exam = await prisma.exam.findUnique({ where: { id: examId } });

      if (!exam || exam.deleted_at) {
        return res.status(404).json({ error: "Exam not found!" });
      }

      const existingByName = await prisma.exam.findFirst({
        where: {
          name,
          NOT: { id: examId },
          deleted_at: null,
        },
      });

      if (existingByName) {
        return res.status(409).json({
          error: `${name} already exists!`,
        });
      }

      if (!subject_id) {
        return res.status(422).json({
          error: "Subject id is required!",
        });
      }

      const subjectExists = await prisma.subject.findUnique({
        where: { id: subject_id },
      });

      if (!subjectExists) {
        return res.status(404).json({
          error: "Subject not found!",
        });
      }

      const updatedExam = await prisma.exam.update({
        where: { id: examId },
        data: {
          name,
          subject_id,
        },
      });

      return res.status(200).json(updatedExam);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  delete: async (req: Request, res: Response): Promise<any> => {
    try {
      const examId = parseInt(req.params.id);
      if (isNaN(examId)) {
        return res.status(400).json({ error: "Invalid subject ID" });
      }

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
      });

      if (!exam) {
        return res.status(404).json({ error: "Exam not found!" });
      }

      if (exam.deleted_at) {
        return res.status(410).json({ error: "Exam already deleted!" });
      }

      const deletedSubject = await prisma.exam.update({
        where: { id: examId },
        data: { deleted_at: new Date() },
      });

      return res.status(200).json({
        message: "Exam was deleted!",
        data: deletedSubject,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  },

  getExamsBySubject: async (req: Request, res: Response): Promise<any> => {
    const subject_id = Number(req.params.subject_id);

    if (isNaN(subject_id)) {
      return res.status(400).json({ message: "Invalid subject ID" });
    }

    try {
      const exams =
        await prisma.$queryRaw`SELECT * FROM get_exams_by_subject(${subject_id}::INT)`;

      return res.status(200).json(exams);
    } catch (error) {
      console.error("Error calling stored procedure:", error);
      return res.status(500).json({ message: "Internal server error" });
    } finally {
      await prisma.$disconnect();
    }
  },
};
