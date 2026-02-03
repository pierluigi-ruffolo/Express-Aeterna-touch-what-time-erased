import connection from "../db/db.js"



/* index */
function indexProducts(req, res, next) {

  let query = `
   SELECT products.*, diets.slug AS diet, eras.slug AS era, power_sources.slug AS power_source
  FROM products
  INNER JOIN eras
  ON products.era_id = eras.id 
  INNER JOIN diets 
  ON products.diet_id = diets.id 
  INNER JOIN power_sources 
  ON products.power_source_id = power_sources.id
  WHERE 1=1
  `;

  const params = []

  if (req.query.diet) {
    query += " AND diets.slug =?"
    params.push(req.query.diet)
  }

  //ERAS
  if (req.query.era) {
    query += " AND eras.slug=?"
    params.push(req.query.era)

  }

  //POWER_SOURCE
  if (req.query.power_source) {
    query += " AND power_sources.slug=?"
    params.push(req.query.power_source)
  }


  //DIMENSION
  if (req.query.dimension) {
    query += " AND products.dimension=?"
    params.push(req.query.dimension)
  }



  //maxPrice deve essere con il valore massimo reale quindi deve avere dei valori di default --da implementare

  //minprice>0 e maxPrice>0  && maxPrice maggiore di minPrice 

  const minPrice = parseFloat(req.query.minPrice)
  const maxPrice = parseFloat(req.query.maxPrice)


  //PRICE MIN
  if (!isNaN(minPrice) && minPrice >= 0) {
    query += "AND products.price >= ?"
    params.push(req.query.minPrice)
  }

  //PRICE MAX
  if (!isNaN(maxPrice) && maxPrice > 0 && maxPrice >= minPrice) {
    query += "AND products.price <= ?"
    params.push(req.query.maxPrice)
  }

  // ORDER BY SEMPRE ALLA FINE
  query += " ORDER BY products.id ASC"

  connection.query(query, params, (err, result) => {
    if (err) return next(err);


    return res.json({
      results: result,
      length: result.length
    })
  })
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
