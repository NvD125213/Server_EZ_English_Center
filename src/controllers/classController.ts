import { Request, Response } from "express";
import { PaymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma";
import { checkTeacherScheduleConflict } from "../utils/checkTeacher";
import { generatePaymentUrl } from "../libs/vnpayment";
import { sendMailPayment } from "../libs/mailer";
import bcrypt from "bcryptjs";

// Validation schemas
const baseClassSchema = z.object({
  name: z.string().min(1, "Tên lớp không được để trống"),
  teacher_id: z.number().int().positive("ID giáo viên phải là số dương"),
  course_id: z.number().int().positive("ID khóa học phải là số dương"),
  address_id: z.number().int().positive("ID địa chỉ phải là số dương"),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu phải có định dạng YYYY-MM-DD"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày kết thúc phải có định dạng YYYY-MM-DD"),
  class_weekdays: z.array(
    z.object({
      weekday_id: z.number().int().positive("ID buổi học phải là số dương"),
      week_day: z.number().int().min(1).max(7, "Thứ trong tuần phải từ 1-7"),
      hours: z.number().int().positive("Số giờ học phải là số dương"),
      start_time: z
        .string()
        .regex(
          /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
          "Thời gian bắt đầu phải có định dạng HH:mm"
        ),
    })
  ),
});

const createClassSchema = baseClassSchema.refine(
  (data) => {
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    return startDate < endDate;
  },
  {
    message: "Ngày kết thúc phải sau ngày bắt đầu",
    path: ["end_date"],
  }
);

const updateClassSchema = baseClassSchema.partial().refine(
  (data) => {
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      return startDate < endDate;
    }
    return true;
  },
  {
    message: "Ngày kết thúc phải sau ngày bắt đầu",
    path: ["end_date"],
  }
);

// Query parameters validation schema
const queryParamsSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  sort_by: z
    .enum(["create_at", "name", "start_date", "end_date"])
    .default("create_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  teacher_id: z.string().regex(/^\d+$/).transform(Number).optional(),
});

type ClassControllerType = {
  get: (req: Request, res: Response) => Promise<any>;
  getById: (req: Request, res: Response) => Promise<any>;
  create: (req: Request, res: Response) => Promise<any>;
  update: (req: Request, res: Response) => Promise<any>;
  delete: (req: Request, res: Response) => Promise<any>;
  getStudentsByClassId: (req: Request, res: Response) => Promise<any>;
  getListClassByAddressAndMonth: (req: Request, res: Response) => Promise<any>;
  registerClass: (req: Request, res: Response) => Promise<any>;
};

// Helper function to get weekday name
function getWeekdayName(day: number): string {
  const weekdays = [
    "Chủ nhật",
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
  ];
  return weekdays[day - 1];
}

export const ClassController: ClassControllerType = {
  get: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedQuery = queryParamsSchema.parse(req.query);
      const { page, limit, sort_by, sort_order, search, teacher_id } =
        validatedQuery;
      const skip = (page - 1) * limit;

      const where: Prisma.ClassWhereInput = {
        AND: [
          search
            ? {
                name: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              }
            : {},
          teacher_id ? { teacher_id } : {},
        ],
      };

      const [classes, total] = await Promise.all([
        prisma.class.findMany({
          where,
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
              },
            },
            course: {
              select: {
                id: true,
                menu: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            class_schedules: {
              include: {
                weekday: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: {
            [sort_by]: sort_order,
          },
        }),
        prisma.class.count({ where }),
      ]);

      if (classes.length === 0) {
        return res.status(200).json({
          message: "Không có dữ liệu",
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      return res.status(200).json({
        data: classes,
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

  getById: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const classId = parseInt(id);

      if (isNaN(classId)) {
        return res.status(400).json({
          error: "Invalid class ID",
        });
      }

      const classData = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
            },
          },
          course: {
            select: {
              id: true,
              menu: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          address: true,
          class_schedules: {
            include: {
              weekday: true,
            },
          },
        },
      });

      if (!classData) {
        return res.status(404).json({
          error: "Class not found",
        });
      }

      return res.status(200).json({ data: classData });
    } catch (error) {
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  create: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedData = createClassSchema.parse(req.body);

      // Check if teacher exists
      const teacher = await prisma.teacher.findUnique({
        where: { id: validatedData.teacher_id },
      });

      if (!teacher) {
        return res.status(404).json({
          error: "Teacher not found",
        });
      }

      // Get weekday details for validation
      const weekdays = await prisma.class_Weekday.findMany({
        where: {
          id: {
            in: validatedData.class_weekdays.map((w) => w.weekday_id),
          },
        },
      });

      // Check for schedule conflicts
      const conflictCheck = await checkTeacherScheduleConflict(
        validatedData.teacher_id,
        weekdays.map((w) => ({
          week_day: w.week_day,
          hours: w.hours,
          start_time: w.start_time,
        })),
        undefined,
        new Date(validatedData.start_date)
      );

      if (conflictCheck.hasConflict) {
        return res.status(400).json({
          error: conflictCheck.conflictDetails,
          details: "Xung đột lịch dạy",
        });
      }

      // Check if course exists
      const course = await prisma.course.findUnique({
        where: { id: validatedData.course_id },
      });

      if (!course) {
        return res.status(404).json({
          error: "Course not found",
        });
      }

      // Check if address exists
      const address = await prisma.address.findUnique({
        where: { id: validatedData.address_id },
      });

      if (!address) {
        return res.status(404).json({
          error: "Address not found",
        });
      }

      // Create class with schedules
      const newClass = await prisma.class.create({
        data: {
          name: validatedData.name,
          teacher_id: validatedData.teacher_id,
          course_id: validatedData.course_id,
          address_id: validatedData.address_id,
          start_date: new Date(validatedData.start_date),
          end_date: new Date(validatedData.end_date),
          class_schedules: {
            create: validatedData.class_weekdays.map((weekday) => ({
              weekday_id: weekday.weekday_id,
            })),
          },
        },
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
            },
          },
          course: {
            select: {
              id: true,
              menu: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          class_schedules: {
            include: {
              weekday: true,
            },
          },
        },
      });

      return res.status(201).json({ data: newClass });
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
            error: "A class with this name already exists",
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
      const classId = parseInt(id);

      if (isNaN(classId)) {
        return res.status(400).json({
          error: "Invalid class ID",
        });
      }

      const validatedData = updateClassSchema.parse(req.body);

      const existingClass = await prisma.class.findUnique({
        where: { id: classId },
      });

      if (!existingClass) {
        return res.status(404).json({
          error: "Class not found",
        });
      }

      // Check if teacher is being updated
      if (validatedData.teacher_id) {
        const teacher = await prisma.teacher.findUnique({
          where: { id: validatedData.teacher_id },
        });

        if (!teacher) {
          return res.status(404).json({
            error: "Teacher not found",
          });
        }

        // Check for schedule conflicts only if class_weekdays is also being updated
        if (validatedData.class_weekdays) {
          const weekdays = await prisma.class_Weekday.findMany({
            where: {
              id: {
                in: validatedData.class_weekdays.map((w) => w.weekday_id),
              },
            },
          });

          const conflictCheck = await checkTeacherScheduleConflict(
            validatedData.teacher_id,
            weekdays.map((w) => ({
              week_day: w.week_day,
              hours: w.hours,
              start_time: w.start_time,
            })),
            classId,
            validatedData.start_date
              ? new Date(validatedData.start_date)
              : undefined
          );

          if (conflictCheck.hasConflict) {
            return res.status(400).json({
              error: conflictCheck.conflictDetails,
              details: "Xung đột lịch dạy",
            });
          }
        }
      }

      // Check if course exists if course_id is being updated
      if (validatedData.course_id) {
        const course = await prisma.course.findUnique({
          where: { id: validatedData.course_id },
        });

        if (!course) {
          return res.status(404).json({
            error: "Course not found",
          });
        }
      }

      // Check if address exists if address_id is being updated
      if (validatedData.address_id) {
        const address = await prisma.address.findUnique({
          where: { id: validatedData.address_id },
        });

        if (!address) {
          return res.status(404).json({
            error: "Address not found",
          });
        }
      }

      // Update class and its schedules
      const updatedClass = await prisma.$transaction(async (prisma) => {
        // Delete existing schedules if class_weekdays is being updated
        if (validatedData.class_weekdays) {
          await prisma.class_Schedule.deleteMany({
            where: { class_id: classId },
          });
        }

        // Update class
        return await prisma.class.update({
          where: { id: classId },
          data: {
            name: validatedData.name,
            teacher_id: validatedData.teacher_id,
            course_id: validatedData.course_id,
            address_id: validatedData.address_id,
            start_date: validatedData.start_date
              ? new Date(validatedData.start_date)
              : undefined,
            end_date: validatedData.end_date
              ? new Date(validatedData.end_date)
              : undefined,
            class_schedules: validatedData.class_weekdays
              ? {
                  create: validatedData.class_weekdays.map((weekday) => ({
                    weekday_id: weekday.weekday_id,
                  })),
                }
              : undefined,
          },
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
              },
            },
            course: {
              select: {
                id: true,
                menu: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            class_schedules: {
              include: {
                weekday: true,
              },
            },
          },
        });
      });

      return res.status(200).json({ data: updatedClass });
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
            error: "Class not found",
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
      const classId = parseInt(id);

      if (isNaN(classId)) {
        return res.status(400).json({
          error: "Invalid class ID",
        });
      }

      const existingClass = await prisma.class.findUnique({
        where: { id: classId },
      });

      if (!existingClass) {
        return res.status(404).json({
          error: "Class not found",
        });
      }

      // Delete class (this will cascade delete related records)
      await prisma.class.delete({
        where: { id: classId },
      });

      return res.status(200).json({
        message: "Class was deleted successfully",
        data: existingClass,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return res.status(404).json({
            error: "Class not found",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  getStudentsByClassId: async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const classId = parseInt(id);

      if (isNaN(classId)) {
        return res.status(400).json({
          error: "Invalid class ID",
        });
      }

      const students = await prisma.class_Student.findMany({
        where: { class_id: classId },
        include: {
          student: true,
          class: {
            select: {
              payments: {
                select: {
                  id: true,
                  status: true,
                  payment_date: true,
                  amount: true,
                  payment_method: true,
                  student_id: true,
                },
              },
            },
          },
        },
      });

      // Transform the data to include payment status
      const formattedStudents = students.map((student) => {
        const studentPayment = student.class.payments.find(
          (payment) => payment.student_id === student.student_id
        );

        return {
          ...student,
          payment_status: studentPayment?.status || "PENDING",
          payment_details: studentPayment || null,
        };
      });

      return res.status(200).json({
        data: formattedStudents.map(({ class: _, ...rest }) => rest), // Remove the nested class object
      });
    } catch (error) {
      console.error("Error in getStudentsByClassId:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  getListClassByAddressAndMonth: async (
    req: Request,
    res: Response
  ): Promise<any> => {
    try {
      const { address_id, month, year } = req.query;

      if (!address_id || !month || !year) {
        return res.status(400).json({
          error: "Missing required parameters",
        });
      }

      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);

      const classes = await prisma.class.findMany({
        where: {
          address_id: Number(address_id),
          start_date: {
            gte: startDate, // start_date >= ngày đầu tháng
            lte: endDate, // start_date <= ngày cuối tháng
          },
        },
        select: {
          id: true,
          name: true,
          start_date: true,
          teacher: {
            select: {
              id: true,
              name: true,
            },
          },
          course: {
            select: {
              id: true,
              menu: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          class_schedules: {
            select: {
              weekday: {
                select: {
                  id: true,
                  week_day: true,
                  start_time: true,
                  hours: true,
                },
              },
            },
          },
        },
      });

      return res.status(200).json({ data: classes });
    } catch (error) {
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },
  registerClass: async (req: Request, res: Response): Promise<any> => {
    try {
      const { class_id, staff_id, course_id, payment_method, student } =
        req.body;

      if (!class_id || !staff_id || !course_id || !payment_method || !student) {
        return res.status(400).json({
          error: "Thiếu trường dữ liệu cần thiết",
        });
      }

      // Validate class, staff, and course existence
      const [classData, staffData, courseData] = await Promise.all([
        prisma.class.findFirst({
          where: { id: class_id },
          include: {
            course: {
              include: {
                menu: true,
              },
            },
          },
        }),
        prisma.staff.findFirst({
          where: { id: staff_id },
        }),
        prisma.course.findFirst({
          where: { id: course_id },
        }),
      ]);

      if (!classData) {
        return res.status(404).json({
          error: "Class not found",
        });
      }

      if (!staffData) {
        return res.status(404).json({
          error: "Staff not found",
        });
      }

      if (!courseData) {
        return res.status(404).json({
          error: "Course not found",
        });
      }

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        let studentId: number;
        let isExistingUser = false;

        // Kiểm tra học viên tồn tại bằng email
        const existingStudent = await tx.student.findFirst({
          where: {
            email: student.email,
          },
          include: {
            user: true,
          },
        });

        if (!existingStudent) {
          // Kiểm tra email đã được sử dụng cho user khác chưa
          const existingUser = await tx.user.findUnique({
            where: {
              email: student.user_email,
            },
            include: {
              students: {
                select: {
                  id: true,
                },
              },
            },
          });

          if (existingUser) {
            isExistingUser = true;
            // Nếu user đã tồn tại và có liên kết với student
            if (existingUser.students && existingUser.students.length > 0) {
              // Lấy student đầu tiên từ mảng
              studentId = existingUser.students[0].id;
            } else {
              // Nếu user tồn tại nhưng chưa có student, tạo student mới
              const newStudent = await tx.student.create({
                data: {
                  user_id: existingUser.id,
                  name: student.name,
                  email: student.email,
                  phone: student.phone,
                  birth: new Date(student.birth),
                  state: student.state,
                  city: student.city,
                  zip_code: student.zip_code,
                  street: student.street,
                },
              });
              studentId = newStudent.id;
            }
          } else {
            // Tạo user mới nếu chưa tồn tại
            const hashedPassword = await bcrypt.hash(student.user_password, 10);
            const newUser = await tx.user.create({
              data: {
                full_name: student.user_name,
                email: student.user_email,
                phone_number: student.user_phone,
                password: hashedPassword,
                role: 4,
              },
            });

            // Create new student
            const newStudent = await tx.student.create({
              data: {
                user_id: newUser.id,
                name: student.name,
                email: student.email,
                phone: student.phone,
                birth: new Date(student.birth),
                state: student.state,
                city: student.city,
                zip_code: student.zip_code,
                street: student.street,
              },
            });
            studentId = newStudent.id;
          }
        } else {
          // Nếu học viên đã tồn tại, kiểm tra thông tin user có khớp không
          if (existingStudent.user.email !== student.user_email) {
            throw new Error(
              "Email học viên không khớp với tài khoản đã tồn tại"
            );
          }
          studentId = existingStudent.id;
          isExistingUser = true;
        }

        // Kiểm tra xem học viên đã đăng ký lớp này chưa
        const existingRegistration = await tx.class_Student.findFirst({
          where: {
            class_id: class_id,
            student_id: studentId,
          },
        });

        if (existingRegistration) {
          throw new Error("Học viên đã đăng ký lớp học này");
        }

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            student_id: studentId,
            staff_id: staff_id,
            class_id: class_id,
            payment_date: new Date(),
            amount: courseData.price,
            payment_method: payment_method as "CASH" | "BANKING",
            status:
              payment_method === "CASH"
                ? PaymentStatus.COMPLETED
                : PaymentStatus.PENDING,
          },
        });

        let paymentUrl = null;
        let vnpTxnRef = null;

        if (payment_method === "BANKING") {
          // Generate payment URL if payment method is BANKING
          const { url, vnp_TxnRef } = generatePaymentUrl({
            amount: Number(courseData.price),
            orderId: `PAY${payment.id}`,
            orderInfo: `Thanh toan khoa hoc ${classData.course.menu.name.replace(
              /[^a-zA-Z0-9\s]/g,
              ""
            )}`,
            returnUrl: String(process.env.VNP_RETURN_URL),
            ipAddr: String(process.env.VNP_IP_ADRR),
          });

          paymentUrl = url;
          vnpTxnRef = vnp_TxnRef;

          // Update payment with vnp_txn_ref
          await tx.payment.update({
            where: { id: payment.id },
            data: { vnp_txn_ref: vnpTxnRef },
          });

          // Create class_Student for BANKING payment
          await tx.class_Student.create({
            data: {
              class_id: class_id,
              student_id: studentId,
            },
          });
        } else {
          // Nếu là CASH, tạo class_Student ngay lập tức
          await tx.class_Student.create({
            data: {
              class_id: class_id,
              student_id: studentId,
            },
          });
        }

        return {
          payment,
          paymentUrl,
          studentId,
          courseName: classData.course.menu.name,
          isExistingUser,
          paymentMethod: payment_method,
        };
      });

      // Send payment email only for BANKING payment
      if (result.paymentMethod === "BANKING" && result.paymentUrl) {
        try {
          await sendMailPayment(
            student.user_email,
            result.courseName,
            Number(courseData.price),
            result.paymentUrl
          );
        } catch (emailError) {
          console.error("Error sending payment email:", emailError);
          // Don't fail the request if email fails
        }
      }

      return res.status(200).json({
        message:
          result.paymentMethod === "CASH"
            ? "Đăng ký và thanh toán tiền mặt thành công"
            : result.isExistingUser
            ? "Đăng ký thành công cho tài khoản đã tồn tại"
            : "Đăng ký thành công",
        data: {
          payment: result.payment,
          paymentUrl: result.paymentUrl,
          isExistingUser: result.isExistingUser,
          paymentMethod: result.paymentMethod,
        },
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  },
};
