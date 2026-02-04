import express from "express";
import routerProducts from "./routers/productRouter.js";
import routerCategory from "./routers/categoryRouters.js";
import notFound from "./middlewares/notFound.js";
import errorHandler from "./middlewares/errorHandler.js";
const app = express();
const port = process.env.PORT;

app.use(express.static("public"));
app.use(express.json());
app.use(
  corse({
    origin: process.env.REACT_URL,
  }),
);
app.use("/api/products", routerProducts);
app.use("/api", routerCategory);
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
