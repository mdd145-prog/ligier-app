export const config = { maxDuration: 60 };

const GITHUB_RAW = 'https://raw.githubusercontent.com/mdd145-prog/mailchimp/main/templates/';

const TEMPLATES = {
  'vinos':           'base-email-vinos.html',
  'whisky':          'base-email-whisky.html',
  'espirituosas':    'base-email-whisky.html',
  'vinos-guardados': 'base-email-guardados.html',
  'wine-club':       'base-email-vinos.html',
  'experiencias':    'base-email-vinos.html',
  'gift-cards':      'base-email-vinos.html',
};

// Wine club membership url_keys for Magento lookup
const MEMBERSHIP_KEYS = {
  IMAGEN_SILVER:   'wine-club-silver',
  IMAGEN_GOLD:     'wine-club-gold',
  IMAGEN_PLATINUM: 'wine-club-platinum',
  IMAGEN_BLACK:    'wine-club-black-1',
};

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

const MAGENTO_BASE = process.env.MAGENTO_BASE_URL || 'https://vinotecaligier.com';
const MAGENTO_TOKEN = process.env.MAGENTO_ACCESS_TOKEN;

async function getMagentoProduct(sku) {
  try {
    const res = await fetchWithTimeout(
      `${MAGENTO_BASE}/rest/V1/products/${encodeURIComponent(sku)}`,
      { headers: { 'Authorization': `Bearer ${MAGENTO_TOKEN}`, 'Content-Type': 'application/json' } },
      8000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return parseMagentoProduct(data);
  } catch(e) {
    console.error('Magento product error', sku, e.message);
    return null;
  }
}

async function getMagentoProductByUrlKey(urlKey) {
  try {
    const url = `${MAGENTO_BASE}/rest/V1/products?searchCriteria[filterGroups][0][filters][0][field]=url_key&searchCriteria[filterGroups][0][filters][0][value]=${urlKey}&searchCriteria[pageSize]=1`;
    const res = await fetchWithTimeout(url, { headers: { 'Authorization': `Bearer ${MAGENTO_TOKEN}` } }, 6000);
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.items?.[0];
    return item ? parseMagentoProduct(item) : null;
  } catch(e) { return null; }
}

function parseMagentoProduct(data) {
  const price = data.price;
  const mediaEntries = data.media_gallery_entries || [];
  const mainImage = mediaEntries.find(e => e.types?.includes('image')) || mediaEntries[0];
  const image = mainImage ? `${MAGENTO_BASE}/media/catalog/product${mainImage.file}` : null;
  const attr = (code) => data.custom_attributes?.find(a => a.attribute_code === code)?.value;
  const shortDesc = attr('short_description') || attr('description') || '';
  const description = shortDesc.replace(/<[^>]+>/g, '').trim().slice(0, 200);
  const urlKey = attr('url_key');
  const productUrl = urlKey ? `${MAGENTO_BASE}/${urlKey}.html` : `${MAGENTO_BASE}/catalogsearch/result/?q=${data.sku}`;
  return { sku: data.sku, name: data.name, price, image, description, url: productUrl, inStock: data.status === 1 };
}

async function getCartTotal(cartUrl) {
  try {
    const res = await fetchWithTimeout(cartUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8000);
    const html = await res.text();
    const grandTotal = html.match(/class="grand totals"[\s\S]*?class="price"[^>]*>([^<]+)<\/span>/);
    if (grandTotal) return grandTotal[1].trim();
    const allPrices = html.match(/\$[\d]{2,3}(?:\.[\d]{3})+/g);
    return allPrices ? allPrices[allPrices.length - 1] : null;
  } catch(e) { return null; }
}

function buildProductBlock(product, index, isLast, showPromo, isGuardados) {
  const price = product.price ? parseFloat(product.price) : 0;
  const priceFormatted = price.toLocaleString('es-AR');

  const separator = isLast ? '' : `
        <tr><td colspan="2" style="padding-bottom:0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td height="1" bgcolor="#f0f0f0" style="font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr><td height="24" style="font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
        </td></tr>`;

  let priceBlock;
  if (showPromo) {
    const promoPrice = Math.round(price * 5 / 6).toLocaleString('es-AR');
    priceBlock = `
            <p style="font-size:12px; color:#aaa; text-decoration:line-through; margin:0 0 2px 0;">$${priceFormatted}</p>
            <p style="font-size:22px; font-weight:700; color:#111; line-height:1; margin:0 0 2px 0;">$${promoPrice}</p>
            <p style="font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin:0 0 10px 0;">c/u comprando 6</p>`;
  } else {
    priceBlock = `<p style="font-size:18px; font-weight:700; color:#111; margin:0 0 14px 0;">$${priceFormatted}</p>`;
  }

  const label = isGuardados ? '[CEPA] · [REGIÓN] · [AÑO COSECHA]' : '[CEPA] · [REGIÓN] · [PROVINCIA]';

  return `
      <!-- Producto ${index + 1} -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0;">
        <tr>
          <td class="prod-img-col" width="150" valign="middle" style="width:150px; padding-right:20px; padding-bottom:24px;">
            <a href="${product.url}" target="_blank">
              <img src="${product.image || ''}" alt="${product.name}" width="140" style="width:140px; height:auto; display:block;">
            </a>
          </td>
          <td valign="middle" style="padding-bottom:24px;">
            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">${label}</p>
            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;">
              <a href="${product.url}" target="_blank" style="color:#111;">${product.name}</a>
            </p>
            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">${product.description || ''}</p>
            ${priceBlock}
            <a href="${product.url}" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">COMPRAR</a>
          </td>
        </tr>${separator}
      </table>`;
}

function buildAccessoryBlock(acc) {
  return `
            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">ACCESORIO</p>
            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;">
              <a href="${acc.url}" target="_blank" style="color:#111;">${acc.name}</a>
            </p>
            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">${acc.description || ''}</p>
            <p style="font-size:16px; font-weight:700; color:#111; margin:0 0 12px 0;">$${acc.price ? parseFloat(acc.price).toLocaleString('es-AR') : ''}</p>
            <a href="${acc.url}" target="_blank" style="display:inline-block; background:transparent; border:1.5px solid #111; color:#111; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px; text-decoration:none;">VER PRODUCTO</a>`;
}

function injectIntoTemplate(template, opts) {
  const { products, accessory, cartLink, cartTotal, tipo, mes, titulo } = opts;
  let result = template;
  const showPromo = tipo === 'vinos';
  const isGuardados = tipo === 'vinos-guardados';

  // 1. Eyebrow
  const eyebrowText = isGuardados
    ? 'VINOS GUARDADOS · LIGIER'
    : `${tipo.toUpperCase().replace(/-/g, ' ')} · ${mes.toUpperCase()}`;
  result = result.replace(/(<p[^>]*color:#666[^>]*>)[^<]+(<\/p>)/, `$1${eyebrowText}$2`);
  result = result.replace(/(<p[^>]*rgba\(255,255,255,0\.5\)[^>]*>)[^<]+(<\/p>)/, `$1${eyebrowText}$2`);

  // 2. Hero H1
  if (titulo) {
    const titleHtml = titulo.replace(/\n/g, '<br>');
    result = result.replace(/(<h1[^>]*class="hero-h1"[^>]*>)[\s\S]*?(<\/h1>)/, `$1${titleHtml}$2`);
  }

  // 3. Products
  const prodStart = result.indexOf('<!-- Producto 1 -->');
  let prodEnd = result.indexOf('<!-- ── 4b.');
  if (prodEnd === -1) prodEnd = result.indexOf('<!-- ── 5.');
  if (prodEnd === -1) prodEnd = result.indexOf('<!-- ── WINE CLUB');
  if (prodEnd === -1) prodEnd = result.indexOf('<!-- ── CUOTAS');
  if (prodStart !== -1 && prodEnd !== -1) {
    const productsHtml = products.map((p, i) => buildProductBlock(p, i, i === products.length - 1, showPromo, isGuardados)).join('\n');
    result = result.substring(0, prodStart) + productsHtml + '\n    ' + result.substring(prodEnd);
  }

  // 4. Accessory (replace the accessory info block if accessory provided)
  if (accessory) {
    // Match accessory section content between label and button
    const accBlock = buildAccessoryBlock(accessory);
    // Replace image
    result = result.replace(
      /(<!-- ── 5\. ACCESORIO[\s\S]*?<img src=")[^"]*(")/,
      `$1${accessory.image || ''}$2`
    );
  }

  // 5. Cart links
  if (cartLink) {
    result = result.replace(/https:\/\/vinotecaligier\.com\/compartircarrito\/index\/share\/data\/[^"]+/g, cartLink);
  }

  // 6. Cart total
  if (cartTotal) {
    result = result.replace(/Total 6x5: \$[\d\.,]+/g, `Total 6x5: ${cartTotal}`);
  }

  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, seleccion, carrito, urls, dia, hora, titulo, accesorio, accesorioUrl, modo, emailPrueba } = req.body;
  const mes = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  try {
    // 1. Load template
    const templateFile = TEMPLATES[tipo] || 'base-email-vinos.html';
    const templateRes = await fetchWithTimeout(GITHUB_RAW + templateFile, {}, 8000);
    if (!templateRes.ok) throw new Error('No se pudo cargar el template');
    let baseTemplate = await templateRes.text();

    // 2. Get SKUs
    let skuList = [];
    let cartLink = carrito?.trim();
    if (seleccion === 'carrito' && cartLink) {
      const base64 = cartLink.split('/data/')[1]?.replace(/\/$/, '');
      if (base64) {
        try { skuList = JSON.parse(Buffer.from(base64, 'base64').toString()); } catch(e) {}
      }
    } else if (seleccion === 'urls' && urls) {
      // Extract url_keys from URLs
      const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
      const products = [];
      for (const u of urlList) {
        const urlKey = u.split('/').pop().replace('.html', '');
        const p = await getMagentoProductByUrlKey(urlKey);
        if (p) products.push(p);
      }
      if (products.length > 0) {
        // jump straight to building
        var directProducts = products;
      }
    }

    // 3. Get products from Magento
    let products = [];
    if (typeof directProducts !== 'undefined') {
      products = directProducts;
    } else if (skuList.length > 0) {
      const results = await Promise.all(skuList.map(s => getMagentoProduct(s.sku)));
      products = results.filter(p => p && p.inStock && p.image);
    }

    if (products.length === 0) {
      return res.status(400).json({ error: 'No se pudieron obtener los productos. Verificá el link del carrito o las URLs.' });
    }

    // 4. Get accessory (manual only)
    let accessory = null;
    if (accesorio === 'manual' && accesorioUrl) {
      const accKey = accesorioUrl.split('/').pop().replace('.html', '');
      accessory = await getMagentoProductByUrlKey(accKey);
    }

    // 5. Cart total (only for vinos)
    let cartTotal = null;
    if (tipo === 'vinos' && cartLink) {
      cartTotal = await getCartTotal(cartLink);
      if (!cartTotal) cartTotal = await getCartTotal(cartLink);
    }

    // 6. Membership images for guardados (from Magento)
    if (tipo === 'vinos-guardados') {
      for (const [placeholder, urlKey] of Object.entries(MEMBERSHIP_KEYS)) {
        const memProduct = await getMagentoProductByUrlKey(urlKey);
        const imgUrl = memProduct?.image || '';
        baseTemplate = baseTemplate.replace(new RegExp(placeholder, 'g'), imgUrl);
      }
    }

    // 7. Inject everything
    const emailHtml = injectIntoTemplate(baseTemplate, { products, accessory, cartLink, cartTotal, tipo, mes, titulo });
    if (!emailHtml.includes('<!DOCTYPE')) {
      return res.status(500).json({ error: 'Error generando el email' });
    }

    // 8. Mailchimp
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
        settings: { subject_line: `Nueva selección ${mes} — Ligier`, from_name: 'Ligier', reply_to: 'ventas@ligier.com.ar', title: campaignTitle }
      })
    });
    const campaign = await createRes.json();
    if (!campaign.id) return res.status(500).json({ error: 'Error Mailchimp', detail: JSON.stringify(campaign) });

    await fetch(`${mcBase}/campaigns/${campaign.id}/content`, {
      method: 'PUT', headers: mcHeaders, body: JSON.stringify({ html: emailHtml })
    });

    const testEmail = emailPrueba || 'dayanmartin@gmail.com';
    await fetch(`${mcBase}/campaigns/${campaign.id}/actions/test`, {
      method: 'POST', headers: mcHeaders,
      body: JSON.stringify({ test_emails: [testEmail], send_type: 'html' })
    });

    let scheduleTime = null;
    if (modo !== 'borrador') {
      const diasMap = { Lunes:1, Martes:2, Miércoles:3, Jueves:4, Viernes:5, Sábado:6, Domingo:0 };
      const today = new Date();
      const targetDay = diasMap[dia] ?? 3;
      let daysUntil = (targetDay - today.getDay() + 7) % 7 || 7;
      const sendDate = new Date(today);
      sendDate.setDate(today.getDate() + daysUntil);
      const [h, m] = (hora || '10:30').split(':');
      sendDate.setHours(parseInt(h), parseInt(m), 0, 0);
      const utcDate = new Date(sendDate.getTime() + 3 * 60 * 60 * 1000);
      scheduleTime = utcDate.toISOString().replace('.000Z', '+00:00');
      await fetch(`${mcBase}/campaigns/${campaign.id}/actions/schedule`, {
        method: 'POST', headers: mcHeaders, body: JSON.stringify({ schedule_time: scheduleTime })
      });
    }

    return res.status(200).json({
      success: true,
      campaignId: campaign.id,
      campaignName: campaignTitle,
      scheduleTime,
      isDraft: modo === 'borrador',
      testEmail,
      productsFound: products.length,
      webId: campaign.web_id,
      mailchimpUrl: `https://mc.us1.mailchimp.com/campaigns/show?id=${campaign.web_id}`
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
