import { Router } from "express";
import { PaymentController } from "../controllers/paymentController.js";

const router = Router();

router.get("/return", PaymentController.handlePaymentReturn);

export default router;
