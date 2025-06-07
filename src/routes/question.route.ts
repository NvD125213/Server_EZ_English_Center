import { RequestHandler, Router } from "express";
import { QuestionController } from "../controllers/questionController";
import { createQuestionValidator } from "../validates/questionValidate";
import {
  ensureUploadDirForQuestion,
  ensureUploadDirForExcel,
  uploadMiddleware,
} from "../middlewares/fileUpload";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth";

import express from "express";

const router = Router();

router.get(
  "/getQuestionByPartAndExam",
  QuestionController.getQuestionByPartAndExam
);

router.get(
  "/getAllQuestionOnExam/:exam_id",
  QuestionController.getAllQuestionOnExam
);

router.post(
  "/createQuestion",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  createQuestionValidator,
  ensureUploadDirForQuestion as RequestHandler,
  uploadMiddleware,
  QuestionController.createQuestion
);

router.post(
  "/uploadExcel",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  ensureUploadDirForExcel as RequestHandler,
  uploadMiddleware,
  express.json(),
  QuestionController.uploadExcel
);

router.put(
  "/update",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  ensureUploadDirForQuestion as RequestHandler,
  uploadMiddleware,
  QuestionController.update
);

router.delete(
  "/delete",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  QuestionController.delete
);

export default router;
