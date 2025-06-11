import { Router } from "express";
import { aiAgentController } from "../ai/controller";
const router = Router();
router.post("/ai-agent", aiAgentController);
export default router;
