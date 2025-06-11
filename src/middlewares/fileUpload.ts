import cloudinary from "../config/cloudinary.js"; // adjust path if needed
import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { storage } from "../config/multer.js";
import path from "path";
import multer from "multer";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// Get current file path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadToCloudinary = async (fileUrl: string, folder: string) => {
  return await cloudinary.uploader.upload(fileUrl, {
    resource_type: "auto",
    folder: folder,
  });
};

// Middleware để xử lý cả file của group và questions
export const uploadMiddleware = multer({
  storage,
  fileFilter: (req, file, cb) => {
    console.log("Debug - File being filtered:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
    });

    // Kiểm tra phần mở rộng của file
    const filetypes =
      /jpeg|jpg|png|mp3|wav|mpeg|audio\/mpeg|audio\/wav|xlsx|xls|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    console.log("Debug - File filter results:", {
      extname,
      mimetype,
      originalname: file.originalname,
      fileMimetype: file.mimetype,
    });

    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only images, audio files and Excel files are allowed!"));
  },
}).any();

// Middleware to ensure upload directory exists
export const ensureUploadDirForQuestion = async (
  req: Request,
  res: Response,
  next: Function
) => {
  const { exam_id, part_id, question_id } = req.query;
  console.log("Debug - Request query:", { exam_id, part_id, question_id });

  // Initialize req.body if it doesn't exist
  if (!req.body) {
    req.body = {};
  }

  try {
    // Create base uploads directory if it doesn't exist
    const baseUploadPath = path.join(process.cwd(), "uploads");
    console.log("Debug - Base upload path:", baseUploadPath);

    try {
      await fs.access(baseUploadPath);
      console.log("Debug - Uploads directory exists");
    } catch {
      console.log("Debug - Creating uploads directory");
      await fs.mkdir(baseUploadPath, { recursive: true });
    }

    // If this is an update request (has question_id), set pathDir based on exam/part
    if (question_id) {
      console.log(
        "Debug - Processing update request for question_id:",
        question_id
      );

      // Lấy group_id từ question
      const question = await prisma.question.findUnique({
        where: { id: Number(question_id) },
        include: {
          group: {
            include: {
              part: {
                include: {
                  examParts: {
                    include: { exam: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!question) {
        console.log("Debug - Question not found");
        return res.status(404).json({ error: "Question not found" });
      }

      console.log("Debug - Found question:", {
        groupId: question.group.id,
        partId: question.group.part.id,
        examParts: question.group.part.examParts,
      });

      // Lấy đúng examPart (ưu tiên theo exam_id nếu có)
      let examPart = null;
      if (question.group.part.examParts.length === 1) {
        examPart = question.group.part.examParts[0];
      } else if (exam_id) {
        examPart = question.group.part.examParts.find(
          (ep) => ep.exam_id === Number(exam_id)
        );
      }

      if (!examPart) {
        console.log("Debug - No examPart found");
        return res
          .status(400)
          .json({ error: "Cannot determine exam/part for upload path" });
      }

      const sanitizedExamName = examPart.exam.name.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      );
      const sanitizedPartName = question.group.part.name.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      );

      const pathDir = `${sanitizedExamName}/${sanitizedPartName}`;
      console.log("Debug - Setting pathDir:", pathDir);

      // Set pathDir in both places to ensure consistency
      (req as any).pathDir = pathDir;
      req.body.pathDir = pathDir;

      // Create the full directory path
      const uploadPath = path.join(baseUploadPath, pathDir);
      console.log("Debug - Full upload path:", uploadPath);

      try {
        await fs.access(uploadPath);
        console.log("Debug - Directory exists:", uploadPath);
      } catch {
        console.log("Debug - Creating directory:", uploadPath);
        await fs.mkdir(uploadPath, { recursive: true });
      }

      // Đảm bảo pathDir được set trước khi chuyển sang middleware tiếp theo
      console.log("Debug - Final pathDir:", {
        reqPathDir: (req as any).pathDir,
        bodyPathDir: req.body.pathDir,
      });

      next();
      return;
    }

    // For create request, require exam_id and part_id
    if (!exam_id || !part_id) {
      console.log("Debug - Missing exam_id or part_id for create request");
      return res.status(400).json({ error: "Exam or part is required!" });
    }

    const part_name = await prisma.part.findUnique({
      where: { id: Number(part_id) },
      select: { name: true },
    });
    const exam_name = await prisma.exam.findUnique({
      where: { id: Number(exam_id) },
      select: { name: true },
    });

    if (!part_name || !exam_name) {
      console.log("Debug - Part or Exam not found");
      return res.status(404).json({ error: "Part or Exam not found" });
    }

    // Set pathDir if not already set
    const sanitizedExamName = exam_name.name.replace(/[^a-zA-Z0-9]/g, "_");
    const sanitizedPartName = part_name.name.replace(/[^a-zA-Z0-9]/g, "_");
    const pathDir = `${sanitizedExamName}/${sanitizedPartName}`;

    console.log("Debug - Setting pathDir for create:", pathDir);

    // Set pathDir in both places to ensure consistency
    (req as any).pathDir = pathDir;
    req.body.pathDir = pathDir;

    // Create the full directory path
    const uploadPath = path.join(baseUploadPath, pathDir);
    console.log("Debug - Full upload path:", uploadPath);

    try {
      await fs.access(uploadPath);
      console.log("Debug - Directory exists:", uploadPath);
    } catch {
      console.log("Debug - Creating directory:", uploadPath);
      await fs.mkdir(uploadPath, { recursive: true });
    }

    // Đảm bảo pathDir được set trước khi chuyển sang middleware tiếp theo
    console.log("Debug - Final pathDir:", {
      reqPathDir: (req as any).pathDir,
      bodyPathDir: req.body.pathDir,
    });

    next();
  } catch (error: any) {
    console.error("Error creating upload directory:", error);
    return res.status(500).json({
      error: "Failed to setup upload directory",
      details: error.message,
    });
  }
};

export const ensureUploadDirForExcel = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Create base uploads directory if it doesn't exist
    const baseUploadPath = path.join(process.cwd(), "uploads");
    await fs.mkdir(baseUploadPath, { recursive: true });

    // For Excel upload, we'll create a temporary directory
    const tempDir = path.join(baseUploadPath, "temp");
    await fs.mkdir(tempDir, { recursive: true });

    // Store the temp directory path in request for later use
    (req as any).pathDir = "temp";

    next();
  } catch (error) {
    console.error("Error in ensureUploadDirForExcel:", error);
    return res.status(500).json({ error: "Lỗi khi tạo thư mục upload" });
  }
};
