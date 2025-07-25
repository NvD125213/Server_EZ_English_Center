import { Router } from "express";
import { StatisticalController } from "../controllers/statisticalController.js";
import { authorize, ensureAuthenticated } from "../middlewares/auth.js";

const router = Router();
router.get(
  "/get-all-user",
  ensureAuthenticated,
  authorize([1, 2]),
  StatisticalController.getAllUserStatistical
);
router.get(
  "/get-all-user-by-month",
  ensureAuthenticated,
  authorize([1, 2]),
  StatisticalController.getAllUserByMonth
);
router.get(
  "/get-payment-statistical",
  ensureAuthenticated,
  authorize([1, 2]),
  StatisticalController.getPaymentStatistical
);
router.get(
  "/get-payment-statistical-year",
  ensureAuthenticated,
  authorize([1, 2]),
  StatisticalController.getPaymentStatisticalYear
);
router.get(
  "/get-coursed-favorite",
  ensureAuthenticated,
  authorize([1, 2]),
  StatisticalController.getCoursedFavorite
);
export default router;
