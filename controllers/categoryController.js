import connection from "../db/db.js";

function indexEras(req, res, next) {
  const query = `SELECT * FROM eras`;

  connection.query(query, (err, result) => {
    if (err) return next(err);

    const newObj = result.map((e) => {
      return {
        name: e.name,
        slug: e.slug,
        display_period: e.display_period,
      };
    });

    return res.json({
      results: newObj,
    });
  });
}
function indexDiets(req, res, next) {
  const query = `SELECT * FROM diets`;

  connection.query(query, (err, result) => {
    if (err) return next(err);
    const newObj = result.map((e) => {
      return {
        name: e.name,
        slug: e.slug,
        description: e.description,
      };
    });
    return res.json({
      results: newObj,
    });
  });
}
function indexPowerSources(req, res, next) {
  const query = `SELECT * FROM power_sources`;

  connection.query(query, (err, result) => {
    if (err) return next(err);
    const newObj = result.map((e) => {
      return {
        name: e.name,
        slug: e.slug,
        description: e.description,
      };
    });
    return res.json({
      results: newObj,
    });
  });
}

export { indexEras, indexDiets, indexPowerSources };
