import express from "express";
import {
  indexProducts,
  showProducts,
  storeProducts,
} from "../controllers/productController.js";
const router = express.Router();
/* index */
router.get("/", indexProducts);
/* show */
router.get("/:slug", showProducts);

export default router;
