import connection from "../db/db.js"

function indexEras(req, res, next) {

  const query = `SELECT * FROM eras`;

  connection.query(query, (err, result) => {
    if (err) return next(err);
    return res.json({
      results: result,
    });
  });
}
function indexDiets(req, res, next) {
    const query = `SELECT * FROM diets`;

  connection.query(query, (err, result) => {
    if (err) return next(err);
    return res.json({
      results: result,
    });
  });
}
function indexPowerSources(req, res, next) {
    const query = `SELECT * FROM power_sources`;

  connection.query(query, (err, result) => {
    if (err) return next(err);
    return res.json({
      results: result,
    });
  });
}

export { indexEras, indexDiets, indexPowerSources };
