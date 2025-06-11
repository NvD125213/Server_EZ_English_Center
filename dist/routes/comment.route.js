import { Router } from "express";
import { CommentController } from "../controllers/commentController";
const router = Router();
router.get("/:exam_id", CommentController.getComments);
router.post("/", CommentController.createComment);
export default router;
