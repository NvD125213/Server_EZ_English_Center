import express from "express";
import { consultationController } from "../controllers/consultantController";
const router = express.Router();
// Create a new consultation
router.post("/", consultationController.createConsultation);
// Get all consultations
router.get("/", consultationController.getAllConsultations);
export default router;
