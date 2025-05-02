import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

interface SubjectType {
  name: string;
  skillType: number;
}

export const SubjectController = {
  get: async (req: Request, res: Response): Promise<any> => {
    try {
      const getAll = req.query.all === "true";

      let subjects = [];
      let total = 0;

      if (getAll) {
        [subjects, total] = await Promise.all([
          prisma.subject.findMany({
            where: { deleted_at: null },
            orderBy: {
              create_at: "desc",
            },
          }),
          prisma.subject.count({
            where: { deleted_at: null },
          }),
        ]);

        return res.status(200).json({
          data: subjects,
          total,
          page: 1,
          limit: total,
          totalPages: 1,
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      [subjects, total] = await Promise.all([
        prisma.subject.findMany({
          where: {
            deleted_at: null,
          },
          skip,
          take: limit,
          orderBy: {
            create_at: "desc",
          },
        }),
        prisma.subject.count({
          where: {
            deleted_at: null,
          },
        }),
      ]);

      if (subjects.length === 0) {
        return res.status(200).json({
          message: "Không có dữ liệu",
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      return res.status(200).json({
        data: subjects,
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

  getByID: async (req: Request, res: Response): Promise<any> => {
    const subjectId = parseInt(req.params.id);
    if (isNaN(subjectId)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.deleted_at) {
      return res.status(404).json({ error: "Subject not found!" });
    }

    return res.status(200).json(subject);
  },

  create: async (
    req: Request<{}, {}, SubjectType>,
    res: Response
  ): Promise<any> => {
    try {
      const { name, skillType } = req.body;

      if (!name) {
        return res.status(422).json({ error: "Name is required!" });
      }
      if (!skillType) {
        return res.status(422).json({ error: "Skill type is required!" });
      }

      const existing = await prisma.subject.findUnique({
        where: { name },
      });

      if (existing && !existing.deleted_at) {
        return res.status(409).json({
          error: `${name} already exists!`,
        });
      }

      const subject = await prisma.subject.create({
        data: {
          name,
          skillType,
        },
      });

      return res.status(201).json(subject);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  update: async (req: Request, res: Response): Promise<any> => {
    const subjectId = parseInt(req.params.id);
    const { name, skillType } = req.body;

    if (isNaN(subjectId)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }

    const existingSubject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!existingSubject || existingSubject.deleted_at) {
      return res.status(404).json({ error: "Subject not found!" });
    }

    if (!name) {
      return res.status(422).json({ error: "Name is required!" });
    }
    if (!skillType) {
      return res.status(422).json({ error: "Skill type is required!" });
    }
    const duplicateName = await prisma.subject.findUnique({ where: { name } });
    if (duplicateName && duplicateName.id !== subjectId) {
      return res.status(409).json({ error: `${name} already exists!` });
    }

    const updatedSubject = await prisma.subject.update({
      where: { id: subjectId },
      data: { name, skillType },
    });

    return res.status(200).json(updatedSubject);
  },

  delete: async (req: Request, res: Response): Promise<any> => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) {
        return res.status(400).json({ error: "Invalid subject ID" });
      }

      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
      });

      if (!subject) {
        return res.status(404).json({ error: "Subject not found!" });
      }

      if (subject.deleted_at) {
        return res.status(410).json({ error: "Subject already deleted!" });
      }

      const deletedSubject = await prisma.subject.update({
        where: { id: subjectId },
        data: { deleted_at: new Date() },
      });

      return res.status(200).json({
        message: "Subject was deleted!",
        data: deletedSubject,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  },

  getSubjectByskillType: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const subjects = await prisma.subject.findMany({
        where: { skillType: Number(id) },
      });

      return res.status(200).json({
        data: subjects,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  },
};
