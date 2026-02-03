import connection from "../db/db.js";
import transporter from "../mailer.js";
/* index */
function indexProducts(req, res, next) {
  console.log("test");
  console.log("ciao da index");
}

/* show */
function showProducts(req, res, next) {
  const { slug } = req.params;

  const sql = "SELECT * FROM products WHERE slug = ?";

  connection.query(sql, [slug], (err, results) => {
    if (err) return next(err);
    if (results.length === 0)
      return res.status(404).json({ message: "Robot non trovato!" });

    const product = results[0];

    const sqlRecommended = `
      (SELECT *, 'stessa_dieta' AS motivo FROM products WHERE diet_id = ? AND id != ? LIMIT 1)
      UNION
      (SELECT *, 'stessa_era' AS motivo FROM products WHERE era_id = ? AND id != ? LIMIT 1)
      UNION
      (SELECT *, 'stessa_energia' AS motivo FROM products WHERE power_source_id = ? AND id != ? LIMIT 1)
    `;

    const params = [
      product.diet_id,
      product.id,
      product.era_id,
      product.id,
      product.power_source_id,
      product.id,
    ];

    connection.query(sqlRecommended, params, (err, recommendedResults) => {
      if (err) return next(err);

      res.json({
        ...product,
        recommended: recommendedResults,
      });
    });
  });
}

/* store*/
function storeProducts(req, res, next) {
  const { customer, cart, billing } = req.body;

  if (
    !customer ||
    !cart ||
    cart.length === 0 ||
    !billing ||
    !customer.email ||
    !customer.shipping_name ||
    !customer.shipping_surname ||
    !customer.shipping_street ||
    !customer.shipping_city ||
    !customer.shipping_postcode ||
    !customer.shipping_province_state ||
    !customer.shipping_country ||
    !customer.payment_method ||
    !billing.name ||
    !billing.surname ||
    !billing.street ||
    !billing.city ||
    !billing.postcode ||
    !billing.province_state ||
    !billing.country
  ) {
    return res.status(400).json({
      message:
        "Errore di validazione: assicurati di aver compilato tutti i dati di spedizione, fatturazione e che il carrello non sia vuoto.",
    });
  }
  let checked = false;
  cart.forEach((c) => {
    if (!c.product_id || !c.quantity || c.quantity <= 0) {
      checked = true;
      return;
    }
  });

  if (checked) {
    return res.status(400).json({
      message:
        "Errore nel formato del carrello: rilevati product_id mancanti o quantità non valide (minori o uguali a 0).",
    });
  }

  const productIds = cart.map((item) => item.product_id);
  const sqlPrices = "SELECT id, price FROM products WHERE id IN (?)";

  connection.query(sqlPrices, [productIds], (err, productsInDb) => {
    if (err) return next(err);
    if (productsInDb.length !== [...new Set(productIds)].length) {
      return res.status(400).json({
        message:
          "Uno o più prodotti nel carrello non esistono nel nostro database!",
      });
    }
    let subtotale = 0;
    const righePivot = [];

    cart.forEach((itemCarrello) => {
      const prodottoVero = productsInDb.find(
        (p) => p.id === itemCarrello.product_id,
      );
      if (prodottoVero) {
        const costoRiga = prodottoVero.price * itemCarrello.quantity;
        subtotale += costoRiga;
        righePivot.push([
          null,
          prodottoVero.id,
          itemCarrello.quantity,
          prodottoVero.price,
        ]);
      }
    });

    const costoSpedizione = subtotale >= 1000 ? 0 : 50;
    const totaleFinale = subtotale + costoSpedizione;

    const sqlPurchase = `
      INSERT INTO purchases 
      (customer_email, shipping_name, shipping_surname, shipping_street, shipping_city, shipping_postcode, shipping_province_state, shipping_country, subtotal, shipping_cost, total_amount, payment_method) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const datiPurchase = [
      customer.email,
      customer.shipping_name,
      customer.shipping_surname,
      customer.shipping_street,
      customer.shipping_city,
      customer.shipping_postcode,
      customer.shipping_province_state || "N/A",
      customer.shipping_country || "Italy",
      subtotale,
      costoSpedizione,
      totaleFinale,
      customer.payment_method,
    ];

    connection.query(sqlPurchase, datiPurchase, (err, result) => {
      if (err) return next(err);
      const nuovoIdAcquisto = result.insertId;

      const invoiceNumber = `INV-${Date.now()}`;

      const sqlInvoice = `
        INSERT INTO invoices 
        (purchase_id, invoice_number, billing_name, billing_surname, billing_street, billing_city, billing_postcode, billing_province_state, billing_country) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const datiInvoice = [
        nuovoIdAcquisto,
        invoiceNumber,
        billing.name,
        billing.surname,
        billing.street,
        billing.city,
        billing.postcode,
        billing.province_state || "N/A",
        billing.country || "Italy",
      ];

      connection.query(sqlInvoice, datiInvoice, (err) => {
        if (err) return next(err);

        const datiPivotFinali = righePivot.map((riga) => {
          riga[0] = nuovoIdAcquisto;

          return riga;
        });

        const sqlPivot =
          "INSERT INTO purchase_product (purchase_id, product_id, quantity, unit_price) VALUES ?";

        connection.query(sqlPivot, [datiPivotFinali], (err, resul) => {
          if (err) return next(err);

          const sqlNuovoAcquisto = `
 SELECT 
    p.id AS order_id, 
    p.customer_email, 
    p.shipping_name, 
    p.shipping_surname, 
    p.shipping_street, 
    p.shipping_city, 
    p.shipping_postcode, 
    p.shipping_province_state, 
    p.shipping_country,
    p.subtotal,
    p.shipping_cost,
    p.total_amount,
    pp.quantity, 
    pp.unit_price, 
    prod.name AS product_name 
  FROM purchases AS p
  INNER JOIN purchase_product AS pp ON pp.purchase_id = p.id
  INNER JOIN products AS prod ON prod.id = pp.product_id
  WHERE p.id = ?
`;
          (connection.query(
            sqlNuovoAcquisto,
            [nuovoIdAcquisto],
            (error, result) => {
              console.log(result[0].customer_email);
            },
          ),
            (async () => {
              const info = await transporter.sendMail({
                from: 'Aeterna" <aeterna8@ethereal.email>',
                to: ``,
                cc: process.env.MAIL,
                subject: "Hello ✔",
                text: "Hello world?",
              });

              console.log("Message sent:", info.messageId);
            })());
          res.status(201).json({
            success: true,
            ordine_id: nuovoIdAcquisto,
            fattura: invoiceNumber,
            totale: totaleFinale.toFixed(2),
          });
        });
      });
    });
  });
}

export { indexProducts, showProducts, storeProducts };
