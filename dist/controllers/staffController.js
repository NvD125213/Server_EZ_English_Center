import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma";
import bcrypt from "bcryptjs";
// Validation schemas
const createStaffSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
    phone: z.string().min(10, "Phone must be at least 10 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    position: z.string().min(1, "Position is required"),
    photo: z.string().url("Photo must be a valid URL"),
});
const updateStaffSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email format").optional(),
    phone: z.string().min(10, "Phone must be at least 10 characters").optional(),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .optional()
        .or(z.literal("")),
    position: z.string().min(1, "Position is required").optional(),
    photo: z.string().url("Photo must be a valid URL").optional(),
});
// Query parameters validation schema
const queryParamsSchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
    sort_by: z.enum(["create_at", "name", "email"]).default("create_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().optional(),
});
export const StaffController = {
    get: async (req, res) => {
        try {
            const validatedQuery = queryParamsSchema.parse(req.query);
            const { page, limit, sort_by, sort_order, search } = validatedQuery;
            const skip = (page - 1) * limit;
            const where = {
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
            const [staffs, total] = await Promise.all([
                prisma.staff.findMany({
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
                prisma.staff.count({ where }),
            ]);
            if (staffs.length === 0) {
                return res.status(200).json({
                    message: "Không có dữ liệu",
                    data: [],
                    total: 0,
                    page,
                    limit,
                });
            }
            return res.status(200).json({
                data: staffs,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            });
        }
        catch (error) {
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
    getByID: async (req, res) => {
        try {
            const { id } = req.params;
            const staffId = parseInt(id);
            if (isNaN(staffId)) {
                return res.status(400).json({
                    error: "Invalid staff ID",
                });
            }
            const staff = await prisma.staff.findFirst({
                where: {
                    id: staffId,
                    deleted_at: null,
                },
                include: {
                    user: true,
                },
            });
            if (!staff) {
                return res.status(404).json({
                    error: "Staff not found",
                });
            }
            return res.status(200).json(staff);
        }
        catch (error) {
            return res.status(500).json({
                error: "Internal server error",
            });
        }
    },
    create: async (req, res) => {
        try {
            const validatedData = createStaffSchema.parse(req.body);
            // Check if email already exists in User table
            const existingUser = await prisma.user.findUnique({
                where: { email: validatedData.email },
            });
            if (existingUser) {
                return res.status(400).json({
                    error: "Email already exists",
                });
            }
            // Hash password before saving
            const hashedPassword = await bcrypt.hash(validatedData.password, 10);
            // Use photo URL directly from request body
            const photoUrl = validatedData.photo;
            if (!photoUrl) {
                return res.status(400).json({
                    error: "Photo URL is required",
                });
            }
            const result = await prisma.$transaction(async (prisma) => {
                try {
                    // Create user first
                    const user = await prisma.user.create({
                        data: {
                            email: validatedData.email,
                            phone_number: validatedData.phone,
                            password: hashedPassword,
                            full_name: validatedData.name,
                            role: 2,
                        },
                    });
                    const staff = await prisma.staff.create({
                        data: {
                            user_id: user.id,
                            photo: photoUrl,
                            position: validatedData.position,
                            name: validatedData.name,
                            email: validatedData.email,
                            phone: validatedData.phone,
                        },
                        include: {
                            user: true,
                        },
                    });
                    return staff;
                }
                catch (error) {
                    console.error("Error in transaction:", error);
                    throw error;
                }
            });
            return res.status(201).json(result);
        }
        catch (error) {
            console.error("Error in create staff:", error);
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
                        error: "A staff with this email already exists",
                    });
                }
            }
            return res.status(500).json({
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    },
    update: async (req, res) => {
        try {
            const { id } = req.params;
            const staffId = parseInt(id);
            if (isNaN(staffId)) {
                return res.status(400).json({
                    error: "Invalid staff ID",
                });
            }
            const validatedData = updateStaffSchema.parse(req.body);
            const existingStaff = await prisma.staff.findFirst({
                where: {
                    id: staffId,
                    deleted_at: null,
                },
                include: {
                    user: true,
                },
            });
            if (!existingStaff) {
                return res.status(404).json({
                    error: "Staff not found",
                });
            }
            // Get photo URL from uploaded file if exists
            const photoUrl = req.file
                ? `/uploads/staff/${req.file.filename}`
                : undefined;
            // Update both staff and user in a transaction
            const result = await prisma.$transaction(async (prisma) => {
                try {
                    // Update user if email or phone is being updated
                    if (validatedData.email ||
                        validatedData.phone ||
                        validatedData.password ||
                        validatedData.name) {
                        const updateData = {
                            ...(validatedData.email && { email: validatedData.email }),
                            ...(validatedData.phone && { phone_number: validatedData.phone }),
                            ...(validatedData.name && { full_name: validatedData.name }),
                        };
                        // Hash password if it's being updated
                        if (validatedData.password) {
                            const hashedPassword = await bcrypt.hash(validatedData.password, 10);
                            updateData.password = hashedPassword;
                        }
                        await prisma.user.update({
                            where: { id: existingStaff.user_id },
                            data: updateData,
                        });
                    }
                    // Prepare staff update data
                    const staffUpdateData = {
                        ...(validatedData.name && { name: validatedData.name }),
                        ...(validatedData.email && { email: validatedData.email }),
                        ...(validatedData.phone && { phone: validatedData.phone }),
                        ...(validatedData.position && { position: validatedData.position }),
                        ...(photoUrl && { photo: photoUrl }),
                    };
                    // Update staff
                    const staff = await prisma.staff.update({
                        where: { id: staffId },
                        data: staffUpdateData,
                        include: {
                            user: true,
                        },
                    });
                    return staff;
                }
                catch (error) {
                    console.error("Error in transaction:", error);
                    throw error;
                }
            });
            return res.status(200).json(result);
        }
        catch (error) {
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
                        error: "staff not found",
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
    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const staffId = parseInt(id);
            if (isNaN(staffId)) {
                return res.status(400).json({
                    error: "Invalid staff ID",
                });
            }
            const existingStaff = await prisma.staff.findFirst({
                where: {
                    id: staffId,
                    deleted_at: null,
                },
                include: {
                    user: true,
                },
            });
            if (!existingStaff) {
                return res.status(404).json({
                    error: "Staff not found",
                });
            }
            // Soft delete both staff and user in a transaction
            const result = await prisma.$transaction(async (prisma) => {
                // Soft delete user
                await prisma.user.update({
                    where: { id: existingStaff.user_id },
                    data: { is_active: false },
                });
                // Soft delete staff
                const staff = await prisma.staff.update({
                    where: { id: staffId },
                    data: {
                        deleted_at: new Date(),
                    },
                    include: {
                        user: true,
                    },
                });
                return staff;
            });
            return res.status(200).json({
                message: "Staff was deleted!",
                data: result,
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2025") {
                    return res.status(404).json({
                        error: "Staff not found",
                    });
                }
            }
            return res.status(500).json({
                error: "Internal server error",
            });
        }
    },
};
