import express from "express";
import connection from "./db/db.js";
const app = express();
const port = process.env.PORT;

app.use(express.static("public"));
app.use(express.json());
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
