import connection from "../db/db.js";
import transporter from "../mailer.js";
import { GoogleGenAI } from "@google/genai";

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

  //ERAS
  if (req.query.era) {
    query += " AND eras.slug=?";
    params.push(req.query.era);
  }

  //POWER_SOURCE
  if (req.query.power_source) {
    query += " AND power_sources.slug=?";
    params.push(req.query.power_source);
  }

  //DIMENSION
  if (req.query.dimension) {
    query += " AND products.dimension=?";
    params.push(req.query.dimension);
  }

  //maxPrice deve essere con il valore massimo reale quindi deve avere dei valori di default
  //minprice>0 e maxPrice>0  && maxPrice maggiore di minPrice
  const minPrice = parseFloat(req.query.minPrice);
  const maxPrice = parseFloat(req.query.maxPrice);

  const hasValidMin = !isNaN(minPrice) && minPrice > 0;
  const hasValidMax = !isNaN(maxPrice) && maxPrice > 0;

  // Applico il filtro solo se nessun conflitto tra min e max e min e max validi,o uno o l'altro non valido ne applica solo uno
  if (
    (hasValidMin && hasValidMax && maxPrice >= minPrice) ||
    (hasValidMin && !hasValidMax) ||
    (!hasValidMin && hasValidMax)
  ) {
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

  if (
    req.query.is_featured === "suggested" ||
    req.query.created_at === "last"
  ) {
    query += " LIMIT 6";
  }

  connection.query(query, params, (err, result) => {
    if (err) return next(err);

    const newArray = result.map((results) => ({
      ...results,
      price: Number(results.price),
    }));

    return res.json({
      results: newArray,
      length: result.length,
    });
  });
}

/* show */
function showProducts(req, res, next) {
  const { slug } = req.params;

  const sql =
    "select products.*, eras.name as eras, diets.name as diets, power_sources.name as power_sources from products inner join eras on eras.id  = products.era_id inner join diets on diets.id = products.diet_id inner join power_sources on power_sources.id = products.power_source_id where products.slug = ?";

  connection.query(sql, [slug], (err, results) => {
    if (err) return next(err);
    if (results.length === 0)
      return res.status(404).json({ message: "Robot non trovato!" });
    console.log(results);
    const productResult = results[0];

    //correlati
    const sqlRecommended = `
      (SELECT *, 'stessa_dieta' AS motivo FROM products WHERE diet_id = ? AND id != ? LIMIT 1)

      UNION ALL
      (SELECT *, 'stessa_era' AS motivo FROM products WHERE era_id = ? AND id != ? 

      AND id NOT IN
      (SELECT id FROM products WHERE diet_id = ? AND id != ?)LIMIT 1)

      UNION ALL
      (SELECT *, 'stessa_energia' AS motivo FROM products WHERE power_source_id = ? AND id != ? 
      AND id NOT IN

      (SELECT id FROM products WHERE diet_id = ? AND id != ?) 

      AND id NOT IN 
      (SELECT id FROM products WHERE era_id = ? AND id != ?) 
      
      LIMIT 1)
    `;

    const params = [
      productResult.diet_id,
      productResult.id,
      productResult.era_id,
      productResult.id,
      productResult.diet_id,
      productResult.id,
      productResult.power_source_id,
      productResult.id,
      productResult.diet_id,
      productResult.id,
      productResult.era_id,
      productResult.id,
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
        eras: productResult.eras,
        diets: productResult.diets,
        power_sources: productResult.power_sources,
      };

      const newRecommended = recommended.map((r) => {
        return {
          name: r.name,
          slug: r.slug,
          description: r.description,
          price: Number(r.price),
          is_featured: Number(r.is_featured),
          url_image: r.url_image,
          dimension: r.dimension,
          motivo: r.motivo,
        };
      });

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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const convalida = emailRegex.test(customer.email);
  if (!convalida) {
    return res.status(400).json({
      message: "Errore nel formato dell'email.",
    });
  }

  let cartError = false;
  cart.forEach((c) => {
    if (!c.product_id || !c.quantity || c.quantity <= 0 || isNaN(c.quantity))
      cartError = true;
  });
  if (cartError) {
    return res
      .status(400)
      .json({ message: "Errore nel formato del carrello." });
  }

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

        const datiPivotFinali = righePivot.map((r) => {
          r[0] = nuovoIdAcquisto;
          return r;
        });
        const sqlPiv =
          "INSERT INTO purchase_product (purchase_id, product_id, quantity, unit_price) VALUES ?";

        connection.query(sqlPiv, [datiPivotFinali], async (err) => {
          if (err) return next(err);

          try {
            const mailCliente = transporter.sendMail({
              from: '"Aeterna Dynamics 🤖" <aeterna8@ethereal.email>',
              to: customer.email,
              subject: `[AETERNA] Conferma Ordine: #${nuovoIdAcquisto}`,
              html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #7000ff;">AETERNA DYNAMICS</h2>
          <p>Gentile <strong>${customer.shipping_name}</strong>, il tuo investimento è stato convalidato.</p>
          <p><strong>Riepilogo:</strong></p>
          <ul>${listaProdottiMail}</ul>
          <hr>
          <p>Totale: <strong>${Number(totaleFinale).toFixed(2)}€</strong></p>
          <div style="background: #f0fff4; padding: 15px; border-radius: 8px;">
             <p style="margin:0; color: #27ae60;">🌱 Bio-Sostenibilità: ${donazioneOnlus}€ devoluti.</p>
          </div>
        </div>`,
            });

            const mailVenditore = transporter.sendMail({
              from: '"Aeterna System 🤖" <system@aeterna.email>',
              to: process.env.MAIL,
              subject: `[LOGISTICA] Nuovo Ordine Ricevuto: #${nuovoIdAcquisto}`,
              html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 2px solid #7000ff; padding: 20px;">
          <h2 style="color: #7000ff;">NUOVO ORDINE DA ELABORARE</h2>
          <p>ID Ordine: #${nuovoIdAcquisto} | Fattura: ${invoiceNumber}</p>
          <hr>
          <p><strong>Dati Spedizione:</strong><br>
          ${customer.shipping_name} ${customer.shipping_surname}<br>
          ${customer.shipping_street}, ${customer.shipping_city}<br>

          <hr>
          <ul>${listaProdottiMail}</ul>
        </div>`,
            });

            await Promise.all([mailCliente, mailVenditore]);
            console.log(
              "Notifiche inviate con successo a Cliente e Venditore.",
            );
          } catch (mailErr) {
            console.error(
              "Errore durante l'invio delle notifiche:",
              mailErr.message,
            );
          }

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

async function storeChat(req, res, next) {
  const { messageUtente, history } = req.body;

  const sql = `
    SELECT products.name, products.price, eras.name AS eras, diets.name AS diets, power_sources.name AS power_sources 
    FROM products 
    INNER JOIN eras ON eras.id = products.era_id 
    INNER JOIN power_sources ON power_sources.id = products.power_source_id 
    INNER JOIN diets ON diets.id = products.diet_id`;

  connection.query(sql, async (error, result) => {
    if (error) return next(error);

    const products = result.map((p) => {
      return `Nome: ${p.name}, prezzo: ${p.price}, era: ${p.eras}, dieta: ${p.diets}, Alimentazione: ${p.power_sources}`;
    });
    const string = products.join("\n");

    const messageInstruction = `
### IDENTITÀ
Ti chiami "Aeterna Bot", commesso esperto di Aeterna Dynamics. 
L'estinzione è un ricordo del passato: cloniamo ogni specie nel catalogo.

### REGOLE
1. RISPONDI SEMPRE IN ITALIANO.
2. RISPONDI SOLO IN FORMATO JSON.
3. Non citare realtà esterne (Amazon, Etsy, etc.).

### SCHEMA JSON DI OUTPUT:
{
  "testo_risposta": "Il tuo messaggio di vendita/assistenza in italiano",
  
}

### CATALOGO:
${string}`;

    try {
      const client = new GoogleGenAI({ apiKey: process.env.KEY_API });

      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",

        contents: [
          ...(history || []),
          { role: "user", parts: [{ text: messageUtente }] },
        ],
        config: {
          systemInstruction: messageInstruction,
          responseMimeType: "application/json",
        },
      });

      const responseText = response.candidates[0].content.parts[0].text;

      res.json(JSON.parse(responseText));
    } catch (aiError) {
      console.error("Errore AI:", aiError);
      res.status(500).json({ error: "Errore durante la generazione." });
    }
  });
}

export { indexProducts, showProducts, storeProducts, storeChat };
