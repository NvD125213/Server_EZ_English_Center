import { Router } from "express";
import { AnswerController } from "../controllers/answerController";
import { ensureAuthenticated } from "../middlewares/auth";
const router = Router();
// Teacher routes
router.post("/submit-exam", ensureAuthenticated, AnswerController.submitTheExam);
export default router;
