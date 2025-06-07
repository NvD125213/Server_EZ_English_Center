import { Request, Response } from "express";
import { Prisma, MenuStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma";

// Helper function to check for circular parent-child relationships
async function checkCircularParent(
  parentId: number,
  targetId: number
): Promise<boolean> {
  let currentParentId = parentId;
  const visited = new Set<number>();

  while (currentParentId) {
    if (currentParentId === targetId) {
      return true; // Circular relationship found
    }

    if (visited.has(currentParentId)) {
      return true; // Loop detected
    }

    visited.add(currentParentId);

    const parent = await prisma.menu.findFirst({
      where: {
        id: currentParentId,
      },
      select: {
        parent_id: true,
      },
    });

    if (!parent || !parent.parent_id) {
      break; // Reached root menu
    }

    currentParentId = parent.parent_id;
  }

  return false;
}

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

// Helper function to get full slug path
async function getFullSlugPath(menuId: number | null): Promise<string> {
  if (!menuId) return "";

  const menu = await prisma.menu.findFirst({
    where: { id: menuId },
    select: { name: true, parent_id: true },
  });

  if (!menu) return "";

  const parentSlug = await getFullSlugPath(menu.parent_id);
  const currentSlug = generateSlug(menu.name);

  return parentSlug ? `${parentSlug}/${currentSlug}` : currentSlug;
}

// Validation schemas
const createMenuSchema = z.object({
  name: z.string().min(2, "Menu name must be at least 2 characters"),
  sort: z.number().int("Sort must be an integer").optional(),
  status: z.enum(["Open", "Close"] as const, {
    errorMap: () => ({ message: "Status must be either Open or Close" }),
  }),
  parent_id: z.number().optional(),
  slug: z.string().optional(),
});

const updateMenuSchema = createMenuSchema.partial().extend({
  deleted_at: z.date().nullable().optional(),
});

// Query parameters validation schema
const queryParamsSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  sort_by: z.enum(["create_at", "sort", "name"]).default("create_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  status: z.enum(["Open", "Close"]).optional(),
});

const getMenuWithChildren = async (
  menuId: number | null,
  status?: "Open" | "Close",
  search?: string,
  sortOrder: "asc" | "desc" = "asc"
): Promise<any> => {
  // Tìm tất cả menu con có thể match với điều kiện search
  const where: Prisma.MenuWhereInput = {
    AND: [
      search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                parent: {
                  name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ],
          }
        : {},
      status ? { status } : {},
      { parent_id: menuId },
    ],
  };

  const children = await prisma.menu.findMany({
    where,
    orderBy: {
      sort: sortOrder,
    },
    select: {
      id: true,
      name: true,
      sort: true,
      status: true,
      slug: true,
      parent_id: true,
      create_at: true,
      update_at: true,
      deleted_at: true,
      parent: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Recursively fetch children for each menu
  const menusWithChildren = await Promise.all(
    children.map(async (menu) => {
      const subChildren = await getMenuWithChildren(
        menu.id,
        status,
        search,
        sortOrder
      );
      return {
        ...menu,
        children: subChildren,
      };
    })
  );

  return menusWithChildren;
};

export const MenuController = {
  get: async (req: Request, res: Response): Promise<any> => {
    try {
      const validatedQuery = queryParamsSchema.parse(req.query);
      const { page, limit, search, status } = validatedQuery;
      const skip = (page - 1) * limit;

      const orderBy: Prisma.MenuOrderByWithRelationInput = { sort: "asc" };

      // Tìm tất cả menu gốc có thể match với điều kiện search
      const where: Prisma.MenuWhereInput = {
        AND: [
          search
            ? {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                  {
                    children: {
                      some: {
                        name: {
                          contains: search,
                          mode: Prisma.QueryMode.insensitive,
                        },
                      },
                    },
                  },
                ],
              }
            : {},
          status ? { status } : {},
          { parent_id: null },
        ],
      };

      const [rootMenus, total] = await Promise.all([
        prisma.menu.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            name: true,
            sort: true,
            status: true,
            slug: true,
            parent_id: true,
            create_at: true,
            update_at: true,
            children: {
              where: search
                ? {
                    name: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  }
                : undefined,
              select: {
                id: true,
                name: true,
                sort: true,
                status: true,
                slug: true,
                parent_id: true,
                create_at: true,
                update_at: true,
                deleted_at: true,
              },
            },
          },
        }),
        prisma.menu.count({ where }),
      ]);

      const menusWithChildren = await Promise.all(
        rootMenus.map(async (menu) => {
          const children = await getMenuWithChildren(
            menu.id,
            status,
            search,
            "asc"
          );
          return {
            ...menu,
            children,
          };
        })
      );

      return res.status(200).json({
        data: menusWithChildren,
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
      const menuId = parseInt(id);

      if (isNaN(menuId)) {
        return res.status(400).json({
          error: "Invalid menu ID",
        });
      }

      const menu = await prisma.menu.findFirst({
        where: {
          id: menuId,
        },
        include: {
          parent: true,
          children: {
            where: {
              deleted_at: null,
            },
          },
        },
      });

      if (!menu) {
        return res.status(404).json({
          error: "Menu not found",
        });
      }

      return res.status(200).json(menu);
    } catch (error) {
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  create: async (req: Request, res: Response): Promise<any> => {
    try {
      console.log("Create menu request body:", req.body); // Debug log
      const validatedData = createMenuSchema.parse(req.body);
      const { parent_id, ...restData } = validatedData;
      console.log("Validated data:", validatedData); // Debug log

      if (parent_id) {
        const parentMenu = await prisma.menu.findFirst({
          where: {
            id: parent_id,
            deleted_at: null,
          },
        });

        if (!parentMenu) {
          return res.status(400).json({
            error: "Parent menu not found",
          });
        }

        // Generate full slug path
        const parentSlug = await getFullSlugPath(parent_id);
        console.log("Parent slug:", parentSlug); // Debug log

        const currentSlug = generateSlug(restData.name);
        console.log("Current slug:", currentSlug); // Debug log

        const fullSlug = `${parentSlug}/${currentSlug}`;
        console.log("Full slug:", fullSlug); // Debug log

        // Tìm order lớn nhất trong các children của parent
        const maxChildSort = await prisma.menu.findFirst({
          where: {
            parent_id: parent_id,
            deleted_at: null,
          },
          orderBy: {
            sort: "desc",
          },
          select: {
            sort: true,
          },
        });

        // Set sort order cho menu mới
        const newSort = maxChildSort ? maxChildSort.sort + 1 : 1;

        const menuData = {
          ...restData,
          parent_id,
          sort: newSort,
          slug: fullSlug,
        };
        console.log("Menu data to create:", menuData); // Debug log

        const menu = await prisma.menu.create({
          data: menuData,
          include: {
            parent: true,
          },
        });

        console.log("Created menu:", menu); // Debug log
        return res.status(201).json(menu);
      } else {
        // Generate slug for root menu
        const slug = generateSlug(restData.name);
        console.log("Root menu slug:", slug); // Debug log

        // Nếu là root menu, tìm order lớn nhất trong các root menus
        const maxRootSort = await prisma.menu.findFirst({
          where: {
            parent_id: null,
            deleted_at: null,
          },
          orderBy: {
            sort: "desc",
          },
          select: {
            sort: true,
          },
        });

        // Set sort order cho menu mới
        const newSort = maxRootSort ? maxRootSort.sort + 1 : 1;

        const menuData = {
          ...restData,
          sort: newSort,
          slug,
        };
        console.log("Root menu data to create:", menuData); // Debug log

        const menu = await prisma.menu.create({
          data: menuData,
          include: {
            parent: true,
          },
        });

        console.log("Created root menu:", menu); // Debug log
        return res.status(201).json(menu);
      }
    } catch (error) {
      console.error("Error creating menu:", error); // Debug log
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error("Prisma error:", error); // Debug log
        if (error.code === "P2002") {
          return res.status(400).json({
            error: "A menu with this name already exists",
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
      const menuId = parseInt(id);

      if (isNaN(menuId)) {
        return res.status(400).json({
          error: "Invalid menu ID",
        });
      }

      const validatedData = updateMenuSchema.parse(req.body);

      const existingMenu = await prisma.menu.findFirst({
        where: {
          id: menuId,
        },
        include: {
          children: {
            where: {
              deleted_at: null,
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (!existingMenu) {
        return res.status(404).json({
          error: "Menu not found",
        });
      }

      // Generate new slug if name is being updated
      let newSlug = existingMenu.slug;
      if (validatedData.name) {
        const parentSlug = await getFullSlugPath(
          validatedData.parent_id || existingMenu.parent_id
        );
        const currentSlug = generateSlug(validatedData.name);
        newSlug = parentSlug ? `${parentSlug}/${currentSlug}` : currentSlug;
      } else if (validatedData.parent_id) {
        // If only parent is being updated, regenerate slug with existing name
        const parentSlug = await getFullSlugPath(validatedData.parent_id);
        const currentSlug = generateSlug(existingMenu.name);
        newSlug = parentSlug ? `${parentSlug}/${currentSlug}` : currentSlug;
      }

      // Update children slugs if parent's slug changes
      if (newSlug !== existingMenu.slug) {
        const children = await prisma.menu.findMany({
          where: {
            parent_id: menuId,
            deleted_at: null,
          },
        });

        // Update each child's slug
        for (const child of children) {
          const childName = child.name;
          const childSlug = generateSlug(childName);
          const fullChildSlug = `${newSlug}/${childSlug}`;

          await prisma.menu.update({
            where: { id: child.id },
            data: { slug: fullChildSlug },
          });
        }
      }

      if (validatedData.parent_id) {
        // Kiểm tra parent_id không được là chính nó
        if (validatedData.parent_id === menuId) {
          return res.status(400).json({
            error: "Menu cannot be its own parent",
          });
        }

        // Kiểm tra parent_id không được là một trong các children của menu hiện tại
        const childIds = existingMenu.children.map((child) => child.id);
        if (childIds.includes(validatedData.parent_id)) {
          return res.status(400).json({
            error: "Cannot set a child menu as parent",
          });
        }

        const parentMenu = await prisma.menu.findFirst({
          where: {
            id: validatedData.parent_id,
            deleted_at: null,
          },
        });

        if (!parentMenu) {
          return res.status(400).json({
            error: "Parent menu not found",
          });
        }

        // Kiểm tra xem parent mới có phải là con của menu hiện tại không (tránh vòng lặp)
        const isCircular = await checkCircularParent(
          validatedData.parent_id,
          menuId
        );
        if (isCircular) {
          return res.status(400).json({
            error: "Circular parent-child relationship detected",
          });
        }
      }

      if (validatedData.sort) {
        const existingSort = await prisma.menu.findFirst({
          where: {
            sort: validatedData.sort,
            id: { not: menuId },
            deleted_at: null,
            parent_id: validatedData.parent_id || existingMenu.parent_id, // Chỉ kiểm tra sort trong cùng parent
          },
        });

        if (existingSort) {
          return res.status(400).json({
            error: "Sort value must be unique within the same parent",
          });
        }
      }

      // Chuẩn bị data để update
      const updateData = {
        ...validatedData,
        slug: newSlug,
      };

      // Nếu status được cập nhật thành Open, xóa deleted_at
      if (validatedData.status === "Open") {
        updateData.deleted_at = null;
      }

      const menu = await prisma.menu.update({
        where: {
          id: menuId,
        },
        data: updateData,
        include: {
          parent: true,
          children: {
            where: {
              deleted_at: null,
            },
          },
        },
      });

      return res.status(200).json(menu);
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
            error: "Menu not found",
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
      const menuId = parseInt(id);

      if (isNaN(menuId)) {
        return res.status(400).json({
          error: "Invalid menu ID",
        });
      }

      const existingMenu = await prisma.menu.findFirst({
        where: {
          id: menuId,
        },
        include: {
          children: {
            where: {
              deleted_at: null,
            },
          },
        },
      });

      if (!existingMenu) {
        return res.status(404).json({
          error: "Menu not found",
        });
      }

      // Kiểm tra nếu menu đã bị xóa trước đó
      if (existingMenu.deleted_at) {
        return res.status(400).json({
          error: "Menu đã bị xóa trước đó",
        });
      }

      // Kiểm tra nếu menu có children chưa bị xóa
      if (existingMenu.children.length > 0) {
        return res.status(400).json({
          error: "Không thể xóa menu có menu con chưa bị xóa",
        });
      }

      // Kiểm tra nếu menu đang ở trạng thái active
      if (existingMenu.status === "Open") {
        return res.status(400).json({
          error: "Không thể xóa menu đang ở trạng thái active",
        });
      }

      const menu = await prisma.menu.update({
        where: {
          id: menuId,
        },
        data: {
          deleted_at: new Date(),
        },
        include: {
          parent: true,
        },
      });

      return res.status(200).json({
        message: "Menu đã được xóa thành công!",
        data: menu,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return res.status(404).json({
            error: "Menu not found",
          });
        }
      }

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  reorder: async (req: Request, res: Response): Promise<any> => {
    const data = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "Invalid data format" });
    }
    try {
      for (const { id, sort } of data) {
        await prisma.menu.update({
          where: { id },
          data: { sort },
        });
      }

      res.status(200).json({ message: "Menu order updated successfully" });
    } catch (error) {
      console.error("Update order failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};
