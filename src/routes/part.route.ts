import { Router } from "express";
import { PartController } from "../controllers/partControllers";

const router = Router();

router.get("/", PartController.get);
router.get("/:id", PartController.getByID);
router.post("/", PartController.create);
router.put("/:id", PartController.update);
router.delete("/:id", PartController.delete);

export default router;
