export const config = { maxDuration: 60 };

async function fetchProductData(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow'
    });
    const html = await res.text();
    
    // Try JSON-LD
    const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1]);
        const product = Array.isArray(data) ? data.find(d => d['@type'] === 'Product') : (data['@type'] === 'Product' ? data : null);
        if (product) {
          const price = product.offers?.price || product.offers?.[0]?.price;
          return {
            url,
            name: product.name,
            price: price ? parseFloat(price).toLocaleString('es-AR') : null,
            image: Array.isArray(product.image) ? product.image[0] : product.image,
            description: (product.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 250),
          };
        }
      } catch(e) {}
    }
    
    // Fallback meta tags
    const og = (prop) => html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`))?.[1] ||
                          html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${prop}"`))?.[1];
    const name = og('og:title') || html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim();
    const image = og('og:image');
    const price = html.match(/itemprop="price"[^>]+content="([^"]+)"/)?.[1] ||
                  html.match(/"price"\s*:\s*"?([\d.]+)"?/)?.[1];
    const desc = og('og:description') || html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/)?.[1];
    
    return { 
      url, 
      name: name?.replace(/\s+/g, ' ').trim(),
      price: price ? parseFloat(price).toLocaleString('es-AR') : null,
      image, 
      description: desc?.slice(0, 250)
    };
  } catch(e) {
    console.error('fetchProductData error:', e.message);
    return { url, error: e.message };
  }
}

async function findProductBySkU(sku) {
  try {
    const res = await fetch(`https://vinotecaligier.com/catalogsearch/result/?q=${sku}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const urlMatch = html.match(/href="(https:\/\/vinotecaligier\.com\/[a-z0-9\-]+\.html)"/);
    return urlMatch ? urlMatch[1] : null;
  } catch(e) { return null; }
}

async function getCartTotal(cartUrl) {
  try {
    const res = await fetch(cartUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    const html = await res.text();
    // Look for subtotal or grand total
    const total = html.match(/(?:subtotal|total)[^$]*\$([\d.,]+)/i)?.[1] ||
                  html.match(/\$([\d]{2,3}(?:\.\d{3})+)/g)?.pop();
    return total ? `$${total}` : null;
  } catch(e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, seleccion, carrito, urls, rango, dia, hora, notas } = req.body;
  const mes = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  try {
    // ── Step 1: Resolve product URLs ──
    let productUrls = [];
    let cartLink = carrito?.trim();

    if (seleccion === 'carrito' && cartLink) {
      const base64 = cartLink.split('/data/')[1]?.replace(/\/$/, '');
      if (base64) {
        try {
          const skus = JSON.parse(Buffer.from(base64, 'base64').toString());
          console.log('SKUs decoded:', skus);
          const urlPromises = skus.map(s => findProductBySkU(s.sku));
          const found = await Promise.all(urlPromises);
          productUrls = found.filter(Boolean);
          console.log('Product URLs found:', productUrls);
        } catch(e) {
          console.error('Cart decode error:', e.message);
        }
      }
    } else if (seleccion === 'urls' && urls) {
      productUrls = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http')).slice(0, 6);
    }

    // ── Step 2: Fetch product details ──
    let productsData = [];
    if (productUrls.length > 0) {
      productsData = await Promise.all(productUrls.slice(0, 6).map(fetchProductData));
      console.log('Products fetched:', productsData.map(p => p.name));
    }

    // ── Step 3: Get cart total (2 attempts) ──
    let cartTotal = null;
    if (cartLink) {
      cartTotal = await getCartTotal(cartLink);
      if (!cartTotal) cartTotal = await getCartTotal(cartLink);
    }

    // ── Step 4: Build Claude prompt ──
    const productsSection = productsData.length > 0
      ? productsData.map((p, i) => `PRODUCTO ${i+1}:
  Nombre: ${p.name || 'N/D'}
  URL: ${p.url}
  Precio: ${p.price ? '$' + p.price : 'consultar sitio'}
  Imagen: ${p.image || 'no disponible'}
  Descripción: ${p.description || 'ver sitio'}`).join('\n\n')
      : `Seleccioná 6 productos de https://vinotecaligier.com/${tipo} verificando stock e imagen.`;

    const systemPrompt = `Sos un experto en HTML para emails de Mailchimp. Generás emails HTML completos y perfectos para la marca Vinoteca Ligier.

ESTRUCTURA OBLIGATORIA (9 secciones en orden):
1. HEADER: bg #fff, logo 140px centrado, link a vinotecaligier.com
   Logo URL: https://mcusercontent.com/9e298a0f4024c9f23fd6646af/images/3dc5a20a-d835-346a-d331-56796a1934b6.png
2. HERO: bg #1a1a1a, eyebrow uppercase #666, H1 máx 3 líneas × 6 palabras sin punto sin promo, bajada #aaa, botón blanco
3. PROMO BANNER: bg #1a1a1a exterior, caja #fff interior, 2 cols: texto izq (PROMOCIÓN ACTIVA + Llevá 6 pagá 5 + descripción) + botón APROVECHAR #111 der
4. PRODUCTOS: bg #fff, exactamente 6 productos, cada uno: imagen 140px + label cepa·región·provincia + nombre + descripción 2 líneas + precio tachado pequeño gris + precio promo grande negro (precio×5/6) + "C/U COMPRANDO 6" label + botón COMPRAR #111
5. BOTÓN PACK: bg #fff centrado, botón "LLEVÁ EL PACK COMPLETO · 6 BOTELLAS" #111 + total real del carrito debajo
6. ACCESORIO: bg #f4f1ec, 1 producto cristalería/accesorios afín, botón outline border #111
7. CTA: bg #fff centrado, "TODA LA SELECCIÓN" label + título + botón #111
8. CATEGORÍAS: bg #1a1a1a, pills border #333 color #ccc: Vinos/Guardados/Espumantes/Whisky/Espirituosas/Regalos/Gift Cards/Wine Club/Experiencias/Ofertas — con white-space:nowrap OBLIGATORIO
9. CONTACTO+FOOTER: bg #fff, 2 cols (wa+tel+ig izq, email+dir+horarios der), footer con tagline y *|UNSUB|*

ÍCONOS DE CONTACTO (usar estas URLs exactas):
- WA: https://mcusercontent.com/14b7b2be6d99dcac6ed81f35c/images/5660aedf-265a-c31e-44e8-721cc53da96f.png
- TEL: https://mcusercontent.com/14b7b2be6d99dcac6ed81f35c/images/f346b0f0-d6be-eac4-b520-541808d693dc.png
- IG: https://mcusercontent.com/14b7b2be6d99dcac6ed81f35c/images/4f18a0b0-eb4d-9ed9-9c1a-bcaf9dd32a1c.png

COLORES: #1a1a1a (hero/cats), #111 (texto/botones), #fff (secciones claras), #f4f1ec (fondo/accesorio), #888 (secundario), #aaa (labels)
TIPOGRAFÍA: solo Arial, sin border-radius, sin sombras, sin gradientes
RESPONSIVE: @media max-width:480px con todas las clases mobile
LINKS: WA → wa.me/5491170546060, TEL → tel:+541120401252, IG @ligier → instagram.com/ligier, IG @vinosguardados → instagram.com/vinosguardados

TONO DEL HERO: curador que informa, no vendedor. Ligier habla con autoridad. Sin exclamaciones, sin superlativos.

Devolvé ÚNICAMENTE el HTML completo empezando con <!DOCTYPE html>. Nada más.`;

    const userPrompt = `Generá el email completo para Ligier:

TIPO: ${tipo}
MES: ${mes}
${rango ? `RANGO: $${rango}` : ''}
${notas ? `NOTAS: ${notas}` : ''}
LINK CARRITO: ${cartLink || 'no disponible'}
TOTAL 6x5 DEL CARRITO: ${cartTotal || 'calcular como precio_mas_barato × 5 + resto a precio normal'}

${productsSection}

ACCESORIO: elegí 1 producto afín de cristalería para tintos (copa Cabernet/Burgundy) o el accesorio más apropiado para el tipo de vinos seleccionados. Buscá en https://vinotecaligier.com/cristaleria

Instrucciones adicionales:
- El H1 debe tener máximo 3 líneas, máximo 6 palabras por línea, sin punto final, sin mencionar precio ni promo
- Los pills de categorías DEBEN tener white-space:nowrap para no romper las palabras en mobile
- El precio de cada producto: mostrar precio tachado arriba (gris, pequeño) y precio promo abajo (negro, 22px bold) calculado como precio × 5/6 redondeado, con label "C/U COMPRANDO 6"
- Sin logo en el footer`;

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
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const claudeData = await claudeRes.json();
    console.log('Claude response type:', claudeData.content?.[0]?.type);
    
    let emailHtml = claudeData.content?.[0]?.text || '';
    
    // Clean up if Claude added markdown
    emailHtml = emailHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
    
    if (!emailHtml.includes('<!DOCTYPE') && !emailHtml.includes('<html')) {
      console.error('Invalid HTML:', emailHtml.slice(0, 200));
      return res.status(500).json({ 
        error: 'Claude no generó HTML válido', 
        detail: claudeData.error || emailHtml.slice(0, 300) 
      });
    }

    // ── Step 5: Mailchimp ──
    const mcKey = process.env.MAILCHIMP_API_KEY;
    const dc = mcKey.split('-').pop();
    const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
    const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
    const mcAuth = 'Basic ' + Buffer.from(`anystring:${mcKey}`).toString('base64');
    const mcHeaders = { 'Authorization': mcAuth, 'Content-Type': 'application/json' };

    const campaignTitle = `Ligier · ${tipo} · ${dia} ${mes}`;
    const subjectLine = `${tipo === 'vinos' ? '🍷' : tipo === 'whisky' ? '🥃' : '✨'} Nueva selección ${mes} — Ligier`;

    const createRes = await fetch(`${mcBase}/campaigns`, {
      method: 'POST',
      headers: mcHeaders,
      body: JSON.stringify({
        type: 'regular',
        recipients: { list_id: audienceId },
        settings: {
          subject_line: subjectLine,
          from_name: 'Ligier',
          reply_to: 'ventas@ligier.com.ar',
          title: campaignTitle
        }
      })
    });

    const campaign = await createRes.json();
    if (!campaign.id) {
      return res.status(500).json({ error: 'Error creando campaña en Mailchimp', detail: JSON.stringify(campaign) });
    }

    // Set content
    const contentRes = await fetch(`${mcBase}/campaigns/${campaign.id}/content`, {
      method: 'PUT',
      headers: mcHeaders,
      body: JSON.stringify({ html: emailHtml })
    });
    const contentData = await contentRes.json();
    console.log('Content set:', contentData.status || 'ok');

    // Send test
    await fetch(`${mcBase}/campaigns/${campaign.id}/actions/test`, {
      method: 'POST',
      headers: mcHeaders,
      body: JSON.stringify({ test_emails: ['dayanmartin@gmail.com'], send_type: 'html' })
    });

    // Schedule
    const diasMap = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 0 };
    const today = new Date();
    const targetDay = diasMap[dia] ?? 3;
    const currentDay = today.getDay();
    let daysUntil = (targetDay - currentDay + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    const sendDate = new Date(today);
    sendDate.setDate(today.getDate() + daysUntil);
    const [h, m] = hora.split(':');
    sendDate.setHours(parseInt(h), parseInt(m), 0, 0);
    // Convert Argentina (GMT-3) to UTC
    const utcDate = new Date(sendDate.getTime() + 3 * 60 * 60 * 1000);
    const scheduleTime = utcDate.toISOString().replace('.000Z', '+00:00');

    const schedRes = await fetch(`${mcBase}/campaigns/${campaign.id}/actions/schedule`, {
      method: 'POST',
      headers: mcHeaders,
      body: JSON.stringify({ schedule_time: scheduleTime })
    });
    const schedData = await schedRes.json();
    console.log('Schedule result:', schedData.status || schedData.title || 'ok');

    return res.status(200).json({
      success: true,
      campaignId: campaign.id,
      campaignName: campaignTitle,
      scheduleTime: scheduleTime,
      webId: campaign.web_id,
      mailchimpUrl: `https://mc.us1.mailchimp.com/campaigns/show?id=${campaign.web_id}`
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 300) });
  }
}
