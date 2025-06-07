import { Router } from "express";
import { ExamController } from "../controllers/examControllers";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth";

const router = Router();

router.get("/", ExamController.get);
router.get("/:id", ExamController.getByID);
router.post(
  "/",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  ExamController.create
);
router.put(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  ExamController.update
);
router.delete(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  ExamController.delete
);

export default router;
