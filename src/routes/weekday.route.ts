import express from "express";
import { WeekdayController } from "../controllers/weekdayController";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth";

const router = express.Router();

// Get all weekdays with pagination and filtering
router.get("/", WeekdayController.get);

// Get weekday by ID
router.get("/:id", WeekdayController.getById);

// Create new weekday
router.post(
  "/",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  WeekdayController.create
);

// Update weekday
router.put(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  WeekdayController.update
);

// Delete weekday (soft delete)
router.delete(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  WeekdayController.delete
);

export default router;
