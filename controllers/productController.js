import connection from "../db/db.js"



/* index */
function indexProducts(req, res, next) {
  console.log("test")
  console.log("ciao da index");
};








/* show */
function showProducts(req, res, next) {
  const { slug } = req.params;

  const sql = "SELECT * FROM products WHERE slug = ?";

  connection.query(sql, [slug], (err, result) => {


    if (err) return next(err);

    if (result.length === 0) {

      return res.status(404).json({
        message: "Spiacente, robot non trovato!"
      });
    } else {
      const singleProduct = result[0];
      res.json(singleProduct);
    }
  });
}





/* store */
function storeProducts(req, res) {
  res.send("ciao da store");
}

export { indexProducts, showProducts, storeProducts };
