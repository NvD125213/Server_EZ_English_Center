import { RequestHandler, Router } from "express";
import { QuestionController } from "../controllers/questionController";
import { handleValidation } from "../middlewares/handleValidation";
import { createQuestionValidator } from "../validates/questionValidate";
import {
  ensureUploadDirForQuestion,
  uploadMiddleware,
} from "../middlewares/fileUpload";

const router = Router();

router.get(
  "/getQuestionByPartAndExam",
  QuestionController.getQuestionByPartAndExam
);

router.post(
  "/createQuestion",
  createQuestionValidator,
  ensureUploadDirForQuestion as RequestHandler,
  uploadMiddleware,
  QuestionController.createQuestion
);

export default router;
