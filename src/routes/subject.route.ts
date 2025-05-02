import { Router } from "express";
import { SubjectController } from "../controllers/subjectControllers";

const router = Router();

router.get("/", SubjectController.get);
router.get("/:id", SubjectController.getByID);
router.post("/", SubjectController.create);
router.put("/:id", SubjectController.update);
router.delete("/:id", SubjectController.delete);
router.get("/type-skill/:id", SubjectController.getSubjectByskillType);
export default router;
