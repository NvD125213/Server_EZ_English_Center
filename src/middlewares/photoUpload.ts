import multer from "multer";
import path from "path";
import { Request } from "express";

// Cấu hình storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/teachers"); // Thư mục lưu trữ ảnh
  },
  filename: (req, file, cb) => {
    // Tạo tên file: timestamp + random string + extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// Kiểm tra file type
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Chỉ chấp nhận các file ảnh
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file ảnh!"));
  }
};

// Cấu hình multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn 5MB
  },
});

// Middleware xử lý lỗi
export const handleUploadError = (
  err: Error,
  req: Request,
  res: any,
  next: any
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "Kích thước file quá lớn. Giới hạn là 5MB",
      });
    }
    return res.status(400).json({
      error: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      error: err.message,
    });
  }
  next();
};

// Export middleware
export const uploadPhoto = upload.single("photo");
