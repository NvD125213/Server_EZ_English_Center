import { Router } from "express";
import { MenuController } from "../controllers/menuController";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth";

const router = Router();

router.get("/", MenuController.get);
router.get("/:id", MenuController.getByID);
router.post(
  "/",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  MenuController.create
);
router.put(
  "/reorder",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  MenuController.reorder
);
router.put(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  MenuController.update
);
router.delete(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  MenuController.delete
);

export default router;
