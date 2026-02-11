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
      return res
        .status(404)
        .json({ message: "404 NOT FOUND - Robot non trovato!" });
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
        "ERROR 400 - Errore di validazione: assicurati di aver compilato tutti i dati richiesti.",
    });
  }

  //funzione che mi scorre ogni nome cognome, città,  lettera per lettera e verifica che non sia un numero o carattere speciale escluso accenti e apostrofi
  function notValidInput(input) {
    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (
        !(
          (char >= "A" && char <= "Z") ||
          (char >= "a" && char <= "z") ||
          char === " " ||
          char === "'" ||
          char === "à" ||
          char === "è" ||
          char === "ì" ||
          char === "ò" ||
          char === "ù"
        )
      ) {
        return true;
      }
    }
    return false;
  }
  // funzione che controlla che il CAP abbia 5 valori numerici da 0 a 9 (quindi non lettere e non simboli come -)
  function isValidCAP(input) {
    const cap = input.trim();
    return /^\d{5}$/.test(cap);
  }

  //name
  if (notValidInput(customer.shipping_name) || notValidInput(billing.name)) {
    return res.status(400).json({
      message:
        "ERROR 400 - il nome non deve contenere numeri o caratteri speciali.",
    });
  }

  //surname
  if (
    notValidInput(customer.shipping_surname) ||
    notValidInput(billing.surname)
  ) {
    return res.status(400).json({
      message:
        "ERROR 400 - il cognome non deve contenere numeri o caratteri speciali.",
    });
  }
  // CAP

  if (
    !isValidCAP(customer.shipping_postcode) ||
    !isValidCAP(billing.postcode)
  ) {
    return res.status(400).json({
      message:
        "ERROR 400 - Il CAP deve contenere esattamente 5 numeri e non deve essere negativo.",
    });
  }

  //city
  if (notValidInput(customer.shipping_city) || notValidInput(billing.city)) {
    return res.status(400).json({
      message:
        "ERROR 400 - la città non deve contenere numeri o caratteri speciali.",
    });
  }

  //province
  if (
    notValidInput(customer.shipping_province_state) ||
    notValidInput(billing.province_state)
  ) {
    return res.status(400).json({
      message:
        "ERROR 400 - la provincia non deve contenere numeri o caratteri speciali.",
    });
  }

  //country
  if (
    notValidInput(customer.shipping_country) ||
    notValidInput(billing.country)
  ) {
    return res.status(400).json({
      message:
        "ERROR 400 - il paese non deve contenere numeri o caratteri speciali.",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const convalida = emailRegex.test(customer.email);
  if (!convalida) {
    return res.status(400).json({
      message: "ERROR 400 - Errore nel formato dell'email.",
    });
  }

  let cartError = false;
  cart.forEach((c) => {
    // Sostituito product_id con product_slug
    if (!c.product_slug || !c.quantity || c.quantity <= 0 || isNaN(c.quantity))
      cartError = true;
  });
  if (cartError) {
    return res
      .status(400)
      .json({ message: "ERROR 400 - Errore nel formato del carrello." });
  }

  // Estrazione degli slug dal carrello
  const productSlugs = cart.map((item) => item.product_slug);
  // Query aggiornata per cercare tramite slug
  const sqlPrices =
    "SELECT id, price, name, slug FROM products WHERE slug IN (?)";

  connection.query(sqlPrices, [productSlugs], (err, productsInDb) => {
    if (err) return next(err);
    // Controllo basato sulla lunghezza degli slug unici
    if (productsInDb.length !== [...new Set(productSlugs)].length) {
      return res.status(400).json({
        message: "ERROR 400 - Uno o più prodotti non esistono nel database.",
      });
    }

    let subtotale = 0;
    const righePivot = [];
    let listaProdottiMail = "";

    cart.forEach((itemCarrello) => {
      // Ricerca tramite slug invece che ID
      const prodottoVero = productsInDb.find(
        (p) => p.slug === itemCarrello.product_slug,
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
          res.status(201).json({
            success: true,
            ordine_id: nuovoIdAcquisto,
            fattura: invoiceNumber,
            totale: Number(totaleFinale),
            donazione_onlus: Number(donazioneOnlus),
          });
          try {
            const mailOptionsCliente = {
              from: '"Aeterna 🤖" <aeterna8@ethereal.email>',
              to: customer.email,
              subject: `[AETERNA] Conferma Ordine: #${nuovoIdAcquisto}`,
              html: `
    <div style="background-color: #f8f9fa; padding: 40px 10px; font-family: 'Inter', sans-serif; color: #3a3a3a;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border: 4px solid rgba(69, 194, 216, 0.423); border-radius: 10px; padding: 40px; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);">
            
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 1px solid #dee2e6; padding-bottom: 20px;">
                <h1 style="font-family: 'Anta', sans-serif; color: #b3904a; letter-spacing: 2px; margin: 0; font-size: 28px; text-transform: uppercase;">AETERNA</h1>
            </div>

            <div style="margin-bottom: 30px;">
                <h4 style="font-family: 'Anta', sans-serif; color: #575757; font-size: 18px; margin-bottom: 15px;">Conferma Protocollo #${nuovoIdAcquisto}</h4>
                <p style="font-size: 15px; color: #555; line-height: 1.6;">
                    Grazie <strong style="color: #000;">${customer.shipping_name}</strong>, <br>
                    Il tuo ordine è stato ricevuto. I nostri sistemi stanno elaborando la tua richiesta di acquisizione bio-robotica.
                </p>
            </div>

            <div style="border: 3px double rgba(69, 194, 216, 0.423); border-radius: 10px; padding: 20px; margin-bottom: 25px; background-color: #ffffff;">
                <h4 style="font-family: 'Anta', sans-serif; color: #575757; margin-top: 0; font-size: 14px; text-transform: uppercase;">Asset in Consegna:</h4>
                <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; color: #585858;">
                    ${listaProdottiMail}
                </ul>
            </div>

            <table style="width: 100%; font-family: 'Anta', sans-serif; color: #3a3a3a;">
                <tr>
                    <td style="padding: 5px 0;">Spedizione:</td>
                    <td style="text-align: right;">${costoSpedizione === 0 ? "Gratis" : costoSpedizione.toFixed(2) + "€"}</td>
                </tr>
                <tr style="font-size: 20px; font-weight: bold;">
                    <td style="padding-top: 15px; color: #3a3a3a;">TOTALE:</td>
                    <td style="padding-top: 15px; text-align: right; color: #b3904a;">${Number(totaleFinale).toFixed(2)}€</td>
                </tr>
            </table>

            <div style="margin-top: 30px; text-align: center;">
                <div style="display: inline-block; padding: 12px 30px; background: linear-gradient(to bottom, #e0b969, #a7894f); color: #fff; border-radius: 10px; border: 4px double #ffffff; font-family: 'Anta', sans-serif; font-weight: bold; text-decoration: none;">
                    ORDINE IN ELABORAZIONE
                </div>
            </div>

            <div style="text-align: center; margin-top: 40px; color: #817f7f; font-size: 11px;">
                <p class="anta-font">AETERNA | BIO-INGEGNERIA | 2026</p>
            </div>
        </div>
    </div>`,
            };

            const mailOptionsVenditore = {
              from: '"Aeterna 🤖" <aeterna8@ethereal.email>',
              to: process.env.MAIL,
              subject: `[LOGISTICA] Nuovo Ordine Ricevuto: #${nuovoIdAcquisto}`,
              html: `
    <div style="background-color: #ffffff; padding: 20px; font-family: 'Courier New', monospace; border: 3px solid rgba(69, 194, 216, 0.423); color: #3a3a3a;">
        <h2 style="color: #b3904a; border-bottom: 2px solid rgba(69, 194, 216, 0.423); padding-bottom: 10px;">AVVISO LOGISTICA: ORDINE #${nuovoIdAcquisto}</h2>
        
        <p><strong>DATI SPEDIZIONE:</strong></p>
        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #50cbd1;">
            NOME: ${customer.shipping_name} ${customer.shipping_surname}<br>
            INDIRIZZO: ${customer.shipping_street}, ${customer.shipping_city} (${customer.shipping_postcode})<br>
            METODO PAGAMENTO: ${customer.payment_method}
        </div>

        <p style="margin-top: 20px;"><strong>MANIFESTO ASSET:</strong></p>
        <ul style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #b3904a; list-style-type: square;">
            ${listaProdottiMail}
        </ul>

        <hr style="border: 0; border-top: 1px solid #dee2e6; margin: 20px 0;">
        <p style="font-size: 12px; color: #817f7f;">Fattura Generata: ${invoiceNumber}</p>
    </div>`,
            };

            await transporter.sendMail(mailOptionsCliente);
            console.log("Mail CLIENTE inviata.");

            console.log("Attesa di 11 secondi per Mailtrap...");
            await new Promise((resolve) => setTimeout(resolve, 11000));

            await transporter.sendMail(mailOptionsVenditore);
            console.log("Mail VENDITORE inviata.");
          } catch (mailErr) {
            console.error("ERRORE SMTP:", mailErr.message);
          }
        });
      });
    });
  });
}

/* store chat */
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
Ti chiami "Aeterna bot", commesso esperto di Aeterna. 
L'estinzione è un ricordo del passato: cloniamo ogni specie nel catalogo tramite bio-ingegneria avanzata.

### REGOLE OBBLIGATORIE
1. LINGUA: Rispondi esclusivamente in italiano.
2. FORMATO: Rispondi SEMPRE E SOLO con un oggetto JSON puro. Non includere blocchi di codice markdown.
3. NO SALUTI: L'utente ha già ricevuto il messaggio di benvenuto. NON salutare (no "Ciao", "Benvenuto", "Buongiorno") e non presentarti. Vai dritto al punto della richiesta.
4. BRANDING: Se devi citare l'azienda, usa solo "Aeterna". Mai "Aeterna Dynamics".
5. REALTÀ ESTERNE: È vietato citare Amazon, Etsy o altri competitor.
6. quando dai il prezzo di un prodotto usa sempre la valuta in euro.
### STRUTTURA JSON RICHIESTA:
{
  "testo_risposta": "Il tuo messaggio di vendita o assistenza senza saluti iniziali"
}

### CATALOGO PRODOTTI:
${string}

### ISTRUZIONE FINALE:
Rispondi alla richiesta dell'utente in modo professionale e diretto, agendo come un terminale di vendita avanzato. Genera ora il JSON.
`;

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
