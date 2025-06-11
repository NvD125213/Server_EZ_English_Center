import { Router } from "express";
import { UserController } from "../controllers/userController";
import { ensureAuthenticated } from "../middlewares/auth";
const router = Router();
router.get("/current", ensureAuthenticated, UserController.getCurrentUser);
export default router;
