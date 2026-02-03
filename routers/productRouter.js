import express from "express";
import {
  indexProducts,
  showProducts,
  storeProducts,
} from "../controllers/productController.js";
const router = express.Router();

router.get("/", indexProducts);
router.get("/:slug", showProducts);
router.post("/", storeProducts);

export default router;
