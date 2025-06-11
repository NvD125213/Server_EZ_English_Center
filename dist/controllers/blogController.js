import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma";
// Validation schemas
const createBlogSchema = z.object({
    title: z.string().min(5, "Title must be at least 5 characters"),
    content: z.string().min(20, "Content must be at least 20 characters"),
    menu_id: z.number().int().positive("Menu ID must be a positive number"),
    status: z.enum(["Open", "Close"]),
    user_id: z.number().int().positive("User ID must be a positive number"),
    description: z.string().optional(),
    image_title: z.string().optional(),
});
const updateBlogSchema = createBlogSchema.partial();
// Query parameters validation schema
const queryParamsSchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
    sort_by: z
        .enum(["create_at", "title", "status", "user_id"])
        .default("create_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().optional(),
    menu_id: z.string().regex(/^\d+$/).transform(Number).optional(),
});
export const BlogController = {
    get: async (req, res) => {
        try {
            const validatedQuery = queryParamsSchema.parse(req.query);
            const { page, limit, sort_by, sort_order, search, menu_id } = validatedQuery;
            const skip = (page - 1) * limit;
            const where = {
                AND: [
                    search
                        ? {
                            OR: [
                                {
                                    title: {
                                        contains: search,
                                        mode: Prisma.QueryMode.insensitive,
                                    },
                                },
                                {
                                    content: {
                                        contains: search,
                                        mode: Prisma.QueryMode.insensitive,
                                    },
                                },
                            ],
                        }
                        : {},
                    menu_id ? { menu_id } : {},
                    { deleted_at: null },
                ],
            };
            const [blogs, total] = await Promise.all([
                prisma.blog.findMany({
                    where,
                    include: {
                        user: {
                            select: {
                                id: true,
                                full_name: true,
                                email: true,
                            },
                        },
                        menu: true,
                    },
                    skip,
                    take: limit,
                    orderBy: {
                        [sort_by]: sort_order,
                    },
                }),
                prisma.blog.count({ where }),
            ]);
            if (blogs.length === 0) {
                return res.status(200).json({
                    message: "Không có dữ liệu",
                    data: [],
                    total: 0,
                    page,
                    limit,
                });
            }
            return res.status(200).json({
                data: blogs,
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
            const blogId = parseInt(id);
            if (isNaN(blogId)) {
                return res.status(400).json({
                    error: "Invalid blog ID",
                });
            }
            // Tăng view_count trước khi trả về bài viết
            await prisma.blog.update({
                where: { id: blogId },
                data: { view_count: { increment: 1 } },
            });
            const blog = await prisma.blog.findFirst({
                where: {
                    id: blogId,
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
                    menu: true,
                },
            });
            if (!blog) {
                return res.status(404).json({
                    error: "Blog not found",
                });
            }
            return res.status(200).json(blog);
        }
        catch (error) {
            return res.status(500).json({
                error: "Internal server error",
            });
        }
    },
    create: async (req, res) => {
        try {
            const validatedData = createBlogSchema.parse(req.body);
            // Check if menu exists
            const menu = await prisma.menu.findFirst({
                where: {
                    id: validatedData.menu_id,
                    deleted_at: null,
                },
            });
            if (!menu) {
                return res.status(404).json({
                    error: "Menu not found",
                });
            }
            const blog = await prisma.blog.create({
                data: validatedData,
                include: {
                    user: {
                        select: {
                            id: true,
                            full_name: true,
                            email: true,
                        },
                    },
                    menu: true,
                },
            });
            return res.status(201).json(blog);
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
                if (error.code === "P2002") {
                    return res.status(400).json({
                        error: "A blog with this title already exists",
                    });
                }
            }
            return res.status(500).json({
                error: "Internal server error",
            });
        }
    },
    update: async (req, res) => {
        try {
            const { id } = req.params;
            const blogId = parseInt(id);
            if (isNaN(blogId)) {
                return res.status(400).json({
                    error: "Invalid blog ID",
                });
            }
            const validatedData = updateBlogSchema.parse(req.body);
            const existingBlog = await prisma.blog.findFirst({
                where: {
                    id: blogId,
                    deleted_at: null,
                },
            });
            if (!existingBlog) {
                return res.status(404).json({
                    error: "Blog not found",
                });
            }
            // Check if menu exists if menu_id is being updated
            if (validatedData.menu_id) {
                const menu = await prisma.menu.findFirst({
                    where: {
                        id: validatedData.menu_id,
                        deleted_at: null,
                    },
                });
                if (!menu) {
                    return res.status(404).json({
                        error: "Menu not found",
                    });
                }
            }
            const blog = await prisma.blog.update({
                where: { id: blogId },
                data: validatedData,
                include: {
                    user: {
                        select: {
                            id: true,
                            full_name: true,
                            email: true,
                        },
                    },
                    menu: true,
                },
            });
            return res.status(200).json(blog);
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
                        error: "Blog not found",
                    });
                }
            }
            return res.status(500).json({
                error: "Internal server error",
            });
        }
    },
    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const blogId = parseInt(id);
            if (isNaN(blogId)) {
                return res.status(400).json({
                    error: "Invalid blog ID",
                });
            }
            const existingBlog = await prisma.blog.findFirst({
                where: {
                    id: blogId,
                    deleted_at: null,
                },
            });
            if (!existingBlog) {
                return res.status(404).json({
                    error: "Blog not found",
                });
            }
            const blog = await prisma.blog.update({
                where: { id: blogId },
                data: {
                    deleted_at: new Date(),
                },
            });
            return res.status(200).json({
                message: "Blog was deleted!",
                data: blog,
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2025") {
                    return res.status(404).json({
                        error: "Blog not found",
                    });
                }
            }
            return res.status(500).json({
                error: "Internal server error",
            });
        }
    },
    getBlogForMenu: async (req, res) => {
        try {
            // Decode the URL-encoded slug
            const slug = decodeURIComponent(req.params.slug);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            // Find menu by exact slug match
            const menu = await prisma.menu.findFirst({
                where: {
                    slug: slug,
                    deleted_at: null,
                },
            });
            if (!menu) {
                return res.status(404).json({
                    error: "Menu not found",
                    message: `Không tìm thấy menu với slug: ${slug}`,
                });
            }
            // Get total count of blogs for pagination
            const totalBlogs = await prisma.blog.count({
                where: {
                    menu_id: menu.id,
                    deleted_at: null,
                },
            });
            // Get paginated blogs
            const blogs = await prisma.blog.findMany({
                where: {
                    menu_id: menu.id,
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
                    menu: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
                orderBy: {
                    create_at: "desc",
                },
                skip: skip,
                take: limit,
            });
            if (blogs.length === 0) {
                return res.status(200).json({
                    message: "Không có bài viết nào trong menu này",
                    data: [],
                    pagination: {
                        total: 0,
                        page: page,
                        limit: limit,
                        totalPages: 0,
                    },
                });
            }
            return res.status(200).json({
                data: blogs,
                pagination: {
                    total: totalBlogs,
                    page: page,
                    limit: limit,
                    totalPages: Math.ceil(totalBlogs / limit),
                },
            });
        }
        catch (error) {
            console.error("Error in getBlogForMenu:", error);
            return res.status(500).json({
                error: "Internal server error",
            });
        }
    },
    getTopViewed: async (req, res) => {
        try {
            const blogs = await prisma.blog.findMany({
                where: { deleted_at: null },
                orderBy: { view_count: "desc" },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    image_title: true,
                    view_count: true,
                    create_at: true,
                    description: true,
                },
            });
            return res.status(200).json({ data: blogs });
        }
        catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    },
    getRecentBlog: async (req, res) => {
        try {
            const blogs = await prisma.blog.findMany({
                where: { deleted_at: null },
                orderBy: { create_at: "desc" },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    image_title: true,
                    view_count: true,
                    create_at: true,
                    description: true,
                },
            });
            return res.status(200).json({ data: blogs });
        }
        catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    },
};
