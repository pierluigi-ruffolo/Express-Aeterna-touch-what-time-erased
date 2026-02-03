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

  connection.query(sql, [slug], (err, results) => {
    if (err) return next(err);
    if (results.length === 0) return res.status(404).json({ message: "Robot non trovato!" });

    const product = results[0];

    
    const sqlRecommended = `
      (SELECT *, 'stessa_dieta' AS motivo FROM products WHERE diet_id = ? AND id != ? LIMIT 1)
      UNION
      (SELECT *, 'stessa_era' AS motivo FROM products WHERE era_id = ? AND id != ? LIMIT 1)
      UNION
      (SELECT *, 'stessa_energia' AS motivo FROM products WHERE power_source_id = ? AND id != ? LIMIT 1)
    `;

    const params = [
      product.diet_id, product.id, 
      product.era_id, product.id, 
      product.power_source_id, product.id
    ];

    connection.query(sqlRecommended, params, (err, recommendedResults) => {
      if (err) return next(err);

    
      res.json({
        ...product,
        recommended: recommendedResults
      });
    });
  });
}





/* store */
function storeProducts(req, res) {
  res.send("ciao da store");
}

export { indexProducts, showProducts, storeProducts };
