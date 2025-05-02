import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { GroupQuestionType } from "../Types/question";
import path from "path";
import { promises as fs } from "fs";

const prisma = new PrismaClient();

export const QuestionController = {
  getQuestionByPartAndExam: async (
    req: Request,
    res: Response
  ): Promise<any> => {
    const { exam_id, part_id, page = 1, limit = 10 } = req.query;
    if (!exam_id || !part_id) {
      return res.status(400).json({
        error: "Exam or part is required!",
      });
    }
    try {
      const examPart = await prisma.examPart.findUnique({
        where: {
          exam_id_part_id: {
            exam_id: Number(exam_id),
            part_id: Number(part_id),
          },
        },
      });

      if (!examPart) {
        return res.status(404).json({
          error: "Exam or part not found!",
        });
      } else {
        // Tính toán skip cho phân trang
        const skip = (Number(page) - 1) * Number(limit);

        // Lấy tổng số group questions
        const total = await prisma.questionGroup.count({
          where: {
            part_id: Number(part_id),
          },
        });

        // Lấy danh sách group questions với phân trang
        const data = await prisma.questionGroup.findMany({
          where: {
            part_id: Number(part_id),
          },
          include: {
            questions: {
              where: {
                deleted_at: null,
              },
            },
          },
          skip,
          take: Number(limit),
          orderBy: {
            order: "asc",
          },
        });

        return res.status(200).json({
          data,
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        message: err.message,
      });
    }
  },

  createQuestion: async (
    req: Request<{}, {}, GroupQuestionType>,
    res: Response
  ): Promise<any> => {
    const { part_id, exam_id } = req.query;
    const { description, type_group, questions } = req.body;
    const files = req.files as Express.Multer.File[];
    let pathDir = "";
    if (!type_group) {
      let initialTypeG = 1;
    }
    if (!exam_id || !part_id) {
      return res.status(400).json({ error: "Exam or part is required!" });
    }

    const part_name = await prisma.part.findUnique({
      where: {
        id: Number(part_id),
      },
    });
    const exam_name = await prisma.exam.findUnique({
      where: {
        id: Number(exam_id),
      },
    });

    if (!part_name || !exam_name) {
      return res.status(404).json({ error: "Part or Exam not found" });
    }

    if (!pathDir) {
      pathDir = `${part_name.name}/${exam_name.name}`;
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          const lastGroup = await tx.questionGroup.findFirst({
            where: { part_id: Number(part_id) },
            orderBy: { order: "desc" },
          });

          const newGroup = await tx.questionGroup.create({
            data: {
              part_id: Number(part_id),
              order: (lastGroup?.order ?? 0) + 1,
              type_group: Number(type_group),
              description,
              title: req.body.title,
            },
          });

          // Upload group elements
          const groupElements = files.filter(
            (file) => file.fieldname === "elements"
          );
          if (groupElements.length > 0) {
            const uploadedElements = groupElements.map((el) => ({
              type: el.mimetype.startsWith("image")
                ? "image"
                : ("audio" as "image" | "audio"),
              url: `/uploads/${pathDir}/${el.filename}`,
              group_id: newGroup.id,
            }));
            await tx.element.createMany({ data: uploadedElements });
          }

          const maxGlobalOrder = await tx.question.findFirst({
            where: { group: { part_id: Number(part_id) } },
            orderBy: { global_order: "desc" },
            select: { global_order: true },
          });

          const startGlobalOrder = maxGlobalOrder?.global_order ?? 0;

          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];

            const maxOrder = await tx.question.findFirst({
              where: { group: { part_id: Number(part_id) } },
              orderBy: { order: "desc" },
              select: { order: true },
            });

            const startOrder = maxOrder?.order ?? 0;

            const createdQuestion = await tx.question.create({
              data: {
                title: q.title,
                description: q.description,
                option: q.option,
                correct_option: q.correct_option,
                score: Number(q.score),
                order: startOrder + i + 1,
                group_id: newGroup.id,
                global_order: startGlobalOrder + i + 1,
              },
            });

            // Upload question elements
            const questionElements = files.filter((file) =>
              file.fieldname.startsWith(`questions[${i}][elements]`)
            );

            if (questionElements.length > 0) {
              const questionPathDir = `${pathDir}/${createdQuestion.global_order}`;
              const questionUploadPath = path.join(
                process.cwd(),
                "uploads",
                questionPathDir
              );
              await fs.mkdir(questionUploadPath, { recursive: true });

              const uploadedQuestionElements = questionElements.map((file) => ({
                type: file.mimetype.startsWith("image")
                  ? "image"
                  : ("audio" as "image" | "audio"),
                url: `/uploads/${questionPathDir}/${file.filename}`,
                question_id: createdQuestion.id,
              }));

              await tx.element.createMany({ data: uploadedQuestionElements });
            }
          }

          return res.status(201).json({
            message: "Questions created successfully.",
            newGroup: newGroup,
          });
        },
        {
          maxWait: 10000,
          timeout: 20000,
        }
      );
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  update: async (req: Request, res: Response): Promise<any> => {},

  delete: async (req: Request, res: Response): Promise<any> => {},
};
