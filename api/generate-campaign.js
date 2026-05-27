export const config = { maxDuration: 60 };

const GUIDELINES = `
Sos el generador de emails de Vinoteca Ligier. Generás HTML completo para campañas de Mailchimp.

REGLAS ABSOLUTAS:
- Estructura fija de 9 secciones: Header → Hero → Promo Banner → Productos → Botón Pack → Accesorio → CTA → Categorías → Contacto+Footer
- Solo Arial, sin border-radius, sin sombras, sin gradientes
- Logo 140px: https://mcusercontent.com/9e298a0f4024c9f23fd6646af/images/3dc5a20a-d835-346a-d331-56796a1934b6.png
- Colores: #1a1a1a (hero/cats), #111 (texto/botones), #fff (secciones claras), #f4f1ec (fondo/accesorio), #888 (secundario), #aaa (labels)
- Exactamente 6 productos
- Precio: tachado original → grande promo (precio×5/6) → label "C/U COMPRANDO 6"
- Promo banner: 2 columnas — texto izq + botón APROVECHAR der
- Botón pack: "LLEVÁ EL PACK COMPLETO · 6 BOTELLAS" + total real del carrito
- 10 categorías fijas en negro: Vinos/Guardados/Espumantes/Whisky/Espirituosas/Regalos/Gift Cards/Wine Club/Experiencias/Ofertas
- Íconos mcusercontent: WA=5660aedf, TEL=f346b0f0, IG=4f18a0b0 (base: https://mcusercontent.com/14b7b2be6d99dcac6ed81f35c/images/{id}-*.png)
- Responsive con @media max-width:480px — pills con white-space:nowrap
- *|UNSUB|* en footer, sin logo en footer
- H1: máx 3 líneas × 6 palabras, sin punto, sin precio, tono curador
`;

async function fetchProductData(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    
    // Try JSON-LD first
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        const data = JSON.parse(jsonLdMatch[1]);
        const product = Array.isArray(data) ? data.find(d => d['@type'] === 'Product') : data;
        if (product) {
          return {
            url,
            name: product.name,
            price: product.offers?.price || product.offers?.[0]?.price,
            image: Array.isArray(product.image) ? product.image[0] : product.image,
            description: product.description?.replace(/<[^>]+>/g, '').slice(0, 200),
          };
        }
      } catch(e) {}
    }
    
    // Fallback: meta tags
    const title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    const price = html.match(/itemprop="price" content="([^"]+)"/)?.[1] ||
                  html.match(/"price":"([^"]+)"/)?.[1];
    const desc = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    
    return { url, name: title, price, image, description: desc };
  } catch(e) {
    return { url, error: e.message };
  }
}

async function findProductBySkU(sku) {
  try {
    const res = await fetch(`https://vinotecaligier.com/catalogsearch/result/?q=${sku}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const urlMatch = html.match(/href="(https:\/\/vinotecaligier\.com\/[^"]+\.html)"/);
    return urlMatch ? urlMatch[1] : null;
  } catch(e) { return null; }
}

async function getCartTotal(cartUrl) {
  try {
    const res = await fetch(cartUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const total = html.match(/\$[\d\.]+/g);
    return total ? total[total.length - 1] : null;
  } catch(e) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, seleccion, carrito, urls, rango, dia, hora, notas } = req.body;

  try {
    // ── Step 1: Get product URLs ──
    let productUrls = [];
    let cartLink = carrito;

    if (seleccion === 'carrito' && carrito) {
      const base64 = carrito.split('/data/')[1]?.replace(/\/$/, '');
      if (base64) {
        const skus = JSON.parse(Buffer.from(base64, 'base64').toString());
        const urlPromises = skus.map(s => findProductBySkU(s.sku));
        const found = await Promise.all(urlPromises);
        productUrls = found.filter(Boolean);
      }
    } else if (seleccion === 'urls' && urls) {
      productUrls = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    }

    if (productUrls.length < 6 && seleccion !== 'auto') {
      return res.status(400).json({ error: `Solo se encontraron ${productUrls.length} productos. Necesitamos 6.` });
    }

    // ── Step 2: Fetch product details ──
    let productsData = [];
    if (productUrls.length > 0) {
      productsData = await Promise.all(productUrls.slice(0, 6).map(fetchProductData));
    }

    // ── Step 3: Get cart total ──
    let cartTotal = null;
    if (cartLink) {
      cartTotal = await getCartTotal(cartLink);
      // Try a second time to confirm
      if (!cartTotal) cartTotal = await getCartTotal(cartLink);
    }

    // ── Step 4: Call Claude API ──
    const mes = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    
    const userMessage = `Generá el HTML completo de un email para Ligier con estos datos:

TIPO: ${tipo}
MES: ${mes}
${rango ? `RANGO PRECIO: $${rango}` : ''}
${notas ? `NOTAS: ${notas}` : ''}
${cartLink ? `LINK CARRITO: ${cartLink}` : ''}
${cartTotal ? `TOTAL CARRITO 6x5: ${cartTotal}` : ''}

PRODUCTOS:
${productsData.length > 0 ? productsData.map((p, i) => `
${i+1}. ${p.name || 'Producto ' + (i+1)}
   URL: ${p.url}
   Precio: ${p.price ? '$' + parseFloat(p.price).toLocaleString('es-AR') : 'ver sitio'}
   Imagen: ${p.image || ''}
   Descripción: ${p.description || ''}
`).join('\n') : 'Seleccioná 6 productos de https://vinotecaligier.com/' + tipo + ' verificando stock e imagen.'}

Devolvé ÚNICAMENTE el HTML completo, sin explicaciones, sin markdown, sin backticks. Solo el DOCTYPE y el HTML.`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: GUIDELINES,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const claudeData = await claudeRes.json();
    const emailHtml = claudeData.content?.[0]?.text;

    if (!emailHtml || !emailHtml.includes('<!DOCTYPE')) {
      return res.status(500).json({ error: 'Claude no generó HTML válido', detail: claudeData });
    }

    // ── Step 5: Create Mailchimp campaign ──
    const mcKey = process.env.MAILCHIMP_API_KEY;
    const dc = mcKey.split('-')[1];
    const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
    const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
    const mcAuth = Buffer.from(`anystring:${mcKey}`).toString('base64');
    const mcHeaders = { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' };

    const campaignName = `Ligier · ${tipo} · ${dia} ${mes}`;

    const createRes = await fetch(`${mcBase}/campaigns`, {
      method: 'POST',
      headers: mcHeaders,
      body: JSON.stringify({
        type: 'regular',
        recipients: { list_id: audienceId },
        settings: {
          subject_line: campaignName,
          from_name: 'Ligier',
          reply_to: 'ventas@ligier.com.ar',
          title: campaignName
        }
      })
    });

    const campaign = await createRes.json();
    if (!campaign.id) return res.status(500).json({ error: 'Error creando campaña en Mailchimp', detail: campaign });

    // ── Step 6: Set campaign content ──
    await fetch(`${mcBase}/campaigns/${campaign.id}/content`, {
      method: 'PUT',
      headers: mcHeaders,
      body: JSON.stringify({ html: emailHtml })
    });

    // ── Step 7: Send test email ──
    await fetch(`${mcBase}/campaigns/${campaign.id}/actions/test`, {
      method: 'POST',
      headers: mcHeaders,
      body: JSON.stringify({ test_emails: ['dayanmartin@gmail.com'], send_type: 'html' })
    });

    // ── Step 8: Schedule campaign ──
    const diasMap = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6 };
    const today = new Date();
    const targetDay = diasMap[dia] || 3;
    const currentDay = today.getDay() || 7;
    const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
    const sendDate = new Date(today);
    sendDate.setDate(today.getDate() + daysUntil);
    const [h, m] = hora.split(':');
    sendDate.setUTCHours(parseInt(h) + 3, parseInt(m), 0, 0); // GMT-3 to UTC
    const scheduleTime = sendDate.toISOString().replace('.000Z', '+00:00');

    await fetch(`${mcBase}/campaigns/${campaign.id}/actions/schedule`, {
      method: 'POST',
      headers: mcHeaders,
      body: JSON.stringify({ schedule_time: scheduleTime })
    });

    return res.status(200).json({
      success: true,
      campaignId: campaign.id,
      campaignName,
      scheduleTime,
      mailchimpUrl: `https://us1.admin.mailchimp.com/campaigns/show?id=${campaign.web_id}`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
