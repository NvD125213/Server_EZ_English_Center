import { RequestHandler, Router } from "express";
import { QuestionController } from "../controllers/questionController";
import { handleValidation } from "../middlewares/handleValidation";
import { createQuestionValidator } from "../validates/questionValidate";
import {
  ensureUploadDirForQuestion,
  ensureUploadDirForExcel,
  uploadMiddleware,
} from "../middlewares/fileUpload";
import express from "express";

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

router.post(
  "/uploadExcel",
  ensureUploadDirForExcel as RequestHandler,
  uploadMiddleware,
  express.json(),
  QuestionController.uploadExcel
);

router.put(
  "/update",
  ensureUploadDirForQuestion as RequestHandler,
  uploadMiddleware,
  QuestionController.update
);

router.delete("/delete", QuestionController.delete);

export default router;
