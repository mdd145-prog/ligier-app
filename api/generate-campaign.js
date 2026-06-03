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
    return await parseMagentoProduct(data);
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
    return item ? await parseMagentoProduct(item) : null;
  } catch(e) { return null; }
}

// Los atributos de tipo dropdown de Magento (variedad, país, etc.) vienen en la API
// como ID de opción (un número), no como texto. Esto resuelve ID → label, con cache.
const _optionCache = {};
async function resolveOption(code, value) {
  if (value == null || value === '') return null;
  // Si ya es texto (no numérico), usarlo tal cual
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return value.trim();
  try {
    if (!_optionCache[code]) {
      const res = await fetchWithTimeout(
        `${MAGENTO_BASE}/rest/V1/products/attributes/${code}/options`,
        { headers: { 'Authorization': `Bearer ${MAGENTO_TOKEN}` } }, 6000
      );
      _optionCache[code] = res.ok ? await res.json() : [];
    }
    const opt = _optionCache[code].find(o => String(o.value) === String(value));
    const label = opt?.label?.trim();
    return label && label !== '0' ? label : null;
  } catch(e) { return null; }
}

// Cepas más comunes para detectar la variedad desde el nombre como último recurso
const CEPAS = ['Malbec','Cabernet Franc','Cabernet Sauvignon','Cabernet','Merlot','Bonarda',
  'Syrah','Petit Verdot','Tannat','Pinot Noir','Tempranillo','Sangiovese','Blend','Corte',
  'Chardonnay','Sauvignon Blanc','Torrontés','Torrontes','Semillón','Semillon','Viognier',
  'Riesling','Pinot Grigio','Gewürztraminer','Chenin','Rosé','Rosado'];
function cepaFromName(name = '') {
  return CEPAS.find(c => new RegExp(`\\b${c}\\b`, 'i').test(name)) || null;
}

const COUNTRY_CODES = { AR: 'Argentina', CL: 'Chile', FR: 'Francia', IT: 'Italia',
  ES: 'España', US: 'Estados Unidos', UY: 'Uruguay', PT: 'Portugal', NZ: 'Nueva Zelanda' };

async function parseMagentoProduct(data) {
  const price = data.price;
  const mediaEntries = data.media_gallery_entries || [];
  const mainImage = mediaEntries.find(e => e.types?.includes('image')) || mediaEntries[0];
  const image = mainImage ? `${MAGENTO_BASE}/media/catalog/product${mainImage.file}` : null;
  const attr = (code) => data.custom_attributes?.find(a => a.attribute_code === code)?.value;
  const shortDesc = attr('short_description') || attr('description') || '';
  const description = shortDesc.replace(/<[^>]+>/g, '').trim().slice(0, 200);
  const urlKey = attr('url_key');
  const productUrl = urlKey ? `${MAGENTO_BASE}/${urlKey}.html` : `${MAGENTO_BASE}/catalogsearch/result/?q=${data.sku}`;

  // Etiqueta del producto: variedad/cepa · región · país (o año en guardados).
  // Probamos varios códigos de atributo posibles y resolvemos los dropdowns.
  const attrAny = async (codes) => {
    for (const c of codes) {
      const raw = attr(c);
      if (raw != null && raw !== '' && raw !== '0') {
        const v = await resolveOption(c, raw);
        if (v && v !== '0') return v;
      }
    }
    return null;
  };
  let cepa = await attrAny(['variedad','cepa','varietal','uva']);
  if (!cepa) cepa = cepaFromName(data.name);
  const region = await attrAny(['region','provincia','zona','region_vitivinicola']);
  let pais = await attrAny(['pais_origen','pais_de_origen','pais','origen','country_of_manufacture']);
  if (pais && COUNTRY_CODES[pais.toUpperCase()]) pais = COUNTRY_CODES[pais.toUpperCase()];
  const bodega = await attrAny(['marca','bodega']);
  const anio = await attrAny(['ano','anio','add_year','year','vintage','cosecha']);

  return { sku: data.sku, name: data.name, price, image, description, url: productUrl,
    inStock: data.status === 1, cepa, region, pais, bodega, anio };
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

  // Etiqueta con datos reales de Magento. Guardados: cepa · región · año.
  // Resto: cepa · región · país. Se omiten los segmentos que no existen —
  // nunca se muestra un placeholder literal.
  const labelArr = isGuardados
    ? [product.cepa, product.region, product.anio]
    : [product.cepa, product.region, product.pais];
  let label = labelArr.filter(Boolean).join(' · ');
  if (!label) label = [product.cepa, product.bodega, product.pais].filter(Boolean).join(' · ');

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

  // 2b. Hero bajada (subtitle under H1)
  if (opts.bajada) {
    result = result.replace(/(<p[^>]*class="hero-bajada"[^>]*>)[\s\S]*?(<\/p>)/, `$1${opts.bajada}$2`);
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

  // 4. Accessory
  if (accessory) {
    // Replace image, name, description, price and links in the accessory section
    result = result.replace(
      /(<!-- ACC_START -->[\s\S]*?<img src=")[^"]*(")/,
      `$1${accessory.image || ''}$2`
    );
    // Replace accessory name (first product-name link inside ACC section)
    const accName = accessory.name || '';
    const accPrice = accessory.price ? '$' + parseFloat(accessory.price).toLocaleString('es-AR') : '';
    const accDesc = accessory.description || '';
    const accUrl = accessory.url || '#';
    // Rebuild the inner info block between ACC_START and ACC_END
    result = result.replace(
      /(<!-- ACC_START -->[\s\S]*?<td valign="middle">)[\s\S]*?(<\/td>\s*<\/tr>\s*<\/table>)/,
      `$1
            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">ACCESORIO</p>
            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;"><a href="${accUrl}" target="_blank" style="color:#111;">${accName}</a></p>
            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">${accDesc}</p>
            <p style="font-size:16px; font-weight:700; color:#111; margin:0 0 14px 0;">${accPrice}</p>
            <a href="${accUrl}" target="_blank" style="display:inline-block; background:transparent; border:1.5px solid #111111; color:#111111; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">VER PRODUCTO</a>
          $2`
    );
    // Fix accessory link in image too
    result = result.replace(
      /(<!-- ACC_START -->[\s\S]*?<a href=")[^"]*(" target="_blank">\s*<img)/,
      `$1${accUrl}$2`
    );
  } else {
    // No accessory chosen — remove the whole section
    result = result.replace(/<!-- ACC_START -->[\s\S]*?<!-- ACC_END -->/, '');
  }

  // 5. Cart links
  if (cartLink) {
    result = result.replace(/https:\/\/vinotecaligier\.com\/compartircarrito\/index\/share\/data\/[^"]+/g, cartLink);
  }

  // 6. Pack total — replace the value inside the pack-total paragraph
  if (cartTotal) {
    result = result.replace(/(<p[^>]*class="pack-total"[^>]*>)[\s\S]*?(<\/p>)/, `$1${cartTotal}$2`);
  }

  // 7. Preheader — replace the visible text inside the hidden preheader div,
  //    preservando los caracteres de relleno (entities) que evitan que Gmail
  //    arrastre texto del cuerpo al preview.
  if (opts.preheader) {
    result = result.replace(
      /(<div class="preheader"[^>]*>)[\s\S]*?(\s*(?:&#847;|&zwnj;|&nbsp;)[\s\S]*?<\/div>)/,
      `$1\n  ${opts.preheader}$2`
    );
  }

  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, seleccion, carrito, urls, dia, hora, titulo, bajada, subject, preheader, accesorio, accesorioUrl, modo, emailPrueba } = req.body;
  const mes = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  // Default bajada per type (used if user doesn't provide one)
  const BAJADAS = {
    'vinos': 'Una selección para descubrir esta semana.<br>Llevá 6, pagá 5.',
    'whisky': 'Destilados que elegimos uno por uno.',
    'espirituosas': 'Para armar tu barra con criterio.',
    'vinos-guardados': 'Botellas que el tiempo hizo únicas.',
  };
  const bajadaFinal = (bajada || BAJADAS[tipo] || '').replace(/\n/g, '<br>');

  // Default subject + preheader per type (fallback si el wizard no los manda).
  // El subject INFORMA (sin promo); la promo va en el preheader.
  const SUBJECTS = {
    'vinos': 'La selección de vinos de la semana',
    'whisky': 'Destilados con procedencia',
    'espirituosas': 'Para armar tu barra en serio',
    'vinos-guardados': 'Cosechas que ya no se consiguen',
    'wine-club': 'Vinos elegidos para vos, cada mes',
    'experiencias': 'Una velada curada por Ligier',
    'gift-cards': 'El regalo para quien sabe elegir',
  };
  const PREHEADERS = {
    'vinos': 'Elegimos uno por uno. Llevá 6, pagá 5.',
    'whisky': 'Destilados con procedencia. Elegidos uno por uno.',
    'espirituosas': 'Botellas con carácter para mezclar o tomar solas.',
    'vinos-guardados': 'Botellas que el tiempo hizo irrepetibles.',
    'wine-club': 'Cada mes, vinos que no encontrás. Cuatro membresías.',
    'experiencias': 'Maridajes, fecha y lugar. Cupos limitados.',
    'gift-cards': 'La elección queda en sus manos.',
  };
  const subjectFinal = (subject && subject.trim()) || SUBJECTS[tipo] || `Nueva selección ${mes} — Ligier`;
  const preheaderFinal = ((preheader && preheader.trim()) || PREHEADERS[tipo] || '').replace(/\n/g, ' ');

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

    // 5. Pack total (only for vinos) — calculated like Magento's 6x5 MIX promo:
    //    subtotal minus the cheapest bottle(s). For every 6 bottles, the cheapest is free.
    let cartTotal = null;
    if (tipo === 'vinos' && products.length >= 6) {
      const prices = products.map(p => parseFloat(p.price) || 0).sort((a, b) => a - b);
      const subtotal = prices.reduce((s, p) => s + p, 0);
      const freeBottles = Math.floor(products.length / 6);
      const discount = prices.slice(0, freeBottles).reduce((s, p) => s + p, 0);
      const total = Math.round(subtotal - discount);
      cartTotal = '$' + total.toLocaleString('es-AR');
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
    const emailHtml = injectIntoTemplate(baseTemplate, { products, accessory, cartLink, cartTotal, tipo, mes, titulo, bajada: bajadaFinal, preheader: preheaderFinal });
    if (!emailHtml.includes('<!DOCTYPE')) {
      return res.status(500).json({ error: 'Error generando el email' });
    }

    // Dry-run: devuelve el HTML y los atributos resueltos SIN tocar Mailchimp.
    // Sirve para previsualizar/validar sin crear borradores ni mandar emails.
    if (req.body.dryRun) {
      return res.status(200).json({
        success: true, dryRun: true,
        subject: subjectFinal, preheader: preheaderFinal, cartTotal,
        productsFound: products.length,
        products: products.map(p => ({ name: p.name, cepa: p.cepa, region: p.region, pais: p.pais, bodega: p.bodega, anio: p.anio, price: p.price })),
        htmlLength: emailHtml.length,
        html: emailHtml,
      });
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
        settings: { subject_line: subjectFinal, preview_text: preheaderFinal, from_name: 'Ligier', reply_to: 'ventas@ligier.com.ar', title: campaignTitle }
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
