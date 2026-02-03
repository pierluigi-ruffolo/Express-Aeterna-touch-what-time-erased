import express from "express";
import routerProducts from "./routers/productRouter.js";
import routerCategory from "./routers/categoryRouters.js";
const app = express();
const port = process.env.PORT;

app.use(express.static("public"));
app.use(express.json());

app.use("/api/products", routerProducts);
app.use("/api", routerCategory);

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
