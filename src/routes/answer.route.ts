import { Router } from "express";
import { AnswerController } from "../controllers/answerController.js";
import { ensureAuthenticated } from "../middlewares/auth.js";
const router = Router();

// Teacher routes
router.post(
  "/submit-exam",
  ensureAuthenticated,
  AnswerController.submitTheExam
);

export default router;
