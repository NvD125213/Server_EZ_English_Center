import express from "express";
import { StaffController } from "../controllers/staffController";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth";
const router = express.Router();

// Staff management routes
router.get("/", ensureAuthenticated, authorize([1]), StaffController.get);
router.get(
  "/:id",
  ensureAuthenticated,
  authorize([1]),
  StaffController.getByID
);
router.post(
  "/",
  ensureAuthenticated,
  authorize([1]),
  checkStaffPosition(["moderator"]),
  StaffController.create
);
router.put(
  "/:id",
  ensureAuthenticated,
  authorize([1]),
  checkStaffPosition(["moderator"]),
  StaffController.update
);
router.delete(
  "/:id",
  ensureAuthenticated,
  authorize([1]),
  checkStaffPosition(["moderator"]),
  StaffController.delete
);

export default router;
