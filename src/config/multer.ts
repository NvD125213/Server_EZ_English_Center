import multer from "multer";
import path from "path";

export const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(
      process.cwd(),
      "uploads",
      req.body.pathDir || "default"
    );
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

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
}).fields([
  { name: "elements", maxCount: 10 }, // Files cho group
  { name: "questions[0][elements]", maxCount: 10 }, // Files cho câu hỏi đầu tiên
  { name: "questions[1][elements]", maxCount: 10 }, // Files cho câu hỏi thứ hai
  { name: "questions[2][elements]", maxCount: 10 }, // Files cho câu hỏi thứ ba
  { name: "questions[3][elements]", maxCount: 10 }, // Files cho câu hỏi thứ tư
  { name: "questions[4][elements]", maxCount: 10 }, // Files cho câu hỏi thứ năm
]);
