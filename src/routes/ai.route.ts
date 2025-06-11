import { Router, RequestHandler } from "express";
import { aiAgentController } from "../ai/controller.js";

const router = Router();

router.post("/ai-agent", aiAgentController as unknown as RequestHandler);

export default router;
