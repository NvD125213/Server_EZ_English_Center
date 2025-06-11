import express from "express";
import SubjectRouters from "./routes/subject.route.js";
import ExamRouters from "./routes/exam.route.js";
import PartRoutes from "./routes/part.route.js";
import AuthRoutes from "./routes/auth.route.js";
import UserRoutes from "./routes/user.route.js";
import QuestionRoutes from "./routes/question.route.js";
import MenuRoutes from "./routes/menu.route.js";
import CourseRoutes from "./routes/course.route.js";
import TeacherRoutes from "./routes/teacher.route.js";
import BlogRoutes from "./routes/blog.route.js";
import AnswerRoutes from "./routes/answer.route.js";
import StaffRoutes from "./routes/staff.route.js";
import ClassRoutes from "./routes/class.route.js";
import AddressRoutes from "./routes/address.route.js";
import WeekdayRoutes from "./routes/weekday.route.js";
import VNPayRoutes from "./routes/payment.route.js";
import HistoryRoutes from "./routes/history.route.js";
import CommentRoutes from "./routes/comment.route.js";
import AiRoutes from "./routes/ai.route.js";
import StatisticalRoutes from "./routes/statistical.route.js";
import ConsultantRoutes from "./routes/consultant.routes.js";
import { startPaymentTimeoutChecker } from "./crontabs/paymentTimeoutChecker.js";
// import UploadRoutes from "./routes/upload.route";
import { authorize, ensureAuthenticated } from "./middlewares/auth.js";
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

server.listen(4000, async () => {
  console.log("Server started on port 4000");
  startPaymentTimeoutChecker();
});

export { io };
