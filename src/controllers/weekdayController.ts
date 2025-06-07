import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma";

// Query parameters validation schema
const queryParamsSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  sort_by: z.enum(["create_at", "week_day", "start_time"]).default("create_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

// Validation schema for creating weekday
const createWeekdaySchema = z.object({
  week_day: z.number().int().min(2).max(8, "Ngày trong tuần phải từ 2 đến 8"),
  hours: z.number().int().positive("Số giờ học phải lớn hơn 0"),
  start_time: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Thời gian không hợp lệ"),
});

// Validation schema for updating weekday
const updateWeekdaySchema = createWeekdaySchema.partial();

export const WeekdayController = {
  // Get all weekdays with pagination and filtering
  get: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedQuery = queryParamsSchema.parse(req.query);
      const { page, limit, sort_by, sort_order, search } = validatedQuery;
      const skip = (page - 1) * limit;

      const where: Prisma.Class_WeekdayWhereInput = {
        deleted_at: null,
      };

      if (search) {
        where.OR = [
          {
            start_time: {
              contains: search,
              mode: "insensitive",
            },
          },
        ];
      }

      const [weekdays, total] = await Promise.all([
        prisma.class_Weekday.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sort_by]: sort_order,
          },
          include: {
            class_schedules: {
              include: {
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        prisma.class_Weekday.count({ where }),
      ]);

      if (weekdays.length === 0) {
        return res.status(200).json({
          message: "Không có dữ liệu",
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      return res.status(200).json({
        data: weekdays,
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

  // Get weekday by ID
  getById: async (req: Request, res: Response): Promise<any> => {
    try {
      const weekdayId = parseInt(req.params.id);
      if (isNaN(weekdayId)) {
        return res.status(400).json({
          error: "ID buổi học không hợp lệ",
        });
      }

      const weekday = await prisma.class_Weekday.findFirst({
        where: {
          id: weekdayId,
          deleted_at: null,
        },
        include: {
          class_schedules: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  teacher: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!weekday) {
        return res.status(404).json({
          error: "Không tìm thấy buổi học",
        });
      }

      return res.status(200).json({
        data: weekday,
      });
    } catch (error) {
      console.error("Lỗi khi lấy thông tin buổi học:", error);
      return res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  // Create new weekday
  create: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedData = createWeekdaySchema.parse(req.body);

      // Check if weekday with same time already exists
      const existingWeekday = await prisma.class_Weekday.findFirst({
        where: {
          week_day: validatedData.week_day,
          start_time: validatedData.start_time,
          deleted_at: null,
        },
      });

      if (existingWeekday) {
        return res.status(400).json({
          error: "Đã tồn tại buổi học với thời gian này",
        });
      }

      const newWeekday = await prisma.class_Weekday.create({
        data: validatedData,
      });

      return res.status(201).json({
        message: "Tạo buổi học thành công",
        data: newWeekday,
      });
    } catch (error) {
      console.error("Lỗi khi tạo buổi học:", error);

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
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  // Update weekday
  update: async (req: Request, res: Response): Promise<any> => {
    try {
      const weekdayId = parseInt(req.params.id);
      if (isNaN(weekdayId)) {
        return res.status(400).json({
          error: "ID buổi học không hợp lệ",
        });
      }

      const validatedData = updateWeekdaySchema.parse(req.body);

      // Check if weekday exists
      const existingWeekday = await prisma.class_Weekday.findFirst({
        where: {
          id: weekdayId,
          deleted_at: null,
        },
      });

      if (!existingWeekday) {
        return res.status(404).json({
          error: "Không tìm thấy buổi học",
        });
      }

      // If updating time, check for conflicts
      if (validatedData.week_day || validatedData.start_time) {
        const weekDay = validatedData.week_day || existingWeekday.week_day;
        const startTime =
          validatedData.start_time || existingWeekday.start_time;

        const conflictingWeekday = await prisma.class_Weekday.findFirst({
          where: {
            id: { not: weekdayId },
            week_day: weekDay,
            start_time: startTime,
            deleted_at: null,
          },
        });

        if (conflictingWeekday) {
          return res.status(400).json({
            error: "Đã tồn tại buổi học với thời gian này",
          });
        }
      }

      const updatedWeekday = await prisma.class_Weekday.update({
        where: { id: weekdayId },
        data: {
          ...validatedData,
          update_at: new Date(),
        },
      });

      return res.status(200).json({
        message: "Cập nhật buổi học thành công",
        data: updatedWeekday,
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật buổi học:", error);

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
            error: "Không tìm thấy buổi học",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  // Delete weekday (soft delete)
  delete: async (req: Request, res: Response): Promise<any> => {
    try {
      const weekdayId = parseInt(req.params.id);
      if (isNaN(weekdayId)) {
        return res.status(400).json({
          error: "ID buổi học không hợp lệ",
        });
      }

      // Check if weekday exists and is not deleted
      const existingWeekday = await prisma.class_Weekday.findFirst({
        where: {
          id: weekdayId,
          deleted_at: null,
        },
        include: {
          class_schedules: true,
        },
      });

      if (!existingWeekday) {
        return res.status(404).json({
          error: "Không tìm thấy buổi học",
        });
      }

      // Check if weekday is being used in any class
      if (existingWeekday.class_schedules.length > 0) {
        return res.status(400).json({
          error: "Không thể xóa buổi học đang được sử dụng trong các lớp",
        });
      }

      // Soft delete
      await prisma.class_Weekday.update({
        where: { id: weekdayId },
        data: {
          deleted_at: new Date(),
        },
      });

      return res.status(200).json({
        message: "Xóa buổi học thành công",
      });
    } catch (error) {
      console.error("Lỗi khi xóa buổi học:", error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return res.status(404).json({
            error: "Không tìm thấy buổi học",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
};
