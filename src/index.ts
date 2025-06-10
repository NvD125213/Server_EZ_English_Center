import express from "express";
import SubjectRouters from "./routes/subject.route";
import ExamRouters from "./routes/exam.route";
import PartRoutes from "./routes/part.route";
import AuthRoutes from "./routes/auth.route";
import UserRoutes from "./routes/user.route";
import QuestionRoutes from "./routes/question.route";
import MenuRoutes from "./routes/menu.route";
import CourseRoutes from "./routes/course.route";
import TeacherRoutes from "./routes/teacher.route";
import BlogRoutes from "./routes/blog.route";
import AnswerRoutes from "./routes/answer.route";
import StaffRoutes from "./routes/staff.route";
import ClassRoutes from "./routes/class.route";
import AddressRoutes from "./routes/address.route";
import WeekdayRoutes from "./routes/weekday.route";
import VNPayRoutes from "./routes/payment.route";
import HistoryRoutes from "./routes/history.route";
import CommentRoutes from "./routes/comment.route";
import AiRoutes from "./routes/ai.route";
import StatisticalRoutes from "./routes/statistical.route";
import ConsultantRoutes from "./routes/consultant.routes";
import { startPaymentTimeoutChecker } from "./crontabs/paymentTimeoutChecker";
// import UploadRoutes from "./routes/upload.route";
import {
  authorize,
  ensureAuthenticated,
  checkStaffPosition,
} from "./middlewares/auth";
import session from "express-session";
import cors from "cors";
import passport from "passport";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Cross-Origin-Opener-Policy"],
  })
);

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
// Save session signin google
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 3,
    },
  })
);
// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Public routes
app.use("/api/auth", AuthRoutes);

// Admin routes (admin can access everything)
app.use("/api/admin", ensureAuthenticated, authorize([1]), (req, res) => {
  res.status(200).json({
    message: "Only admins can access this route",
  });
});

// Staff management routes (admin only)
app.use("/api/staff", ensureAuthenticated, authorize([1]), StaffRoutes);

// Blog routes (accessible by admin, writers and moderators)
// app.use(
//   "/api/blog",
//   ensureAuthenticated,
//   authorize([1, 2]), // Allow both admin and staff
//   checkStaffPosition(["writer", "moderator"]),
//   BlogRoutes
// );
app.use("/api/blog", BlogRoutes);

// Moderator routes (accessible by admin and moderators)
app.use("/api/subject", SubjectRouters);
app.use("/api/exam", ExamRouters);
app.use("/api/part", PartRoutes);
app.use("/api/question", QuestionRoutes);
app.use("/api/user", UserRoutes);
app.use("/api/menu", MenuRoutes);
app.use("/api/course", CourseRoutes);
app.use("/api/teacher", TeacherRoutes);
app.use("/api/answer", AnswerRoutes);
app.use("/api/class", ClassRoutes);
app.use("/api/address", AddressRoutes);
app.use("/api/weekday", WeekdayRoutes);
app.use("/api/vnpay", VNPayRoutes);
app.use("/api/history", HistoryRoutes);
app.use("/api/comment", CommentRoutes);
app.use("/api/statistical", StatisticalRoutes);
app.use("/api/consultation", ConsultantRoutes);
app.use("/api/ai", AiRoutes);
// Lắng nghe sự kiện kết nối từ client
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Lắng nghe sự kiện gửi comment mới từ client
  socket.on("newComment", (comment) => {
    // Gửi lại comment này cho tất cả client khác
    io.emit("newComment", comment);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(3000, async () => {
  console.log("Server started on port 3000");
  startPaymentTimeoutChecker();
});

export { io };
