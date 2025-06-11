import { Request, Response } from "express";
import { Option } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma.js";

// Schema validation for request body
const submitExamSchema = z.object({
  exam_id: z.number(),
  answers: z.array(
    z.object({
      question_id: z.number(),
      selected_option: z.nativeEnum(Option),
    })
  ),
});

export const AnswerController = {
  submitTheExam: async (req: Request, res: Response): Promise<any> => {
    try {
      // Validate request body
      const validatedData = submitExamSchema.parse(req.body);
      const { exam_id, answers } = validatedData;
      const user_id = (req as any).user.id;

      // Get all questions for the exam to validate answers
      const questions = await prisma.question.findMany({
        where: {
          group: {
            exam_id: exam_id,
          },
        },
        select: {
          id: true,
          correct_option: true,
          score: true,
        },
      });

      const existingExam = await prisma.exam.findFirst({
        where: {
          id: exam_id,
        },
      });

      if (!existingExam) {
        return res.status(400).json({
          message: "Exam không tồn tại",
        });
      }

      // Create a map of questions for easy lookup
      const questionMap = new Map(questions.map((q) => [q.id, q]));

      // Validate all questions exist in the exam
      for (const answer of answers) {
        if (!questionMap.has(answer.question_id)) {
          return res.status(400).json({
            success: false,
            message: `Question with ID ${answer.question_id} not found in this exam`,
          });
        }
      }

      let total_score = 0;
      let correct_answers = 0;

      // Prepare data with score calculation
      const processedAnswers = answers.map((answer) => {
        const question = questionMap.get(answer.question_id)!;
        const isCorrect = question.correct_option === answer.selected_option;
        if (isCorrect) {
          total_score += question.score;
          correct_answers++;
        }
        return {
          question_id: answer.question_id,
          user_id,
          exam_id,
          selected_option: answer.selected_option,
          is_correct: isCorrect,
        };
      });

      // Use transaction to ensure data consistency
      const result = await prisma.$transaction(async (tx) => {
        // Bulk insert answers
        await tx.answer.createMany({
          data: processedAnswers,
        });

        // Create a single history record
        await tx.history.create({
          data: {
            user_id,
            exam_id,
            total_score,
            correct_answer: correct_answers,
          },
        });

        return {
          total_score,
          correct_answers,
          total_questions: questions.length,
        };
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid request data",
          errors: error.errors,
        });
      }

      console.error("Error submitting exam:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};
