/* index */
function indexProducts(req, res) {
  res.send("ciao da index");
}

/* show */
function showProducts(req, res) {
  res.send("ciao da show");
}

/* store */
function storeProducts(req, res) {
  res.send("ciao da store");
}

export { indexProducts, showProducts, storeProducts };
