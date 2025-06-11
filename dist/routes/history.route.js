import { Router } from "express";
import { HistoryController } from "../controllers/historyController";
const router = Router();
router.get("/exam-history/:user_id/:exam_id", HistoryController.getExamHistory);
export default router;
