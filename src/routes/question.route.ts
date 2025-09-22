import { RequestHandler, Router } from "express";
import { QuestionController } from "../controllers/questionController.js";
import { createQuestionValidator } from "../validates/questionValidate.js";
import {
  ensureUploadDirForQuestion,
  ensureUploadDirForExcel,
  uploadMiddleware,
} from "../middlewares/fileUpload.js";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth.js";
import { getCloudinarySignature } from "../middlewares/fileUpload.js";

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

router.get(
  "/signature",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  getCloudinarySignature
);

router.post(
  "/createQuestion",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  createQuestionValidator,
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
