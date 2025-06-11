import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";

// Validation schemas
const createTeacherSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(10, "Phone must be at least 10 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  photo: z.string().url("Photo must be a valid URL"),
});

const updateTeacherSchema = createTeacherSchema.partial();

// Query parameters validation schema
const queryParamsSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  sort_by: z.enum(["create_at", "name", "email"]).default("create_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

export const TeacherController = {
  get: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedQuery = queryParamsSchema.parse(req.query);
      const { page, limit, sort_by, sort_order, search } = validatedQuery;
      const skip = (page - 1) * limit;

      const where: Prisma.TeacherWhereInput = {
        AND: [
          {
            OR: search
              ? [
                  {
                    name: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                  {
                    email: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                ]
              : undefined,
          },
          { deleted_at: null },
        ],
      };

      const [teachers, total] = await Promise.all([
        prisma.teacher.findMany({
          where,
          include: {
            user: true,
          },
          skip,
          take: limit,
          orderBy: {
            [sort_by]: sort_order,
          },
        }),
        prisma.teacher.count({ where }),
      ]);

      if (teachers.length === 0) {
        return res.status(200).json({
          message: "Không có dữ liệu",
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      return res.status(200).json({
        data: teachers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  getByID: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const teacherId = parseInt(id);

      if (isNaN(teacherId)) {
        return res.status(400).json({
          error: "Invalid teacher ID",
        });
      }

      const teacher = await prisma.teacher.findFirst({
        where: {
          id: teacherId,
          deleted_at: null,
        },
        include: {
          user: true,
        },
      });

      if (!teacher) {
        return res.status(404).json({
          error: "Teacher not found",
        });
      }

      return res.status(200).json(teacher);
    } catch (error) {
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  create: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedData = createTeacherSchema.parse(req.body);

      // Check if email already exists in User table
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (existingUser) {
        return res.status(400).json({
          error: "Email already exists",
        });
      }

      // Use photo URL directly from request body
      const photoUrl = validatedData.photo;

      if (!photoUrl) {
        return res.status(400).json({
          error: "Photo URL is required",
        });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // Create user and teacher in a transaction
      const result = await prisma.$transaction(async (prisma) => {
        try {
          // Create user first
          const user = await prisma.user.create({
            data: {
              email: validatedData.email,
              phone_number: validatedData.phone,
              password: hashedPassword,
              full_name: validatedData.name,
              role: 3, // Role for teacher
            },
          });
          // Create teacher with only necessary fields
          const teacher = await prisma.teacher.create({
            data: {
              user_id: user.id,
              description: validatedData.description,
              photo: photoUrl,
              name: validatedData.name,
              email: validatedData.email,
              phone: validatedData.phone,
            },
            include: {
              user: true,
            },
          });
          return teacher;
        } catch (error) {
          console.error("Error in transaction:", error);
          throw error;
        }
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error("Error in create teacher:", error);

      if (error instanceof z.ZodError) {
        console.log("Validation error:", error.errors);
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
            error: "A teacher with this email already exists",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  update: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const teacherId = parseInt(id);

      if (isNaN(teacherId)) {
        return res.status(400).json({
          error: "Invalid teacher ID",
        });
      }

      const validatedData = updateTeacherSchema.parse(req.body);
      const existingTeacher = await prisma.teacher.findFirst({
        where: {
          id: teacherId,
          deleted_at: null,
        },
        include: {
          user: true,
        },
      });

      if (!existingTeacher) {
        return res.status(404).json({
          error: "Teacher not found",
        });
      }

      // Get photo URL from uploaded file if exists
      const photoUrl = req.file
        ? `/uploads/teachers/${req.file.filename}`
        : undefined;

      // Update both teacher and user in a transaction
      const result = await prisma.$transaction(async (prisma) => {
        try {
          // Update user if email or phone is being updated
          if (
            validatedData.email ||
            validatedData.phone ||
            validatedData.password ||
            validatedData.name
          ) {
            const updateData: any = {
              ...(validatedData.email && { email: validatedData.email }),
              ...(validatedData.phone && { phone_number: validatedData.phone }),
              ...(validatedData.name && { full_name: validatedData.name }),
            };

            // Hash password if it's being updated
            if (validatedData.password) {
              const hashedPassword = await bcrypt.hash(
                validatedData.password,
                10
              );
              updateData.password = hashedPassword;
            }

            console.log("Updating user with data:", updateData);
            await prisma.user.update({
              where: { id: existingTeacher.user_id },
              data: updateData,
            });
          }

          // Prepare teacher update data
          const teacherUpdateData: any = {
            ...(validatedData.name && { name: validatedData.name }),
            ...(validatedData.email && { email: validatedData.email }),
            ...(validatedData.phone && { phone: validatedData.phone }),
            ...(validatedData.description && {
              description: validatedData.description,
            }),
            ...(photoUrl && { photo: photoUrl }),
          };

          console.log("Updating teacher with data:", teacherUpdateData);
          // Update teacher
          const teacher = await prisma.teacher.update({
            where: { id: teacherId },
            data: teacherUpdateData,
            include: {
              user: true,
            },
          });

          return teacher;
        } catch (error) {
          console.error("Error in transaction:", error);
          throw error;
        }
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error updating teacher:", error);

      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({
          error: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error("Prisma error:", error.code, error.message);
        if (error.code === "P2025") {
          return res.status(404).json({
            error: "Teacher not found",
          });
        }
        return res.status(400).json({
          error: `Database error: ${error.message}`,
          code: error.code,
        });
      }

      return res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  delete: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const teacherId = parseInt(id);

      if (isNaN(teacherId)) {
        return res.status(400).json({
          error: "Invalid teacher ID",
        });
      }

      const existingTeacher = await prisma.teacher.findFirst({
        where: {
          id: teacherId,
          deleted_at: null,
        },
        include: {
          user: true,
        },
      });

      if (!existingTeacher) {
        return res.status(404).json({
          error: "Teacher not found",
        });
      }

      // Soft delete both teacher and user in a transaction
      const result = await prisma.$transaction(async (prisma) => {
        // Soft delete user
        await prisma.user.update({
          where: { id: existingTeacher.user_id },
          data: { is_active: false },
        });

        // Soft delete teacher
        const teacher = await prisma.teacher.update({
          where: { id: teacherId },
          data: {
            deleted_at: new Date(),
          },
          include: {
            user: true,
          },
        });

        return teacher;
      });

      return res.status(200).json({
        message: "Teacher was deleted!",
        data: result,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return res.status(404).json({
            error: "Teacher not found",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },
};
