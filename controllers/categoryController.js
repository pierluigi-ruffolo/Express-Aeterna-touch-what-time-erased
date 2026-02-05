import connection from "../db/db.js";


//ERAS
function indexEras(req, res, next) {
  const query = `SELECT name, slug, display_period FROM eras`;

  connection.query(query, (err, result) => {
    if (err) return next(err);
   
    return res.json({results: result,});
  });
}

//DIETS
function indexDiets(req, res, next) {
  const query = `SELECT name, slug, description FROM diets`;

  connection.query(query, (err, result) => {
    if (err) return next(err);
   
    return res.json({results: result,});
  });
}

//POWER SOURCES
function indexPowerSources(req, res, next) {
  const query = `SELECT name, slug, description FROM power_sources`;

  connection.query(query, (err, result) => {
    if (err) return next(err);
    
    return res.json({results: result});
  });
}

export { indexEras, indexDiets, indexPowerSources };
