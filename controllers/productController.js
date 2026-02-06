import connection from "../db/db.js";
import transporter from "../mailer.js";

/* index */
function indexProducts(req, res, next) {
    let query = `
   SELECT 
   products.name, products.slug, products.description, 
   products.price, 
   products.url_image, products.dimension, 
   diets.slug AS diet, eras.slug AS era, power_sources.slug AS power_source
  FROM products
  INNER JOIN eras
  ON products.era_id = eras.id 
  INNER JOIN diets 
  ON products.diet_id = diets.id 
  INNER JOIN power_sources 
  ON products.power_source_id = power_sources.id
  WHERE 1=1 
  `;

    const params = [];

    if (req.query.diet) {
        query += " AND diets.slug =?";
        params.push(req.query.diet);
    }
    if (req.query.era) {
        query += " AND eras.slug=?";
        params.push(req.query.era);
    }
    if (req.query.power_source) {
        query += " AND power_sources.slug=?";
        params.push(req.query.power_source);
    }
    if (req.query.dimension) {
        query += " AND products.dimension=?";
        params.push(req.query.dimension);
    }

    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    const hasValidMin = !isNaN(minPrice) && minPrice > 0;
    const hasValidMax = !isNaN(maxPrice) && maxPrice > 0;

    if ((hasValidMin && hasValidMax && maxPrice >= minPrice) || (hasValidMin && !hasValidMax) || (!hasValidMin && hasValidMax)) {
        if (hasValidMin) {
            query += " AND products.price >= ?";
            params.push(minPrice);
        }
        if (hasValidMax) {
            query += " AND products.price <= ?";
            params.push(maxPrice);
        }
    }

    const search = req.query.search;
    if (search) {
        const sqlSearch = `${search}%`;
        query += " AND products.name LIKE ?";
        params.push(sqlSearch);
    }

    const suggested = req.query.is_featured;
    if (suggested === "suggested") {
        query += " AND products.is_featured = ?";
        params.push(1);
    }

    const created = req.query.created_at;
    if (created === "last") {
        query += " ORDER BY created_at";
    }

    if (req.query.is_featured === "suggested" || req.query.created_at === "last") {
        query += " LIMIT 6";
    }

    connection.query(query, params, (err, result) => {
        if (err) return next(err);
        const newArray = result.map(results => ({
            ...results, price: Number(results.price)
        }))
        return res.json({
            results: newArray,
            length: result.length,
        });
    });
}

/* show */
function showProducts(req, res, next) {
    const { slug } = req.params;
    const sql = "SELECT * FROM products WHERE slug = ?";

    connection.query(sql, [slug], (err, results) => {
        if (err) return next(err);
        if (results.length === 0)
            return res.status(404).json({ message: "Robot non trovato!" });

        const productResult = results[0];

        const sqlRecommended = `
      (SELECT *, 'stessa_dieta' AS motivo FROM products WHERE diet_id = ? AND id != ? LIMIT 1)
      UNION ALL
      (SELECT *, 'stessa_era' AS motivo FROM products WHERE era_id = ? AND id != ? 
      AND id NOT IN (SELECT id FROM products WHERE diet_id = ? AND id != ?) LIMIT 1)
      UNION ALL
      (SELECT *, 'stessa_energia' AS motivo FROM products WHERE power_source_id = ? AND id != ? 
      AND id NOT IN (SELECT id FROM products WHERE diet_id = ? AND id != ?) 
      AND id NOT IN (SELECT id FROM products WHERE era_id = ? AND id != ?) 
      LIMIT 1)
    `;

        const params = [
            productResult.diet_id, productResult.id,
            productResult.era_id, productResult.id,
            productResult.diet_id, productResult.id,
            productResult.power_source_id, productResult.id,
            productResult.diet_id, productResult.id,
            productResult.era_id, productResult.id,
        ];

        connection.query(sqlRecommended, params, (err, recommended) => {
            if (err) return next(err);
            const newObjProduct = {
                name: productResult.name,
                slug: productResult.slug,
                description: productResult.description,
                price: Number(productResult.price),
                is_featured: productResult.is_featured,
                url_image: productResult.url_image,
                dimension: productResult.dimension,
            };

            const newRecommended = recommended.map((r) => ({
                name: r.name,
                slug: r.slug,
                description: r.description,
                price: Number(r.price),
                is_featured: Number(r.is_featured),
                url_image: r.url_image,
                dimension: r.dimension,
                motivo: r.motivo,
            }));

            res.json({
                ...newObjProduct,
                recommended: newRecommended,
            });
        });
    });
}

/* store */
function storeProducts(req, res, next) {
  const { customer, cart, billing } = req.body;

  // 1. Validazione Campi Obbligatori (Shipping & Billing)
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
      message: "Errore di validazione: assicurati di aver compilato tutti i dati richiesti.",
    });
  }

  // 2. Validazione Formato Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customer.email)) {
    return res.status(400).json({
      message: "Errore nel formato dell'email.",
    });
  }

  // 3. Validazione Formato Carrello (basata su slug)
  let cartError = false;
  cart.forEach((c) => {
    if (!c.product_slug || !c.quantity || c.quantity <= 0 || isNaN(c.quantity))
      cartError = true;
  });
  if (cartError) {
    return res.status(400).json({ message: "Errore nel formato del carrello." });
  }

  // 4. Recupero dati prodotti dal DB tramite Slug
  const productSlugs = cart.map((item) => item.product_slug);
  const placeholders = productSlugs.map(() => "?").join(","); 
  const sqlPrices = `SELECT id, price, name, slug FROM products WHERE slug IN (${placeholders})`;

  connection.query(sqlPrices, productSlugs, (err, productsInDb) => {
    if (err) return next(err);

    // Verifica che tutti gli slug inviati esistano nel DB
    const uniqueSlugsRequested = [...new Set(productSlugs)];
    if (productsInDb.length !== uniqueSlugsRequested.length) {
        const trovati = productsInDb.map(p => p.slug);
        const mancanti = uniqueSlugsRequested.filter(s => !trovati.includes(s));
        return res.status(400).json({ 
            message: "Uno o più prodotti non esistono nel database.",
            debug_info: { mancanti_nel_db: mancanti }
        });
    }

    let subtotale = 0;
    const righePivot = [];
    let listaProdottiMail = "";

    // 5. Calcolo subtotale e preparazione dati per tabella pivot
    cart.forEach((itemCarrello) => {
      const prodottoVero = productsInDb.find((p) => p.slug === itemCarrello.product_slug);
      
      if (prodottoVero) {
        const prezzoUnitario = Number(prodottoVero.price);
        const costoRiga = prezzoUnitario * itemCarrello.quantity;

        subtotale += costoRiga;
        
        // Struttura tabella purchase_product: [product_id, purchase_id, quantity, unit_price]
        // Lasciamo il secondo elemento null, lo riempiremo dopo l'insertId dell'acquisto
        righePivot.push([
          prodottoVero.id,
          null,
          itemCarrello.quantity,
          prezzoUnitario,
        ]);

        listaProdottiMail += `<li>${prodottoVero.name} (x${itemCarrello.quantity}) - ${prezzoUnitario.toFixed(2)}€</li>`;
      }
    });

    const costoSpedizione = subtotale >= 1000 ? 0 : 50;
    const totaleFinale = subtotale + costoSpedizione;
    const donazioneOnlus = (totaleFinale * 0.2).toFixed(2);

    // 6. Inserimento Acquisto (purchases)
    const sqlPurchase = `INSERT INTO purchases (customer_email, shipping_name, shipping_surname, shipping_street, shipping_city, shipping_postcode, shipping_province_state, shipping_country, subtotal, shipping_cost, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const datiP = [
      customer.email, customer.shipping_name, customer.shipping_surname,
      customer.shipping_street, customer.shipping_city, customer.shipping_postcode,
      customer.shipping_province_state, customer.shipping_country,
      subtotale, costoSpedizione, totaleFinale, customer.payment_method,
    ];

    connection.query(sqlPurchase, datiP, (err, result) => {
      if (err) return next(err);
      const nuovoIdAcquisto = result.insertId;

      // 7. Inserimento Fattura (invoices)
      const invoiceNumber = `INV-${Date.now()}`;
      const sqlInv = `INSERT INTO invoices (purchase_id, invoice_number, billing_name, billing_surname, billing_street, billing_city, billing_postcode, billing_province_state, billing_country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const datiI = [
        nuovoIdAcquisto, invoiceNumber,
        billing.name, billing.surname, billing.street, billing.city,
        billing.postcode, billing.province_state, billing.country,
      ];

      connection.query(sqlInv, datiI, (err) => {
        if (err) return next(err);

        // 8. Inserimento Relazione Prodotti (purchase_product)
        const datiPivotFinali = righePivot.map((r) => {
          r[1] = nuovoIdAcquisto; 
          return r;
        });

        const sqlPiv = "INSERT INTO purchase_product (product_id, purchase_id, quantity, unit_price) VALUES ?";

        connection.query(sqlPiv, [datiPivotFinali], async (err) => {
          if (err) return next(err);

          // --- LOGICA EMAIL
          
          try {
            const mailCliente = transporter.sendMail({
              from: '"Aeterna Dynamics 🤖" <aeterna8@ethereal.email>',
              to: customer.email,
              subject: `[AETERNA] Conferma Ordine: #${nuovoIdAcquisto}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
                  <h2 style="color: #7000ff;">AETERNA DYNAMICS</h2>
                  <p>Gentile <strong>${customer.shipping_name}</strong>, il tuo investimento è stato convalidato.</p>
                  <ul>${listaProdottiMail}</ul>
                  <hr>
                  <p>Totale: <strong>${Number(totaleFinale).toFixed(2)}€</strong></p>
                  <div style="background: #f0fff4; padding: 15px; border-radius: 8px;">
                    <p style="margin:0; color: #27ae60;">🌱 Bio-Sostenibilità: ${donazioneOnlus}€ devoluti.</p>
                  </div>
                </div>`,
            });
            await mailCliente;
          } catch (mailErr) {
            console.error("Errore invio mail:", mailErr.message);
          }
          

          // 9. Risposta Finale al Frontend
          res.status(201).json({
            success: true,
            ordine_id: nuovoIdAcquisto,
            fattura: invoiceNumber,
            totale: Number(totaleFinale),
            donazione_onlus: Number(donazioneOnlus),
          });
        });
      });
    });
  });
}

export { indexProducts, showProducts, storeProducts };