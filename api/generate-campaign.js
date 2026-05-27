export const config = { maxDuration: 60 };


async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch(e) {
    clearTimeout(id);
    throw e;
  }
}

const TEMPLATES = {
  'vinos':        'base-email-vinos.html',
  'whisky':       'base-email-whisky.html',
  'espirituosas': 'base-email-vinos.html',
  'vinos-guardados': 'base-email-guardados.html',
  'wine-club':    'base-email-vinos.html',
  'experiencias': 'base-email-vinos.html',
  'gift-cards':   'base-email-vinos.html',
};

const GITHUB_RAW = 'https://raw.githubusercontent.com/mdd145-prog/mailchimp/main/templates/';
const GUIDELINES_URL = 'https://raw.githubusercontent.com/mdd145-prog/mailchimp/main/guidelines/ligier-email-guidelines.md';

async function fetchTemplate(tipo) {
  const file = TEMPLATES[tipo] || 'base-email-vinos.html';
  const res = await fetch(GITHUB_RAW + file);
  if (!res.ok) throw new Error(`No se pudo cargar el template: ${file}`);
  return res.text();
}

async function fetchGuidelines() {
  try {
    const res = await fetch(GUIDELINES_URL);
    return res.ok ? res.text() : '';
  } catch(e) { return ''; }
}

async function fetchProductData(url) {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    }, 6000);
    const html = await res.text();
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
    const og = (prop) => html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`))?.[1];
    const name = og('og:title') || html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim();
    const image = og('og:image');
    const price = html.match(/itemprop="price"[^>]+content="([^"]+)"/)?.[1] ||
                  html.match(/"price"\s*:\s*"?([\d.]+)"?/)?.[1];
    const desc = og('og:description');
    return {
      url,
      name: name?.replace(/\s+/g, ' ').trim(),
      price: price ? parseFloat(price).toLocaleString('es-AR') : null,
      image,
      description: desc?.slice(0, 250)
    };
  } catch(e) {
    return { url, error: e.message };
  }
}

async function findProductBySku(sku) {
  try {
    const res = await fetch(`https://vinotecaligier.com/catalogsearch/result/?q=${sku}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const urlMatch = html.match(/href="(https:\/\/vinotecaligier\.com\/[a-z0-9\-]+\.html)"/);
    return urlMatch ? urlMatch[1] : null;
  } catch(e) { return null; }
}

async function getCartTotal(cartUrl) {
  try {
    const res = await fetch(cartUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const totals = html.match(/\$[\d]{2,3}(?:\.[\d]{3})+/g);
    return totals ? totals[totals.length - 1] : null;
  } catch(e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, seleccion, carrito, urls, rango, dia, hora, notas } = req.body;
  const mes = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  try {
    // ── Step 1: Load template + guidelines from GitHub ──
    const [baseTemplate, guidelines] = await Promise.all([
      fetchTemplate(tipo),
      fetchGuidelines()
    ]);

    // ── Step 2: Resolve product URLs ──
    let productUrls = [];
    let cartLink = carrito?.trim();

    if (seleccion === 'carrito' && cartLink) {
      const base64 = cartLink.split('/data/')[1]?.replace(/\/$/, '');
      if (base64) {
        try {
          const skus = JSON.parse(Buffer.from(base64, 'base64').toString());
          const found = await Promise.all(skus.map(s => findProductBySku(s.sku)));
          productUrls = found.filter(Boolean);
        } catch(e) { console.error('Cart decode:', e.message); }
      }
    } else if (seleccion === 'urls' && urls) {
      productUrls = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http')).slice(0, 10);
    }

    // ── Step 3: Fetch product details ──
    let productsData = [];
    if (productUrls.length > 0) {
      productsData = await Promise.all(productUrls.map(fetchProductData));
    }

    // ── Step 4: Get cart total ──
    let cartTotal = null;
    if (cartLink) {
      cartTotal = await getCartTotal(cartLink);
      if (!cartTotal) cartTotal = await getCartTotal(cartLink);
    }

    // ── Step 5: Build Claude prompt ──
    const productsSection = productsData.length > 0
      ? productsData.map((p, i) => `PRODUCTO ${i+1}:\n  Nombre: ${p.name || 'N/D'}\n  URL: ${p.url}\n  Precio: ${p.price ? '$' + p.price : 'ver sitio'}\n  Imagen: ${p.image || ''}\n  Descripción: ${p.description || ''}`).join('\n\n')
      : `Tipo: ${tipo}${rango ? ', rango $' + rango : ''}. Seleccioná productos navegando https://vinotecaligier.com/${tipo}`;

    const systemPrompt = `Sos el generador de emails de Vinoteca Ligier.
Se te da un template HTML aprobado y datos de productos/campaña.
Tu tarea es MODIFICAR el template reemplazando ÚNICAMENTE el contenido variable.
NO cambies ningún CSS, NO cambies la estructura de tablas, NO cambies las clases mobile.
Solo modificá: título del email, eyebrow, H1, bajada del hero, los bloques de producto, links del carrito, total del pack y el accesorio.
Devolvé ÚNICAMENTE el HTML completo empezando con <!DOCTYPE. Sin explicaciones, sin markdown, sin backticks.`;

    const userPrompt = `Usá este template base y reemplazá el contenido con los datos de esta campaña:

TIPO: ${tipo}
MES: ${mes}
${rango ? `RANGO: $${rango}` : ''}
${notas ? `NOTAS: ${notas}` : ''}
LINK CARRITO: ${cartLink || 'generar con los SKUs de los productos'}
TOTAL 6x5 DEL CARRITO: ${cartTotal || 'obtener navegando el link del carrito'}

PRODUCTOS:
${productsSection}

INSTRUCCIONES:
- Eyebrow: "${tipo.toUpperCase().replace('-', ' ')} · ${mes.toUpperCase()}"
- H1: máx 3 líneas × 6 palabras, sin punto, tono curador de Ligier, sin mencionar precio ni promo
- Bajada: mencioná origen/características + promo si aplica
- Precio por producto: mostrar precio original tachado (gris pequeño) + precio 6x5 grande negro (precio×5/6) + label "C/U COMPRANDO 6" — EXCEPTO en whisky, guardados, experiencias, wine-club (solo precio individual limpio)
- Links del carrito: actualizá ambas apariciones (promo banner + botón pack) con el link real
- Accesorio: elegí 1 producto afín de /cristaleria o /accesorios según el tipo de bebida

TEMPLATE BASE:
${baseTemplate}`;

    // ── Step 6: Call Claude API ──
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20251001',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const claudeData = await claudeRes.json();
    let emailHtml = claudeData.content?.[0]?.text || '';
    emailHtml = emailHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();

    if (!emailHtml.includes('<!DOCTYPE') && !emailHtml.includes('<html')) {
      return res.status(500).json({
        error: 'Claude no generó HTML válido',
        detail: claudeData.error?.message || emailHtml.slice(0, 300)
      });
    }

    // ── Step 7: Create Mailchimp campaign ──
    const mcKey = process.env.MAILCHIMP_API_KEY;
    const dc = mcKey.split('-').pop();
    const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
    const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
    const mcAuth = 'Basic ' + Buffer.from(`anystring:${mcKey}`).toString('base64');
    const mcHeaders = { 'Authorization': mcAuth, 'Content-Type': 'application/json' };

    const campaignTitle = `Ligier · ${tipo} · ${dia} ${mes}`;

    const createRes = await fetch(`${mcBase}/campaigns`, {
      method: 'POST', headers: mcHeaders,
      body: JSON.stringify({
        type: 'regular',
        recipients: { list_id: audienceId },
        settings: {
          subject_line: `Nueva selección ${mes} — Ligier`,
          from_name: 'Ligier',
          reply_to: 'ventas@ligier.com.ar',
          title: campaignTitle
        }
      })
    });

    const campaign = await createRes.json();
    if (!campaign.id) return res.status(500).json({ error: 'Error Mailchimp', detail: JSON.stringify(campaign) });

    await fetch(`${mcBase}/campaigns/${campaign.id}/content`, {
      method: 'PUT', headers: mcHeaders,
      body: JSON.stringify({ html: emailHtml })
    });

    await fetch(`${mcBase}/campaigns/${campaign.id}/actions/test`, {
      method: 'POST', headers: mcHeaders,
      body: JSON.stringify({ test_emails: ['dayanmartin@gmail.com'], send_type: 'html' })
    });

    const diasMap = { Lunes:1, Martes:2, Miércoles:3, Jueves:4, Viernes:5, Sábado:6, Domingo:0 };
    const today = new Date();
    const targetDay = diasMap[dia] ?? 3;
    let daysUntil = (targetDay - today.getDay() + 7) % 7 || 7;
    const sendDate = new Date(today);
    sendDate.setDate(today.getDate() + daysUntil);
    const [h, m] = hora.split(':');
    sendDate.setHours(parseInt(h), parseInt(m), 0, 0);
    const utcDate = new Date(sendDate.getTime() + 3 * 60 * 60 * 1000);
    const scheduleTime = utcDate.toISOString().replace('.000Z', '+00:00');

    await fetch(`${mcBase}/campaigns/${campaign.id}/actions/schedule`, {
      method: 'POST', headers: mcHeaders,
      body: JSON.stringify({ schedule_time: scheduleTime })
    });

    return res.status(200).json({
      success: true,
      campaignId: campaign.id,
      campaignName: campaignTitle,
      scheduleTime,
      webId: campaign.web_id,
      mailchimpUrl: `https://mc.us1.mailchimp.com/campaigns/show?id=${campaign.web_id}`
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
