import { Router } from "express";
import { TeacherController } from "../controllers/teacherController";
import { uploadPhoto, handleUploadError } from "../middlewares/photoUpload";
import { ensureAuthenticated, authorize, checkStaffPosition, } from "../middlewares/auth";
const router = Router();
// Teacher routes
router.get("/", TeacherController.get);
router.get("/:id", TeacherController.getByID);
router.post("/", ensureAuthenticated, authorize([1, 2]), checkStaffPosition(["moderator"]), uploadPhoto, handleUploadError, TeacherController.create);
router.put("/:id", ensureAuthenticated, authorize([1, 2]), checkStaffPosition(["moderator"]), uploadPhoto, handleUploadError, TeacherController.update);
router.delete("/:id", ensureAuthenticated, authorize([1, 2]), checkStaffPosition(["moderator"]), TeacherController.delete);
export default router;
