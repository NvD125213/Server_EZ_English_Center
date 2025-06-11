import { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma.js";

// Validation schemas
const createCourseSchema = z.object({
  menu_id: z.number().positive("Menu ID must be a positive number"),
  lessons: z.number().min(1, "Lessons must be at least 1"),
  term: z.number().min(1, "Term must be at least 1"),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"], {
    errorMap: () => ({ message: "Invalid level value" }),
  }),
  price: z.number().positive("Price must be a positive number"),
  currency: z.string().length(3, "Currency must be 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

const updateCourseSchema = createCourseSchema.partial();

// Query parameters validation schema
const queryParamsSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  sort_by: z
    .enum(["create_at", "price", "lessons", "term"])
    .default("create_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

export const CourseController = {
  get: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedQuery = queryParamsSchema.parse(req.query);
      const { page, limit, sort_by, sort_order, search } = validatedQuery;
      const skip = (page - 1) * limit;

      const where: Prisma.CourseWhereInput = {
        OR: search
          ? [
              {
                description: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                menu: {
                  name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ]
          : undefined,
        deleted_at: null,
      };

      const [courses, total] = await Promise.all([
        prisma.course.findMany({
          where,
          include: {
            menu: true,
          },
          skip,
          take: limit,
          orderBy: {
            [sort_by]: sort_order,
          },
        }),
        prisma.course.count({ where }),
      ]);

      if (courses.length === 0) {
        return res.status(200).json({
          message: "Không có dữ liệu",
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      return res.status(200).json({
        data: courses,
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
      const courseId = parseInt(id);

      if (isNaN(courseId)) {
        return res.status(400).json({
          error: "Invalid course ID",
        });
      }

      const course = await prisma.course.findFirst({
        where: {
          id: courseId,
          deleted_at: null,
        },
        include: {
          menu: true,
        },
      });

      if (!course) {
        return res.status(404).json({
          error: "Course not found",
        });
      }

      return res.status(200).json(course);
    } catch (error) {
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  create: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedData = createCourseSchema.parse(req.body);

      const menuExists = await prisma.menu.findFirst({
        where: {
          id: validatedData.menu_id,
          deleted_at: null,
        },
      });

      if (!menuExists) {
        return res.status(400).json({
          error: "Menu not found",
        });
      }

      const course = await prisma.course.create({
        data: validatedData,
        include: {
          menu: true,
        },
      });

      return res.status(201).json(course);
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
            error: "A course with this data already exists",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  update: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const courseId = parseInt(id);

      if (isNaN(courseId)) {
        return res.status(400).json({
          error: "Invalid course ID",
        });
      }

      const validatedData = updateCourseSchema.parse(req.body);

      const existingCourse = await prisma.course.findFirst({
        where: {
          id: courseId,
          deleted_at: null,
        },
      });

      if (!existingCourse) {
        return res.status(404).json({
          error: "Course not found",
        });
      }

      if (validatedData.menu_id) {
        const menuExists = await prisma.menu.findFirst({
          where: {
            id: validatedData.menu_id,
            deleted_at: null,
          },
        });

        if (!menuExists) {
          return res.status(400).json({
            error: "Menu not found",
          });
        }
      }

      const course = await prisma.course.update({
        where: {
          id: courseId,
        },
        data: validatedData,
        include: {
          menu: true,
        },
      });

      return res.status(200).json(course);
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
        if (error.code === "P2025") {
          return res.status(404).json({
            error: "Course not found",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  delete: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const courseId = parseInt(id);

      if (isNaN(courseId)) {
        return res.status(400).json({
          error: "Invalid course ID",
        });
      }

      const existingCourse = await prisma.course.findFirst({
        where: {
          id: courseId,
          deleted_at: null,
        },
      });

      if (!existingCourse) {
        return res.status(404).json({
          error: "Course not found",
        });
      }

      const course = await prisma.course.update({
        where: {
          id: courseId,
        },
        data: {
          deleted_at: new Date(),
        },
        include: {
          menu: true,
        },
      });

      return res.status(200).json({
        message: "Course was deleted!",
        data: course,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return res.status(404).json({
            error: "Course not found",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },
};
