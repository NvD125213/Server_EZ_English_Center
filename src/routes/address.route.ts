import { Router } from "express";
import { AddressController } from "../controllers/addressController.js";
import {
  ensureAuthenticated,
  authorize,
  checkStaffPosition,
} from "../middlewares/auth.js";
const router = Router();

router.get("/provinces", AddressController.getProvinces);
router.get("/provinces/:code/districts", AddressController.getDistricts);
router.get("/districts/:code/wards", AddressController.getWards);
// Address routes
router.get("/", AddressController.get);
router.get("/:id", AddressController.getById);

router.post(
  "/",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  AddressController.create
);
router.put(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  AddressController.update
);
router.delete(
  "/:id",
  ensureAuthenticated,
  authorize([1, 2]),
  checkStaffPosition(["moderator"]),
  AddressController.delete
);

export default router;
