import { Router } from "express";
import { SubjectController } from "../controllers/subjectControllers.js";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth.js";

const router = Router();

router.get("/", SubjectController.get);
router.get("/get-subject-with-exam", SubjectController.getSubjectWithExam);
router.get("/:id", SubjectController.getByID);
router.post(
  "/",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  SubjectController.create
);
router.put(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  SubjectController.update
);
router.delete(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  SubjectController.delete
);
router.get("/type-skill/:id", SubjectController.getSubjectByskillType);
export default router;
