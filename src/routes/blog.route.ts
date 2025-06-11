import { Router } from "express";
import { BlogController } from "../controllers/blogController.js";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth.js";

const router = Router();

// Blog routes
router.get("/", BlogController.get);
router.get("/top/viewed", BlogController.getTopViewed);
router.get("/recent", BlogController.getRecentBlog);
router.get("/menu/:slug", BlogController.getBlogForMenu); // Route for menu blogs
router.get("/:id", BlogController.getByID);
router.post(
  "/",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator", "writer"]),
  BlogController.create
);
router.put(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator", "writer"]),
  BlogController.update
);
router.delete(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator", "writer"]),
  BlogController.delete
);

export default router;
