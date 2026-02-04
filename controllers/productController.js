import connection from "../db/db.js";
import transporter from "../mailer.js";
/* index */
function indexProducts(req, res, next) {
  console.log("test");

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

  //--------------FILTRI PAGE PRODUCTS---------------------------
  const params = []
  //DIETA
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


  //minprice>0 e maxPrice>0  && maxPrice maggiore di minPrice 

  const minPrice = parseFloat(req.query.minPrice)
  const maxPrice = parseFloat(req.query.maxPrice)

  //imposto valori di default del minPrice
  if (isNaN(minPrice)) minPrice = 0;


  // //PRICE MIN
  if (!isNaN(minPrice) && minPrice >= 0 && (isNaN(minPrice) || maxPrice >= minPrice)) {
     query += " AND products.price >= ?"
     params.push(minPrice)
   }

  // //PRICE MAX
  // if (!isNaN(maxPrice) && maxPrice > 0) {
  //   query += " AND products.price <= ?"
  //   params.push(maxPrice)
  // }

  //----------------------HOME------------------------------
  //I NOSTRI CONSIGLI
 /*  if (req.query.favourite === "stringa") {
    query += " AND  is_featured = ?"
    params.push(1)


  } */
  //I NUOVI ARRIVI



  // ORDER BY SEMPRE ALLA FINE
 /*  query += " ORDER BY products.id ASC" */

  connection.query(query, params, (err, result) => {
    if (err) return next(err);


    return res.json({
      results: result,
      length: result.length
    })
  })
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

/* store */
function storeProducts(req, res, next) {
  const { customer, cart, billing } = req.body;

  // 1. Validazione Campi Obbligatori
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
        "Errore di validazione: assicurati di aver compilato tutti i dati richiesti.",
    });
  }

  // 2. Controllo Formato Carrello
  let cartError = false;
  cart.forEach((c) => {
    if (!c.product_id || !c.quantity || c.quantity <= 0) cartError = true;
  });
  if (cartError) {
    return res
      .status(400)
      .json({ message: "Errore nel formato del carrello." });
  }

  // 3. Recupero Prezzi dal DB
  const productIds = cart.map((item) => item.product_id);
  const sqlPrices = "SELECT id, price, name FROM products WHERE id IN (?)";

  connection.query(sqlPrices, [productIds], (err, productsInDb) => {
    if (err) return next(err);
    if (productsInDb.length !== [...new Set(productIds)].length) {
      return res
        .status(400)
        .json({ message: "Uno o più prodotti non esistono nel database." });
    }

    let subtotale = 0;
    const righePivot = [];
    let listaProdottiMail = "";

    cart.forEach((itemCarrello) => {
      const prodottoVero = productsInDb.find(
        (p) => p.id === itemCarrello.product_id,
      );
      if (prodottoVero) {
        // FIX: Convertiamo esplicitamente in Numero per evitare errori con toFixed()
        const prezzoUnitario = Number(prodottoVero.price);
        const costoRiga = prezzoUnitario * itemCarrello.quantity;

        subtotale += costoRiga;
        righePivot.push([
          null,
          prodottoVero.id,
          itemCarrello.quantity,
          prezzoUnitario,
        ]);

        listaProdottiMail += `<li>${prodottoVero.name} (x${itemCarrello.quantity}) - ${prezzoUnitario.toFixed(2)}€</li>`;
      }
    });

    const costoSpedizione = subtotale >= 1000 ? 0 : 50;
    const totaleFinale = subtotale + costoSpedizione;
    const donazioneOnlus = (totaleFinale * 0.2).toFixed(2);

    // 4. Inserimento Purchase
    const sqlPurchase = `INSERT INTO purchases (customer_email, shipping_name, shipping_surname, shipping_street, shipping_city, shipping_postcode, shipping_province_state, shipping_country, subtotal, shipping_cost, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const datiP = [
      customer.email,
      customer.shipping_name,
      customer.shipping_surname,
      customer.shipping_street,
      customer.shipping_city,
      customer.shipping_postcode,
      customer.shipping_province_state,
      customer.shipping_country,
      subtotale,
      costoSpedizione,
      totaleFinale,
      customer.payment_method,
    ];

    connection.query(sqlPurchase, datiP, (err, result) => {
      if (err) return next(err);
      const nuovoIdAcquisto = result.insertId;

      // 5. Inserimento Invoice
      const invoiceNumber = `INV-${Date.now()}`;
      const sqlInv = `INSERT INTO invoices (purchase_id, invoice_number, billing_name, billing_surname, billing_street, billing_city, billing_postcode, billing_province_state, billing_country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const datiI = [
        nuovoIdAcquisto,
        invoiceNumber,
        billing.name,
        billing.surname,
        billing.street,
        billing.city,
        billing.postcode,
        billing.province_state,
        billing.country,
      ];

      connection.query(sqlInv, datiI, (err) => {
        if (err) return next(err);

        // 6. Inserimento Pivot
        const datiPivotFinali = righePivot.map((r) => {
          r[0] = nuovoIdAcquisto;
          return r;
        });
        const sqlPiv =
          "INSERT INTO purchase_product (purchase_id, product_id, quantity, unit_price) VALUES ?";

        connection.query(sqlPiv, [datiPivotFinali], async (err) => {
          if (err) return next(err);

          // 7. Invio Mail (dentro la callback finale)
          try {
            await transporter.sendMail({
              from: '"Aeterna Dynamics 🤖" <aeterna8@ethereal.email>',
              to: customer.email,
              cc: process.env.MAIL,
              subject: `[AETERNA] Protocollo di Spedizione Attivato: #${nuovoIdAcquisto}`,
              html: `
                                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
                                    <h2 style="color: #7000ff;">AETERNA DYNAMICS</h2>
                                    <p>Egr. <strong>${customer.shipping_name} ${customer.shipping_surname}</strong>,</p>
                                    <p>Il tuo ordine <strong>#${nuovoIdAcquisto}</strong> è stato convalidato.</p>
                                    <p><strong>Riepilogo:</strong></p>
                                    <ul>${listaProdottiMail}</ul>
                                    <hr>
                                    <p>Spedizione: ${costoSpedizione.toFixed(2)}€</p>
                                    <h3 style="color: #111;">Totale Investimento: ${totaleFinale.toFixed(2)}€</h3>
                                    <div style="background: #f0fff4; padding: 15px; border: 1px dashed #27ae60; border-radius: 8px;">
                                        <p style="margin:0; color: #27ae60;">🌱 <strong>Bio-Sostenibilità:</strong> ${donazioneOnlus}€ verranno devoluti per la protezione delle specie a rischio.</p>
                                    </div>
                                    <p style="font-size: 12px; color: #888; margin-top: 20px;">"Il futuro non è scritto, è costruito riga dopo riga."</p>
                                </div>`,
            });
            console.log("Mail di conferma inviata.");
          } catch (mailErr) {
            console.error("Errore Mail:", mailErr.message);
          }

          // 8. Risposta Finale al Client
          res.status(201).json({
            success: true,
            ordine_id: nuovoIdAcquisto,
            fattura: invoiceNumber,
            totale: totaleFinale.toFixed(2),
            donazione_onlus: donazioneOnlus,
          });
        });
      });
    });
  });
}

export { indexProducts, showProducts, storeProducts };
