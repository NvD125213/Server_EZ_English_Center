import { Router } from "express";
import { PartController } from "../controllers/partControllers.js";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth.js";

const router = Router();

router.get("/", PartController.get);
router.get("/:id", PartController.getByID);
router.post(
  "/",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  PartController.create
);
router.put(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  PartController.update
);
router.delete(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  PartController.delete
);

export default router;
