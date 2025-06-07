import { Router } from "express";
import { CourseController } from "../controllers/courseController";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth";

const router = Router();

router.get("/", CourseController.get);
router.get("/:id", CourseController.getByID);
router.post(
  "/",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  CourseController.create
);
router.put(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  CourseController.update
);
router.delete(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  CourseController.delete
);

export default router;
