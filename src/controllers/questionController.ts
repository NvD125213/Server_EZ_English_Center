import { PrismaClient, TypeElement } from "@prisma/client";
import { Request, Response } from "express";
import { GroupQuestionType } from "../Types/question";
import path from "path";
import { promises as fs } from "fs";

const prisma = new PrismaClient();

interface ExcelQuestion {
  Order: number;
  Part: string;
  "Title Group"?: string;
  "Description Group"?: string;
  Question: string;
  Description?: string;
  Element?: string;
  "Element Group"?: string;
  "Option 1": string;
  "Option 2": string;
  "Option 3": string;
  "Option 4": string;
  "Correct Answer": string;
}

interface ExcelExamSubject {
  Subject: string;
  Exam: string;
}

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
        // Tính toán skip cho phân trang dựa trên số câu hỏi
        const skip = (Number(page) - 1) * Number(limit);

        // Lấy tổng số câu hỏi
        const totalQuestions = await prisma.question.count({
          where: {
            group: {
              part_id: Number(part_id),
              part: {
                examParts: {
                  some: {
                    exam_id: Number(exam_id),
                  },
                },
              },
            },
            deleted_at: null,
          },
        });

        // Lấy tất cả các nhóm câu hỏi
        const allGroups = await prisma.questionGroup.findMany({
          where: {
            part_id: Number(part_id),
            exam_id: Number(exam_id),
          },
          include: {
            questions: {
              where: {
                deleted_at: null,
              },
              include: {
                elements: true,
              },
              orderBy: {
                global_order: "asc",
              },
            },
            elements: true,
          },
          orderBy: {
            order: "asc",
          },
        });

        // Gộp tất cả câu hỏi từ các nhóm
        const allQuestions = allGroups.reduce((acc: any[], group: any) => {
          return [...acc, ...group.questions];
        }, []);

        // Phân trang câu hỏi
        const paginatedQuestions = allQuestions.slice(
          skip,
          skip + Number(limit)
        );

        // Thêm số thứ tự tuần tự cho mỗi câu hỏi
        const questionsWithSequentialOrder = paginatedQuestions.map(
          (question: any, index: number) => ({
            ...question,
            display_order: skip + index + 1, // Số thứ tự hiển thị = skip + index + 1
          })
        );

        // Tạo map để theo dõi các nhóm chứa câu hỏi đã phân trang
        const groupMap = new Map();
        questionsWithSequentialOrder.forEach((question: any) => {
          const group = allGroups.find((g: any) =>
            g.questions.some((q: any) => q.id === question.id)
          );
          if (group && !groupMap.has(group.id)) {
            groupMap.set(group.id, {
              ...group,
              questions: group.questions
                .filter((q: any) =>
                  questionsWithSequentialOrder.some((pq: any) => pq.id === q.id)
                )
                .map((q: any) => {
                  const updatedQuestion = questionsWithSequentialOrder.find(
                    (pq: any) => pq.id === q.id
                  );
                  return updatedQuestion || q;
                }),
            });
          }
        });

        // Chuyển map thành mảng
        const paginatedGroups = Array.from(groupMap.values());

        return res.status(200).json({
          data: paginatedGroups,
          total: totalQuestions,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalQuestions / Number(limit)),
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
      const sanitizedExamName = exam_name.name.replace(/[^a-zA-Z0-9]/g, "_");
      const sanitizedPartName = part_name.name.replace(/[^a-zA-Z0-9]/g, "_");
      pathDir = `${sanitizedExamName}/${sanitizedPartName}`;
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          const lastGroup = await tx.questionGroup.findFirst({
            where: {
              part_id: Number(part_id),
              exam_id: Number(exam_id),
            },
            orderBy: { order: "desc" },
          });

          const newGroup = await tx.questionGroup.create({
            data: {
              part_id: Number(part_id),
              exam_id: Number(exam_id),
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
            where: {
              group: {
                part_id: Number(part_id),
                exam_id: Number(exam_id),
              },
            },
            orderBy: { global_order: "desc" },
            select: { global_order: true },
          });

          const startGlobalOrder = maxGlobalOrder?.global_order ?? 0;

          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];

            const maxOrder = await tx.question.findFirst({
              where: {
                group: {
                  part_id: Number(part_id),
                  exam_id: Number(exam_id),
                },
              },
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
              const uploadedQuestionElements = questionElements.map((file) => ({
                type: file.mimetype.startsWith("image")
                  ? "image"
                  : ("audio" as "image" | "audio"),
                url: `/uploads/${pathDir}/${file.filename}`,
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

  update: async (req: Request, res: Response): Promise<any> => {
    const { question_id } = req.query;
    const { title, description, option, correct_option, score, global_order } =
      req.body;
    const files = req.files as Express.Multer.File[];

    console.log("Debug - Update request:", {
      question_id,
      files: files?.map((f) => ({
        filename: f.filename,
        path: f.path,
        fieldname: f.fieldname,
      })),
    });

    if (!question_id) {
      return res.status(400).json({ error: "Question ID is required!" });
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // Get the question with its elements to check old file paths
        const existingQuestion = await tx.question.findUnique({
          where: { id: Number(question_id) },
          include: {
            elements: true,
            group: {
              include: {
                part: {
                  include: {
                    examParts: {
                      include: {
                        exam: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!existingQuestion) {
          return res.status(404).json({ error: "Question not found" });
        }

        console.log("Debug - Existing question:", {
          id: existingQuestion.id,
          elements: existingQuestion.elements,
        });

        // Use pathDir set by middleware
        const oldPathDir = (req as any).pathDir;
        console.log("Debug - PathDir:", oldPathDir);

        // Update question
        const updatedQuestion = await tx.question.update({
          where: { id: Number(question_id) },
          data: {
            title,
            description,
            option,
            correct_option,
            score: Number(score),
            global_order: Number(global_order),
          },
        });

        // Handle new files if any
        if (files && files.length > 0) {
          console.log("Debug - Processing new files");

          // Delete old elements and their files
          for (const element of existingQuestion.elements) {
            const filePath = path.join(process.cwd(), element.url);
            console.log("Debug - Deleting old file:", filePath);
            try {
              await fs.unlink(filePath);
            } catch (error) {
              console.error(`Error deleting file ${filePath}:`, error);
            }
          }

          await tx.element.deleteMany({
            where: { question_id: Number(question_id) },
          });

          // Create new elements with the same directory structure
          const uploadedElements = files.map((file) => {
            const element = {
              type: file.mimetype.startsWith("image")
                ? TypeElement.image
                : TypeElement.audio,
              url: `/uploads/${oldPathDir}/${file.filename}`,
              question_id: Number(question_id),
            };
            console.log("Debug - Creating new element:", element);
            return element;
          });

          await tx.element.createMany({ data: uploadedElements });
        }

        return res.status(200).json({
          message: "Question updated successfully",
          question: updatedQuestion,
        });
      });
    } catch (err: any) {
      console.error("Error updating question:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  delete: async (req: Request, res: Response): Promise<any> => {
    const { question_id } = req.query;

    if (!question_id) {
      return res.status(400).json({ error: "Question ID is required!" });
    }

    try {
      const deletedQuestion = await prisma.question.update({
        where: { id: Number(question_id) },
        data: {
          deleted_at: new Date(),
        },
      });

      return res.status(200).json({
        message: "Question deleted successfully",
        question: deletedQuestion,
      });
    } catch (err: any) {
      console.error("Error deleting question:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  uploadExcel: async (req: Request, res: Response): Promise<any> => {
    try {
      const { file } = req.body;
      if (!file) {
        return res.status(400).json({
          error: "Thiếu dữ liệu file Excel",
        });
      }

      const { detailQuestions, examAndSubject } = file as {
        detailQuestions: ExcelQuestion[];
        examAndSubject: ExcelExamSubject[];
      };

      // Check exam and subject
      if (!examAndSubject || examAndSubject.length === 0) {
        return res.status(400).json({
          error: "Thiếu thông tin Exam và Subject trong file Excel",
        });
      }

      const { Subject, Exam } = examAndSubject[0];
      if (!Subject || !Exam) {
        return res.status(400).json({
          error: "Thiếu tên Subject hoặc Exam trong file Excel",
        });
      }

      // Check if exam and subject exist
      const existingSubject = await prisma.subject.findFirst({
        where: { name: Subject, deleted_at: null },
      });

      const existingExam = await prisma.exam.findFirst({
        where: { name: Exam, deleted_at: null },
      });

      if (!existingSubject) {
        return res.status(400).json({
          error: `Subject "${Subject}" không tồn tại trong hệ thống`,
        });
      }

      if (!existingExam) {
        return res.status(400).json({
          error: `Exam "${Exam}" không tồn tại trong hệ thống`,
        });
      }

      // Get max global order for this exam
      const maxGlobalOrder = await prisma.question.findFirst({
        where: {
          group: {
            exam_id: existingExam.id,
          },
        },
        orderBy: { global_order: "desc" },
        select: { global_order: true },
      });

      const startGlobalOrder = maxGlobalOrder?.global_order ?? 0;

      // Group questions by Part
      const questionsByPart = detailQuestions.reduce(
        (acc: Record<string, ExcelQuestion[]>, question: ExcelQuestion) => {
          const partName = question.Part;
          if (!partName) {
            throw new Error("Thiếu thông tin Part trong file Excel");
          }

          if (!acc[partName]) {
            acc[partName] = [];
          }
          acc[partName].push(question);
          return acc;
        },
        {}
      );

      // Check if all parts exist and get their order
      const partOrders = new Map<string, number>();
      for (const partName of Object.keys(questionsByPart)) {
        const existingPart = await prisma.part.findFirst({
          where: { name: partName },
        });

        if (!existingPart) {
          return res.status(400).json({
            error: `Part "${partName}" không tồn tại trong hệ thống`,
          });
        }

        // Get part order from examPart
        const examPart = await prisma.examPart.findFirst({
          where: {
            exam_id: existingExam.id,
            part_id: existingPart.id,
          },
        });

        if (!examPart) {
          return res.status(400).json({
            error: `Không tìm thấy liên kết giữa Exam "${Exam}" và Part "${partName}"`,
          });
        }

        partOrders.set(partName, examPart.id);
      }

      // Sort parts by their order
      const sortedPartNames = Object.keys(questionsByPart).sort((a, b) => {
        return (partOrders.get(a) || 0) - (partOrders.get(b) || 0);
      });

      // Process each part
      const results = [];
      let currentGlobalOrder = startGlobalOrder;

      for (const partName of sortedPartNames) {
        const questions = questionsByPart[partName];
        const part = await prisma.part.findFirst({
          where: { name: partName },
        });

        if (!part) continue;

        // Get exam part
        const examPart = await prisma.examPart.findFirst({
          where: {
            exam_id: existingExam.id,
            part_id: part.id,
          },
        });

        if (!examPart) {
          return res.status(400).json({
            error: `Không tìm thấy liên kết giữa Exam "${Exam}" và Part "${partName}"`,
          });
        }

        // Sort questions by Order within the part
        const sortedQuestions = [...questions].sort(
          (a, b) => a.Order - b.Order
        );

        // Create question group
        const lastGroup = await prisma.questionGroup.findFirst({
          where: {
            part_id: part.id,
            exam_id: existingExam.id,
          },
          orderBy: { order: "desc" },
        });

        const newGroup = await prisma.questionGroup.create({
          data: {
            part_id: part.id,
            exam_id: existingExam.id,
            order: (lastGroup?.order ?? 0) + 1,
            type_group: 1,
            description: sortedQuestions[0]["Description Group"] || "",
            title: sortedQuestions[0]["Title Group"] || "",
          },
        });

        // Create questions for this group
        for (let i = 0; i < sortedQuestions.length; i++) {
          const q = sortedQuestions[i];
          currentGlobalOrder++;

          const createdQuestion = await prisma.question.create({
            data: {
              title: q.Question,
              description: q.Description || "",
              option: {
                A: q["Option 1"],
                B: q["Option 2"],
                C: q["Option 3"],
                D: q["Option 4"],
              },
              correct_option: q["Correct Answer"] as "A" | "B" | "C" | "D",
              score: 1, // Default score
              order: q.Order, // Use Order from Excel
              group_id: newGroup.id,
              global_order: currentGlobalOrder, // Use incremented global order
            },
          });

          // Handle element if exists
          if (q.Element) {
            // Check if the element URL is from Cloudinary
            const isAudio =
              q.Element.toLowerCase().includes(".mp3") ||
              q.Element.toLowerCase().includes(".wav");
            await prisma.element.create({
              data: {
                type: isAudio ? "audio" : "image",
                url: q.Element, // Use the Cloudinary URL directly
                question_id: createdQuestion.id,
                cloudId: true,
              },
            });
          }

          // Handle group element if exists
          if (q["Element Group"] && i === 0) {
            // Check if the group element URL is from Cloudinary
            const isAudio =
              q["Element Group"].toLowerCase().includes(".mp3") ||
              q["Element Group"].toLowerCase().includes(".wav");
            await prisma.element.create({
              data: {
                type: isAudio ? "audio" : "image",
                url: q["Element Group"], // Use the Cloudinary URL directly
                group_id: newGroup.id,
                cloudId: true,
              },
            });
          }
        }

        results.push({
          part: partName,
          groupId: newGroup.id,
          questionsCount: questions.length,
        });
      }

      return res.status(201).json({
        message: "Upload Excel thành công",
        results,
      });
    } catch (error: any) {
      console.error("Error uploading Excel:", error);
      return res.status(500).json({
        error: error.message || "Lỗi khi xử lý file Excel",
      });
    }
  },
};
