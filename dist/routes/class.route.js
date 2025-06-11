import { Router } from "express";
import { ClassController } from "../controllers/classController";
import { ensureAuthenticated, authorize, checkStaffPosition, } from "../middlewares/auth";
const router = Router();
// Teacher routes
router.get("/", ClassController.get);
router.get("/get-class-by-address-and-month", ClassController.getListClassByAddressAndMonth);
router.get("/:id", ClassController.getById);
router.get("/:id/students", ClassController.getStudentsByClassId);
router.post("/", ensureAuthenticated, authorize([1, 2]), checkStaffPosition(["moderator"]), ClassController.create);
router.put("/:id", ensureAuthenticated, authorize([1, 2]), checkStaffPosition(["moderator"]), ClassController.update);
router.delete("/:id", ensureAuthenticated, authorize([1, 2]), checkStaffPosition(["moderator"]), ClassController.delete);
router.post("/register-class", ClassController.registerClass);
export default router;
