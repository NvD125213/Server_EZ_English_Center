import { Request, Response } from "express";
import prisma from "../config/prisma.js";

export const HistoryController = {
  getExamHistory: async (req: Request, res: Response): Promise<any> => {
    const { user_id, exam_id } = req.params;

    if (!user_id || !exam_id) {
      return res
        .status(400)
        .json({ error: "User ID and Exam ID are required!" });
    }

    try {
      // Get all answers for this user and exam
      const answers = await prisma.answer.findMany({
        where: {
          user_id: Number(user_id),
          exam_id: Number(exam_id),
          deleted_at: null,
        },
        orderBy: {
          created_at: "desc",
        },
        include: {
          question: {
            include: {
              elements: true,
            },
          },
        },
      });

      if (!answers.length) {
        return res.status(404).json({ error: "No exam history found!" });
      }

      // Get all questions for the exam
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
            include: {
              elements: true,
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

      // Group questions by part and add answers
      const questionsByPart = questionGroups.reduce((acc: any[], group) => {
        const partIndex = acc.findIndex((p) => p.part === group.part.name);

        // Add answers to each question
        const questionsWithAnswers = group.questions.map((question) => {
          // Find all answers for this question
          const questionAnswers = answers.filter(
            (answer) => answer.question_id === question.id
          );

          return {
            ...question,
            answers: questionAnswers.map((answer) => ({
              selected_option: answer.selected_option,
              is_correct: answer.is_correct,
              submitted_at: answer.created_at,
            })),
          };
        });

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
                questions: questionsWithAnswers,
                elements: group.elements,
              },
            ],
            total: questionsWithAnswers.length,
            page: 1,
            limit: 10,
            totalPages: Math.ceil(questionsWithAnswers.length / 10),
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
            questions: questionsWithAnswers,
            elements: group.elements,
          });

          // Update totals
          existingPart.total += questionsWithAnswers.length;
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

      // Group answers by submission time to create exam history
      const examHistory = answers.reduce((acc: any[], answer) => {
        const submissionTime = answer.created_at.toISOString();
        const existingSubmission = acc.find(
          (submission) => submission.submitted_at === submissionTime
        );

        if (existingSubmission) {
          existingSubmission.total_questions += 1;
          if (answer.is_correct) {
            existingSubmission.correct_answers += 1;
          }
        } else {
          acc.push({
            submitted_at: submissionTime,
            total_questions: 1,
            correct_answers: answer.is_correct ? 1 : 0,
          });
        }

        return acc;
      }, []);

      // Calculate total score for each submission
      examHistory.forEach((submission) => {
        submission.total_score = Math.round(
          (submission.correct_answers / submission.total_questions) * 100
        );
      });

      // Sort exam history by submission time (newest first)
      examHistory.sort(
        (a, b) =>
          new Date(b.submitted_at).getTime() -
          new Date(a.submitted_at).getTime()
      );

      const result = {
        questions: questionsByPart,
        exam_history: examHistory,
      };

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching exam history:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
};
