import multer from "multer";
import path from "path";
import { promises as fs } from "fs";

export const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const baseUploadPath = path.join(process.cwd(), "uploads");
      const pathDir = (req as any).pathDir || req.body.pathDir || "default";
      const uploadPath = path.join(baseUploadPath, pathDir);

      console.log("Debug - Multer destination:", {
        baseUploadPath,
        pathDir,
        uploadPath,
      });

      // Ensure directory exists
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      console.error("Error in multer destination:", error);
      cb(error as Error, "");
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}${path.extname(file.originalname)}`;
    console.log("Debug - Multer filename:", uniqueName);
    cb(null, uniqueName);
  },
});

// Middleware để xử lý cả file của group và questions
export const uploadMiddleware = multer({
  storage,
  fileFilter: (req, file, cb) => {
    console.log("Debug - File being filtered:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
    });

    // Kiểm tra phần mở rộng của file
    const filetypes = /jpeg|jpg|png|mp3|wav|mpeg|audio\/mpeg|audio\/wav/;
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
    cb(new Error("Only images and audio files are allowed!"));
  },
}).any();
