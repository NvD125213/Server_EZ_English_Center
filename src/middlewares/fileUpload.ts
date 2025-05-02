import cloudinary from "../config/cloudinary"; // adjust path if needed
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { storage } from "../config/multer";
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
    const filetypes = /jpeg|jpg|png|mp3|wav/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only images and audio files are allowed!"));
  },
}).any(); // Sử dụng .any() để chấp nhận tất cả các field

// Middleware to ensure upload directory exists
export const ensureUploadDirForQuestion = async (
  req: Request,
  res: Response,
  next: Function
) => {
  const { exam_id, part_id } = req.query;
  if (!exam_id || !part_id) {
    return res.status(400).json({ error: "Exam or part is required!" });
  }

  try {
    const part_name = await prisma.part.findUnique({
      where: { id: Number(part_id) },
      select: { name: true },
    });
    const exam_name = await prisma.exam.findUnique({
      where: { id: Number(exam_id) },
      select: { name: true },
    });

    if (!part_name || !exam_name) {
      return res.status(404).json({ error: "Part or Exam not found" });
    }

    // Initialize req.body if it doesn't exist
    if (!req.body) {
      req.body = {};
    }

    // Set pathDir if not already set
    if (!req.body.pathDir) {
      req.body.pathDir = `${exam_name.name}/${part_name.name}`;
    }

    // Create base uploads directory if it doesn't exist
    const baseUploadPath = path.join(process.cwd(), "uploads");
    await fs.mkdir(baseUploadPath, { recursive: true });

    // Create the specific upload directory
    const uploadPath = path.join(baseUploadPath, req.body.pathDir);
    await fs.mkdir(uploadPath, { recursive: true });

    console.log("Created upload directory:", uploadPath);
    next();
  } catch (error: any) {
    console.error("Error creating upload directory:", error);
    return res.status(500).json({
      error: "Failed to setup upload directory",
      details: error.message,
    });
  }
};
