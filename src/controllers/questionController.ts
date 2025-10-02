import { PrismaClient, TypeElement } from "@prisma/client";
import { Request, Response } from "express";
import { uploadToCloudinary } from "../middlewares/fileUpload.js";

const prisma = new PrismaClient();

interface ExcelQuestion {
  Part: string;
  Order: number;
  Question: string;
  Description?: string;
  "Option A"?: string;
  "Option B"?: string;
  "Option C"?: string;
  "Option D"?: string;
  "Correct option": string;
  Element?: string;
  "Element Group"?: string;
  "Description Group"?: string;
  "Title Group"?: string;
}

interface ExcelExamSubject {
  Subject: string;
  Exam: string;
}

export const QuestionController = {
  getAllQuestionOnExam: async (req: Request, res: Response): Promise<any> => {
    const { exam_id } = req.params;
    if (!exam_id) {
      return res.status(400).json({ error: "Exam ID is required!" });
    }

    try {
      // Get all question groups for the exam
      const questionGroups = await prisma.questionGroup.findMany({
        where: {
          exam_id: Number(exam_id),
          deleted_at: null,
        },
        include: {
          questions: {
            where: {
              deleted_at: null,
            },
            select: {
              id: true,
              title: true,
              option: true,
              global_order: true,
              elements: true, // nếu elements là relation thì thay include bằng select
            },

            orderBy: {
              global_order: "asc",
            },
          },
          elements: true,
          part: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          part_id: "asc",
        },
      });

      // Group questions by part
      const questionsByPart = questionGroups.reduce((acc: any[], group) => {
        const partIndex = acc.findIndex((p) => p.part === group.part.name);

        if (partIndex === -1) {
          // Create new part entry
          acc.push({
            part: group.part.name,
            data: [
              {
                id: group.id,
                type_group: group.type_group,
                part_id: group.part_id,
                order: group.order,
                title: group.title,
                description: group.description,
                create_at: group.create_at,
                update_at: group.update_at,
                deleted_at: group.deleted_at,
                exam_id: group.exam_id,
                questions: group.questions,
                elements: group.elements,
              },
            ],
            total: group.questions.length,
            page: 1,
            limit: 10,
            totalPages: Math.ceil(group.questions.length / 10),
          });
        } else {
          // Merge with existing part
          const existingPart = acc[partIndex];
          existingPart.data.push({
            id: group.id,
            type_group: group.type_group,
            part_id: group.part_id,
            order: group.order,
            title: group.title,
            description: group.description,
            create_at: group.create_at,
            update_at: group.update_at,
            deleted_at: group.deleted_at,
            exam_id: group.exam_id,
            questions: group.questions,
            elements: group.elements,
          });

          // Update totals
          existingPart.total += group.questions.length;
          existingPart.totalPages = Math.ceil(existingPart.total / 10);
        }

        return acc;
      }, []);

      // Sort questions within each part by global_order
      questionsByPart.forEach((part) => {
        // Combine all questions from all groups in this part
        const allQuestions = part.data.reduce((acc: any[], group: any) => {
          return [...acc, ...group.questions];
        }, []);

        // Sort all questions by global_order
        allQuestions.sort(
          (a: { global_order: number }, b: { global_order: number }) =>
            a.global_order - b.global_order
        );

        // Update the data structure to have a single group with all questions
        part.data = [
          {
            ...part.data[0],
            questions: allQuestions,
            // Combine all elements from all groups
            elements: part.data.reduce((acc: any[], group: any) => {
              return [...acc, ...group.elements];
            }, []),
          },
        ];
      });

      return res.status(200).json(questionsByPart);
    } catch (error) {
      console.error("Error fetching questions:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

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

  createQuestion: async (req: Request, res: Response): Promise<any> => {
    try {
      const { part_id, exam_id } = req.query;
      let { description, type_group, title, elements, questions } = req.body;

      // Validate exam_id & part_id
      if (!exam_id || !part_id) {
        return res
          .status(400)
          .json({ error: "Exam ID và Part ID là bắt buộc." });
      }

      // Default type_group
      if (!type_group) {
        type_group = 1;
      }

      // Kiểm tra exam & part tồn tại
      const [exam, part] = await Promise.all([
        prisma.exam.findUnique({ where: { id: Number(exam_id) } }),
        prisma.part.findUnique({ where: { id: Number(part_id) } }),
      ]);

      if (!exam || !part) {
        return res.status(404).json({ error: "Exam hoặc Part không tồn tại." });
      }

      // Transaction
      const result = await prisma.$transaction(
        async (tx) => {
          // Lấy group cuối cùng để tính order
          const lastGroup = await tx.questionGroup.findFirst({
            where: { exam_id: Number(exam_id), part_id: Number(part_id) },
            orderBy: { order: "desc" },
          });

          // Tạo group mới
          const newGroup = await tx.questionGroup.create({
            data: {
              exam_id: Number(exam_id),
              part_id: Number(part_id),
              type_group: Number(type_group),
              description,
              title,
              order: (lastGroup?.order ?? 0) + 1,
            },
          });

          // Validate & lưu elements cho group
          if (elements?.length > 0) {
            for (const el of elements) {
              if (!el.url) {
                throw new Error("Có element trong group thiếu URL.");
              }
              await tx.element.create({
                data: {
                  type:
                    el.type === "image" ? TypeElement.image : TypeElement.audio,
                  url: el.url,
                  group_id: newGroup.id,
                },
              });
            }
          }

          // Tính global_order bắt đầu
          const lastGlobal = await tx.question.findFirst({
            where: {
              group: { exam_id: Number(exam_id), part_id: Number(part_id) },
            },
            orderBy: { global_order: "desc" },
            select: { global_order: true },
          });
          let globalOrder = lastGlobal?.global_order ?? 0;

          // Tính order trong group
          const lastOrder = await tx.question.findFirst({
            where: {
              group: { exam_id: Number(exam_id), part_id: Number(part_id) },
            },
            orderBy: { order: "desc" },
            select: { order: true },
          });
          let order = lastOrder?.order ?? 0;

          // Tạo questions
          for (let i = 0; i < (questions?.length ?? 0); i++) {
            const q = questions[i];

            // Parse options nếu là string
            let options = q.option;
            if (typeof options === "string") {
              try {
                options = JSON.parse(options);
              } catch {
                throw new Error(`Options của câu hỏi ${i + 1} không hợp lệ.`);
              }
            }

            // Validate elements trong question
            if (q.elements?.length > 0) {
              for (const el of q.elements) {
                if (!el.url) {
                  throw new Error(`Câu hỏi ${i + 1} có element thiếu URL.`);
                }
              }
            }

            // Tạo question
            const createdQuestion = await tx.question.create({
              data: {
                title: q.title,
                description: q.description,
                option: options,
                correct_option: q.correct_option,
                score: Number(q.score),
                order: ++order,
                global_order: ++globalOrder,
                group_id: newGroup.id,
                deleted_at: null,
              },
            });

            // Lưu elements cho question
            if (q.elements?.length > 0) {
              for (const el of q.elements) {
                await tx.element.create({
                  data: {
                    type:
                      el.type === "image"
                        ? TypeElement.image
                        : TypeElement.audio,
                    url: el.url,
                    question_id: createdQuestion.id,
                  },
                });
              }
            }
          }

          return { newGroup };
        },
        { maxWait: 10000, timeout: 20000 }
      );

      return res.status(201).json({
        message: "Tạo câu hỏi thành công.",
        newGroup: result.newGroup,
      });
    } catch (err: any) {
      console.error("Error in createQuestion:", err);
      return res.status(500).json({ error: err.message || "Server error" });
    }
  },

  update: async (req: Request, res: Response): Promise<any> => {
    const { question_id } = req.query;
    const {
      title,
      description,
      option,
      correct_option,
      score,
      global_order,
      elements,
    } = req.body;

    if (!question_id) {
      return res.status(400).json({ error: "Question ID is required!" });
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const existingQuestion = await tx.question.findUnique({
          where: { id: Number(question_id) },
          include: { elements: true },
        });

        if (!existingQuestion) {
          return res.status(404).json({ error: "Question not found" });
        }

        // Parse options JSON
        let parsedOptions = option;
        if (typeof option === "string") {
          try {
            parsedOptions = JSON.parse(option);
          } catch {
            return res.status(400).json({ error: "Invalid options format" });
          }
        }

        // Update question
        const updatedQuestion = await tx.question.update({
          where: { id: Number(question_id) },
          data: {
            title,
            description,
            option: parsedOptions,
            correct_option,
            score: Number(score),
            global_order: Number(global_order),
          },
        });

        // 🔄 Update elements
        if (elements && elements.length > 0) {
          // Kiểm tra element hợp lệ (có url)
          const invalidElement = elements.find((el: any) => !el.url);
          if (invalidElement) {
            return res.status(400).json({ error: "Có element thiếu URL!" });
          }

          // Xoá elements cũ
          await tx.element.deleteMany({
            where: { question_id: Number(question_id) },
          });

          // Lưu elements mới
          const newElements = elements.map((el: any) => ({
            type: el.type === "image" ? TypeElement.image : TypeElement.audio,
            url: el.url,
            question_id: Number(question_id),
          }));

          await tx.element.createMany({ data: newElements });
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

      // Kiểm tra thông tin exam và subject
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

      // Luôn tạo mới hoặc lấy subject đã tồn tại
      let subject = await prisma.subject.findFirst({
        where: { name: Subject, deleted_at: null },
      });

      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            name: Subject,
            deleted_at: null,
          },
        });
      }

      // Luôn tạo mới hoặc lấy exam đã tồn tại
      let exam = await prisma.exam.findFirst({
        where: { name: Exam, deleted_at: null },
      });

      if (!exam) {
        exam = await prisma.exam.create({
          data: {
            name: Exam,
            subject_id: subject.id,
            deleted_at: null,
          },
        });

        // Lấy tất cả các phần sẽ được sử dụng trong exam này
        const uniqueParts = [...new Set(detailQuestions.map((q) => q.Part))];

        // Tạo liên kết exam-part cho tất cả các phần
        for (const partName of uniqueParts) {
          const part = await prisma.part.findFirst({
            where: { name: partName },
          });

          if (part) {
            // Tạo liên kết exam-part
            await prisma.examPart.create({
              data: {
                exam_id: exam.id,
                part_id: part.id,
              },
            });
          }
        }
      }

      // Lấy thứ tự toàn cục lớn nhất cho exam này
      const maxGlobalOrder = await prisma.question.findFirst({
        where: {
          group: {
            exam_id: exam?.id,
          },
        },
        orderBy: { global_order: "desc" },
        select: { global_order: true },
      });

      const startGlobalOrder = maxGlobalOrder?.global_order ?? 0;

      // Nhóm các câu hỏi theo Part
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

      // Kiểm tra xem tất cả các phần có tồn tại và lấy thứ tự của chúng
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

        // Lấy thứ tự phần từ examPart
        const examPart = await prisma.examPart.findFirst({
          where: {
            exam_id: exam.id,
            part_id: existingPart.id,
          },
        });

        // Nếu examPart không tồn tại (không nên xảy ra với exam mới, nhưng có thể với exam đã tồn tại)
        if (!examPart) {
          // Tạo liên kết exam-part
          const newExamPart = await prisma.examPart.create({
            data: {
              exam_id: exam.id,
              part_id: existingPart.id,
            },
          });
          partOrders.set(partName, newExamPart.id);
        } else {
          partOrders.set(partName, examPart.id);
        }
      }

      // Sắp xếp các phần theo thứ tự
      const sortedPartNames = Object.keys(questionsByPart).sort((a, b) => {
        return (partOrders.get(a) || 0) - (partOrders.get(b) || 0);
      });

      // Xử lý từng phần
      const results = [];
      let currentGlobalOrder = startGlobalOrder;

      for (const partName of sortedPartNames) {
        const questions = questionsByPart[partName];
        const part = await prisma.part.findFirst({
          where: { name: partName },
        });

        if (!part) continue;

        // Lấy exam part
        const examPart = await prisma.examPart.findFirst({
          where: {
            exam_id: exam.id,
            part_id: part.id,
          },
        });

        if (!examPart) {
          return res.status(400).json({
            error: `Không tìm thấy liên kết giữa Exam "${Exam}" và Part "${partName}"`,
          });
        }

        // Sắp xếp câu hỏi theo Order trong phần
        const sortedQuestions = [...questions].sort(
          (a, b) => a.Order - b.Order
        );

        // Tạo nhóm câu hỏi
        const lastGroup = await prisma.questionGroup.findFirst({
          where: {
            part_id: part.id,
            exam_id: exam.id,
          },
          orderBy: { order: "desc" },
        });

        const newGroup = await prisma.questionGroup.create({
          data: {
            part_id: part.id,
            exam_id: exam.id,
            order: (lastGroup?.order ?? 0) + 1,
            type_group: 1,
            description: sortedQuestions[0]["Description Group"] || "",
            title: sortedQuestions[0]["Title Group"] || "",
          },
        });

        // Tạo câu hỏi cho nhóm này
        for (let i = 0; i < sortedQuestions.length; i++) {
          const q = sortedQuestions[i];
          currentGlobalOrder++;

          // Chuyển đổi các lựa chọn sang định dạng A, B, C, D
          const options = {
            A: q["Option A"],
            B: q["Option B"],
            C: q["Option C"],
            D: q["Option D"],
          };

          // Chuyển đổi đáp án đúng sang định dạng mảng
          const correctAnswer = q["Correct option"];
          if (!correctAnswer) {
            throw new Error(`Thiếu đáp án cho câu hỏi "${q.Question}"`);
          }

          // Chuyển đổi chuỗi đáp án sang giá trị enum Option
          const correctOption = correctAnswer.replace("Option ", "") as
            | "A"
            | "B"
            | "C"
            | "D";

          const createdQuestion = await prisma.question.create({
            data: {
              title: q.Question,
              description: q.Description || "",
              option: options, // Lưu dưới dạng đối tượng key-value
              correct_option: correctOption, // Lưu dưới dạng enum Option
              score: 1, // Điểm mặc định
              order: q.Order, // Sử dụng Order từ Excel
              group_id: newGroup.id,
              global_order: currentGlobalOrder, // Sử dụng thứ tự toàn cục tăng dần
            },
          });

          // Xử lý phần tử nếu tồn tại
          if (q.Element) {
            // Kiểm tra xem URL phần tử có phải từ Cloudinary không
            const isAudio =
              q.Element.toLowerCase().includes(".mp3") ||
              q.Element.toLowerCase().includes(".wav");
            await prisma.element.create({
              data: {
                type: isAudio ? "audio" : "image",
                url: q.Element, // Sử dụng URL Cloudinary trực tiếp
                question_id: createdQuestion.id,
                cloudId: true,
              },
            });
          }

          // Xử lý phần tử nhóm nếu tồn tại
          if (q["Element Group"] && i === 0) {
            // Kiểm tra xem URL phần tử nhóm có phải từ Cloudinary không
            const isAudio =
              q["Element Group"].toLowerCase().includes(".mp3") ||
              q["Element Group"].toLowerCase().includes(".wav");
            await prisma.element.create({
              data: {
                type: isAudio ? "audio" : "image",
                url: q["Element Group"], // Sử dụng URL Cloudinary trực tiếp
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
      console.error("Lỗi khi upload Excel:", error);
      return res.status(500).json({
        error: error.message || "Lỗi khi xử lý file Excel",
      });
    }
  },
};
