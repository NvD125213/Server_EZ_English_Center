import { Router } from "express";
import { PaymentController } from "../controllers/paymentController";

const router = Router();

router.get("/return", PaymentController.handlePaymentReturn);

export default router;
