import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma";
import { io } from "../index";

// Validation schemas
const createCommentSchema = z.object({
  user_id: z.number().int().positive("User ID must be a positive number"),
  exam_id: z.number().int().positive("Exam ID must be a positive number"),
  content: z.string().min(1, "Content cannot be empty"),
  parent_id: z
    .number()
    .int()
    .positive("Parent ID must be a positive number")
    .nullable()
    .optional(),
});

export const CommentController = {
  createComment: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedData = createCommentSchema.parse(req.body);

      // Check if exam exists
      const exam = await prisma.exam.findFirst({
        where: {
          id: validatedData.exam_id,
          deleted_at: null,
        },
      });

      if (!exam) {
        return res.status(404).json({
          error: "Exam not found",
        });
      }

      // Check if parent comment exists if parent_id is provided
      if (validatedData.parent_id) {
        const parentComment = await prisma.comment.findFirst({
          where: {
            id: validatedData.parent_id,
            exam_id: validatedData.exam_id,
            deleted_at: null,
          },
        });

        if (!parentComment) {
          return res.status(404).json({
            error: "Parent comment not found",
          });
        }
      }

      const comment = await prisma.comment.create({
        data: validatedData,
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
      });

      // Emit realtime notification for new comment
      io.emit("newComment", {
        exam_id: validatedData.exam_id,
        comment: comment,
      });

      return res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return res.status(400).json({
            error: "A comment with this data already exists",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  getComments: async (req: Request, res: Response): Promise<any> => {
    try {
      const { exam_id } = req.params;
      const examIdNum = parseInt(exam_id);

      if (isNaN(examIdNum)) {
        return res.status(400).json({
          error: "Invalid exam ID",
        });
      }

      // Check if exam exists
      const exam = await prisma.exam.findFirst({
        where: {
          id: examIdNum,
          deleted_at: null,
        },
      });

      if (!exam) {
        return res.status(404).json({
          error: "Exam not found",
        });
      }

      // Get all comments for this exam
      const allComments = await prisma.comment.findMany({
        where: {
          exam_id: examIdNum,
          deleted_at: null,
        },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
        orderBy: {
          create_at: "asc",
        },
      });

      // Organize comments into parent-child structure
      const parentComments = allComments.filter(
        (comment) => !comment.parent_id
      );
      const childComments = allComments.filter((comment) => comment.parent_id);

      // Attach children to their parents
      const organizedComments = parentComments.map((parent) => ({
        ...parent,
        children: childComments
          .filter((child) => child.parent_id === parent.id)
          .sort(
            (a, b) =>
              new Date(a.create_at).getTime() - new Date(b.create_at).getTime()
          ),
      }));

      // Sort parent comments by create_at desc
      organizedComments.sort(
        (a, b) =>
          new Date(b.create_at).getTime() - new Date(a.create_at).getTime()
      );

      if (organizedComments.length === 0) {
        return res.status(200).json({
          message: "No comments found for this exam",
          data: [],
        });
      }

      return res.status(200).json(organizedComments);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return res.status(404).json({
            error: "Exam not found",
          });
        }
      }

      return res.status(500).json({
        error: error,
      });
    }
  },
};
