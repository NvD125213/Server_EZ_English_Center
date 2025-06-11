import { Router } from "express";
import { UserController } from "../controllers/userController.js";
import { ensureAuthenticated } from "../middlewares/auth.js";

const router = Router();

router.get("/current", ensureAuthenticated, UserController.getCurrentUser);

export default router;
