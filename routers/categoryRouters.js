import express from "express";
import {
  indexEras,
  indexDiets,
  indexPowerSources,
} from "../controllers/categoryController.js";

const router = express.Router();

router.get("/eras", indexEras);
router.get("/diets", indexDiets);
router.get("/power-sources", indexPowerSources);

export default router;
