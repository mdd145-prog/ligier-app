export const config = { maxDuration: 60 };

const GITHUB_RAW = 'https://raw.githubusercontent.com/mdd145-prog/Mailing/main/templates/';

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
  // En vez de adivinar el código exacto, escaneamos TODOS los atributos que
  // Magento ya devolvió en esta misma respuesta y matcheamos por patrón de
  // nombre. Así no hace falta una llamada extra para descubrir los códigos.
  const allAttrs = data.custom_attributes || [];
  const byPattern = async (re) => {
    const cand = allAttrs.find(a => re.test(a.attribute_code) && a.value != null && a.value !== '' && a.value !== '0');
    if (!cand) return null;
    const v = await resolveOption(cand.attribute_code, cand.value); // resuelve dropdowns (ID→label), con cache
    return v && v !== '0' ? v : null;
  };
  let cepa = await byPattern(/vari|cepa|uva|grape/i);
  if (!cepa) cepa = cepaFromName(data.name);
  const region = await byPattern(/region|provinc|zona|appellation|terru?o|valle/i);
  let pais = await byPattern(/pais|origen|country|nacionalidad/i);
  if (pais && COUNTRY_CODES[pais.toUpperCase()]) pais = COUNTRY_CODES[pais.toUpperCase()];
  const bodega = await byPattern(/marca|bodega|brand|fabric|winery/i);
  const anio = await byPattern(/(^|_)an?io?($|_)|year|cosech|vintage|añ/i);

  // Debug: códigos+valores crudos de los atributos (para descubrir los códigos reales)
  const _attrs = (data.custom_attributes || []).map(a => ({ code: a.attribute_code, value: a.value }));

  return { sku: data.sku, name: data.name, price, image, description, url: productUrl,
    inStock: data.status === 1, cepa, region, pais, bodega, anio, _attrs };
}

async function getCartTotal(cartUrl) {
  // Magento 2 renderiza /checkout/cart/ con los totales (incluido el descuento
  // 6×5 ya aplicado) embebidos como JSON dentro del HTML — pero solo si la
  // request va con la sesión que setea el share URL. Como Node fetch no tiene
  // cookie jar, seguimos los redirects a mano acumulando Set-Cookie en cada hop.
  try {
    let url = cartUrl;
    const cookies = {};
    for (let hop = 0; hop < 5; hop++) {
      const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        redirect: 'manual',
      }, 8000);

      const setCookies = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      for (const sc of setCookies) {
        const m = sc.match(/^([^=]+)=([^;]*)/);
        if (m) cookies[m[1]] = m[2];
      }

      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url).toString();
        continue;
      }

      const html = await res.text();
      // 1) grand_total del JSON embebido (incluye descuento 6×5 ya aplicado)
      const gt = html.match(/"grand_total"\s*:\s*"?([\d.]+)"?/);
      if (gt) {
        const val = Math.round(parseFloat(gt[1]));
        return '$' + val.toLocaleString('es-AR');
      }
      // 2) Fallback: HTML legacy con class="grand totals"
      const legacy = html.match(/class="grand totals"[\s\S]*?class="price"[^>]*>([^<]+)<\/span>/);
      if (legacy) return legacy[1].trim();
      // 3) Último recurso: subtotalAmount (sin descuento) — preferible a fallar
      const sub = html.match(/"subtotalAmount"\s*:\s*"?([\d.]+)"?/);
      if (sub) {
        const val = Math.round(parseFloat(sub[1]));
        return '$' + val.toLocaleString('es-AR');
      }
      return null;
    }
    return null;
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

// Reemplaza todo lo que hay entre un par de marcadores INJECT, conservando los
// marcadores. Devuelve { result, found } para poder decidir el fallback legacy.
function replaceBetween(html, startMarker, endMarker, replacement) {
  const s = html.indexOf(startMarker);
  if (s === -1) return { result: html, found: false };
  const afterStart = s + startMarker.length;
  const e = html.indexOf(endMarker, afterStart);
  if (e === -1) return { result: html, found: false };
  const result = html.substring(0, afterStart) + replacement + html.substring(e);
  return { result, found: true };
}

// Elimina todo el rango entre dos marcadores, incluidos los propios marcadores.
function removeBetweenInclusive(html, startMarker, endMarker) {
  const s = html.indexOf(startMarker);
  if (s === -1) return { result: html, found: false };
  const e = html.indexOf(endMarker, s + startMarker.length);
  if (e === -1) return { result: html, found: false };
  const result = html.substring(0, s) + html.substring(e + endMarker.length);
  return { result, found: true };
}

function injectIntoTemplate(template, opts) {
  const { products, accessory, cartLink, cartTotal, tipo, mes, titulo, qualifies6x5 } = opts;
  let result = template;
  const showPromo = tipo === 'vinos';
  const isGuardados = tipo === 'vinos-guardados';

  // 1. Eyebrow
  const eyebrowText = isGuardados
    ? 'VINOS GUARDADOS · LIGIER'
    : `${tipo.toUpperCase().replace(/-/g, ' ')} · ${mes.toUpperCase()}`;
  // Nota: usamos funciones de reemplazo (m,p1,p2)=>p1+valor+p2 en vez de strings
  // "$1...$2". Si el valor inyectado contiene un "$" (ej. precios "$108.858"),
  // String.replace interpretaría "$1" como referencia de grupo y comería el dígito.
  // Con función, el string devuelto se usa literal y el bug desaparece.
  // v4: anclaje por class="hero-eyebrow". Fallback legacy: primer color:#666 /
  // rgba(255,255,255,0.5) del documento.
  if (/class="hero-eyebrow"/.test(result)) {
    result = result.replace(/(<p[^>]*class="hero-eyebrow"[^>]*>)[\s\S]*?(<\/p>)/, (m, p1, p2) => p1 + eyebrowText + p2);
  } else {
    result = result.replace(/(<p[^>]*color:#666[^>]*>)[^<]+(<\/p>)/, (m, p1, p2) => p1 + eyebrowText + p2);
    result = result.replace(/(<p[^>]*rgba\(255,255,255,0\.5\)[^>]*>)[^<]+(<\/p>)/, (m, p1, p2) => p1 + eyebrowText + p2);
  }

  // 2. Hero H1
  if (titulo) {
    const titleHtml = titulo.replace(/\n/g, '<br>');
    result = result.replace(/(<h1[^>]*class="hero-h1"[^>]*>)[\s\S]*?(<\/h1>)/, (m, p1, p2) => p1 + titleHtml + p2);
  }

  // 2b. Hero bajada (subtitle under H1)
  if (opts.bajada) {
    result = result.replace(/(<p[^>]*class="hero-bajada"[^>]*>)[\s\S]*?(<\/p>)/, (m, p1, p2) => p1 + opts.bajada + p2);
  }

  // 3. Products
  const productsHtml = products.map((p, i) => buildProductBlock(p, i, i === products.length - 1, showPromo, isGuardados)).join('\n');
  // v4: bloque entre <!-- INJECT:PRODUCTS_START --> y <!-- INJECT:PRODUCTS_END -->
  // (los marcadores quedan). Fallback legacy: <!-- Producto 1 --> + comentarios
  // de sección como límite.
  const prodInject = replaceBetween(result, '<!-- INJECT:PRODUCTS_START -->', '<!-- INJECT:PRODUCTS_END -->', '\n' + productsHtml + '\n    ');
  if (prodInject.found) {
    result = prodInject.result;
  } else {
    const prodStart = result.indexOf('<!-- Producto 1 -->');
    let prodEnd = result.indexOf('<!-- ── 4b.');
    if (prodEnd === -1) prodEnd = result.indexOf('<!-- ── 5.');
    if (prodEnd === -1) prodEnd = result.indexOf('<!-- ── WINE CLUB');
    if (prodEnd === -1) prodEnd = result.indexOf('<!-- ── CUOTAS');
    if (prodStart !== -1 && prodEnd !== -1) {
      result = result.substring(0, prodStart) + productsHtml + '\n    ' + result.substring(prodEnd);
    }
  }

  // 3b. Banner promo 6×5 y bloque pack (solo vinos). Si la campaña NO califica
  //     (Σqty < 6) se eliminan ambos rangos completos, marcadores incluidos,
  //     para no mostrar nunca un "$0". Si no existen los marcadores (plantilla
  //     legacy) no hay nada que eliminar: el pack-total queda sin inyectar.
  if (tipo === 'vinos' && !qualifies6x5) {
    result = removeBetweenInclusive(result, '<!-- INJECT:PROMO_START -->', '<!-- INJECT:PROMO_END -->').result;
    result = removeBetweenInclusive(result, '<!-- INJECT:PACK_START -->', '<!-- INJECT:PACK_END -->').result;
  }

  // 4. Accessory
  if (accessory) {
    // v4: límites por <!-- INJECT:ACC_START/END -->; fallback legacy: ACC_START/END.
    const hasInjectAcc = result.indexOf('<!-- INJECT:ACC_START -->') !== -1;
    const accStartRe = hasInjectAcc ? '<!-- INJECT:ACC_START -->' : '<!-- ACC_START -->';
    // Replace image, name, description, price and links in the accessory section
    const reImg = new RegExp('(' + accStartRe + '[\\s\\S]*?<img src=")[^"]*(")');
    result = result.replace(
      reImg,
      (m, p1, p2) => p1 + (accessory.image || '') + p2
    );
    // Replace accessory name (first product-name link inside ACC section)
    const accName = accessory.name || '';
    const accPrice = accessory.price ? '$' + parseFloat(accessory.price).toLocaleString('es-AR') : '';
    const accDesc = accessory.description || '';
    const accUrl = accessory.url || '#';
    // Rebuild the inner info block entre ACC_START y ACC_END (función de reemplazo:
    // accPrice contiene "$", así que con string "$1...$2" se comería un dígito).
    const reInfo = new RegExp('(' + accStartRe + '[\\s\\S]*?<td valign="middle">)[\\s\\S]*?(<\\/td>\\s*<\\/tr>\\s*<\\/table>)');
    result = result.replace(
      reInfo,
      (m, p1, p2) => p1 + `
            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">ACCESORIO</p>
            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;"><a href="${accUrl}" target="_blank" style="color:#111;">${accName}</a></p>
            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">${accDesc}</p>
            <p style="font-size:16px; font-weight:700; color:#111; margin:0 0 14px 0;">${accPrice}</p>
            <a href="${accUrl}" target="_blank" style="display:inline-block; background:transparent; border:1.5px solid #111111; color:#111111; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">VER PRODUCTO</a>
          ` + p2
    );
    // Fix accessory link in image too
    const reLink = new RegExp('(' + accStartRe + '[\\s\\S]*?<a href=")[^"]*(" target="_blank">\\s*<img)');
    result = result.replace(
      reLink,
      (m, p1, p2) => p1 + accUrl + p2
    );
  } else {
    // No accessory chosen — remove the whole section (v4 markers o legacy).
    const removed = removeBetweenInclusive(result, '<!-- INJECT:ACC_START -->', '<!-- INJECT:ACC_END -->');
    result = removed.found ? removed.result
      : result.replace(/<!-- ACC_START -->[\s\S]*?<!-- ACC_END -->/, '');
  }

  // 5. Cart links
  if (cartLink) {
    result = result.replace(/https:\/\/vinotecaligier\.com\/compartircarrito\/index\/share\/data\/[^"]+/g, () => cartLink);
  }

  // 6. Pack total — el valor (ej. "$108.858") contiene "$", así que va por función
  if (cartTotal) {
    result = result.replace(/(<p[^>]*class="pack-total"[^>]*>)[\s\S]*?(<\/p>)/, (m, p1, p2) => p1 + cartTotal + p2);
  }

  // 7. Preheader — replace the visible text inside the hidden preheader div,
  //    preservando los caracteres de relleno (entities) que evitan que Gmail
  //    arrastre texto del cuerpo al preview.
  if (opts.preheader) {
    result = result.replace(
      /(<div class="preheader"[^>]*>)[\s\S]*?(\s*(?:&#847;|&zwnj;|&nbsp;)[\s\S]*?<\/div>)/,
      (m, p1, p2) => p1 + '\n  ' + opts.preheader + p2
    );
  }

  return result;
}

// Claude elige el accesorio más afín a los productos (candidatos reales de Magento).
// Si falta ANTHROPIC_API_KEY o algo falla, devuelve null y el caller usa el curado default.
async function claudePickAccessory(tipo, products) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic();
    // Candidatos: accesorios de las marcas de cristalería/accesorios del catálogo
    const terms = ['riedel', 'nachtmann', 'decanter', 'sacacorchos', 'copa'];
    const seen = new Set();
    const candidates = [];
    for (const t of terms) {
      const url = `${MAGENTO_BASE}/rest/V1/products?searchCriteria[filterGroups][0][filters][0][field]=name&searchCriteria[filterGroups][0][filters][0][value]=%25${t}%25&searchCriteria[filterGroups][0][filters][0][conditionType]=like&searchCriteria[filterGroups][1][filters][0][field]=status&searchCriteria[filterGroups][1][filters][0][value]=1&searchCriteria[pageSize]=10&fields=items[sku,name,price,custom_attributes]`;
      const r = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${MAGENTO_TOKEN}`, 'User-Agent': 'Mozilla/5.0 (Macintosh)' } }, 8000);
      if (!r.ok) continue;
      const d = await r.json();
      for (const p of d.items || []) {
        if (seen.has(p.sku)) continue;
        seen.add(p.sku);
        const urlKey = p.custom_attributes?.find(a => a.attribute_code === 'url_key')?.value;
        if (urlKey && p.price > 0) candidates.push({ sku: p.sku, name: p.name, price: p.price, urlKey });
      }
      if (candidates.length >= 25) break;
    }
    if (candidates.length === 0) return null;

    const schema = {
      type: 'object',
      properties: { sku: { type: 'string' }, motivo: { type: 'string' } },
      required: ['sku', 'motivo'],
      additionalProperties: false,
    };
    const resp = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 600,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{
        role: 'user',
        content: `Elegí UN accesorio (por sku) que complemente esta selección de un email "${tipo}" de Vinoteca Ligier.
PRODUCTOS DEL EMAIL:\n${products.map(p => `- ${p.name} (${p.cepa || ''})`).join('\n')}
CANDIDATOS:\n${candidates.map(c => `- sku:${c.sku} | ${c.name} | $${c.price}`).join('\n')}`,
      }],
    });
    const out = JSON.parse(resp.content.find(b => b.type === 'text').text);
    const elegido = candidates.find(c => c.sku === out.sku);
    return elegido ? await getMagentoProductByUrlKey(elegido.urlKey) : null;
  } catch (e) {
    console.error('claudePickAccessory fallback:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, seleccion, carrito, urls, dia, fecha, hora, titulo, bajada, subject, preheader, accesorio, accesorioUrl, modo, emailPrueba, canal, lista_id } = req.body;
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

    // Si la selección vino por URLs (sin cartLink explícito), armamos el link de
    // carrito compartido con los SKUs resueltos, para que los botones de pack/promo
    // (vinos) abran exactamente esta selección y no el carrito de ejemplo del template.
    if (!cartLink && products.length) {
      const base = JSON.stringify(products.map(p => ({ sku: p.sku, qty: 1 })));
      cartLink = `${MAGENTO_BASE}/compartircarrito/index/share/data/${Buffer.from(base).toString('base64')}/`;
    }

    // 4. Get accessory
    //    'manual'  → URL que pega el usuario
    //    'ninguno' → sin accesorio
    //    'auto' (o cualquier otro) → accesorio acorde al tipo (default curado)
    const DEFAULT_ACCESSORIES = {
      'vinos': 'riedel-veritas-cabernet-merlot-set-2',
      'vinos-guardados': 'riedel-fatto-a-mano-pinot-noir-red',
      'whisky': 'nachtmann-noblesse-whisky-set-4',
      'espirituosas': 'nachtmann-noblesse-whisky-set-4',
    };
    let accessory = null;
    if (accesorio === 'manual' && accesorioUrl) {
      const accKey = accesorioUrl.split('/').pop().replace('.html', '');
      accessory = await getMagentoProductByUrlKey(accKey);
    } else if (accesorio !== 'ninguno') {
      // 'auto' = Claude elige el accesorio más afín a los productos seleccionados
      accessory = await claudePickAccessory(tipo, products);
      if (!accessory) {
        const defKey = DEFAULT_ACCESSORIES[tipo];
        if (defKey) accessory = await getMagentoProductByUrlKey(defKey);
      }
    }

    // 5. Condición 6×5 por BOTELLAS (Σqty), no por cantidad de productos.
    //    - Selección por carrito: sumamos las qty decodificadas del link.
    //    - Selección por URLs (sin carrito): qty implícita 1 por producto.
    //    Solo aplica a vinos.
    let totalBottles;
    if (skuList.length > 0) {
      totalBottles = skuList.reduce((s, it) => s + (parseInt(it.qty) || 0), 0);
    } else {
      totalBottles = products.length; // URLs → 1 botella por producto
    }
    const qualifies6x5 = tipo === 'vinos' && totalBottles >= 6;

    // Total del pack: SIEMPRE leído del carrito real de Magento (B1.1).
    //    Si la campaña califica pero no se puede leer el total → 502, sin fallback.
    let cartTotal = null;
    if (qualifies6x5) {
      if (!cartLink) {
        return res.status(502).json({ error: 'No se pudo leer el total del carrito de Magento' });
      }
      cartTotal = await getCartTotal(cartLink);
      if (!cartTotal) {
        return res.status(502).json({ error: 'No se pudo leer el total del carrito de Magento' });
      }
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
    const emailHtml = injectIntoTemplate(baseTemplate, { products, accessory, cartLink, cartTotal, tipo, mes, titulo, bajada: bajadaFinal, preheader: preheaderFinal, qualifies6x5 });
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
        rawAttrs: products[0]?._attrs || [],
        htmlLength: emailHtml.length,
        html: emailHtml,
      });
    }

    // 8a. Canal LGR → la campaña sale por nuestra base con AWS SES
    if (canal === 'lgr') {
      const lgrUrl = process.env.LGR_API_URL;
      const lgrToken = process.env.LGR_API_TOKEN;
      if (!lgrUrl || !lgrToken) {
        return res.status(500).json({ error: 'Canal LGR no configurado (faltan LGR_API_URL / LGR_API_TOKEN en Vercel)' });
      }
      // Programación: fecha exacta (v2) en hora argentina GMT-3
      let programadaAt = null;
      if (modo !== 'borrador' && fecha) {
        const [h2, m2] = (hora || '10:30').split(':');
        programadaAt = `${fecha}T${String(h2).padStart(2,'0')}:${String(m2).padStart(2,'0')}:00-03:00`;
      }
      const lgrRes = await fetchWithTimeout(`${lgrUrl}/api/publico/mkt/campanas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-LGR-Token': lgrToken },
        body: JSON.stringify({
          nombre: `Ligier · ${tipo} · ${fecha || dia || ''} ${mes}`.trim(),
          asunto: subjectFinal,
          preheader: preheaderFinal,
          cuerpo_html: emailHtml,
          lista_id: lista_id || null,
          programada_at: programadaAt,
          modo: programadaAt && lista_id ? 'programada' : 'borrador',
        }),
      }, 15000);
      const lgrData = await lgrRes.json();
      if (!lgrRes.ok || !lgrData.ok) {
        return res.status(502).json({ error: 'LGR rechazó la campaña', detail: JSON.stringify(lgrData) });
      }
      return res.status(200).json({
        success: true,
        canal: 'lgr',
        campaignId: lgrData.campana_id,
        campaignName: `Ligier · ${tipo} · ${fecha || dia || ''}`.trim(),
        estado: lgrData.estado,
        scheduleTime: programadaAt,
        isDraft: lgrData.estado === 'borrador',
        productsFound: products.length,
        lgrUrl: lgrData.url,
      });
    }

    // 8b. Brevo (canal por defecto). Reemplaza Mailchimp desde el 25 jun 2026.
    // Brevo expone /v3/emailCampaigns para crear (incluyendo programación) en
    // una sola llamada, y /v3/emailCampaigns/{id}/sendTest para el preview.
    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) return res.status(500).json({ error: 'Falta BREVO_API_KEY en el entorno' });
    const brevoBase = 'https://api.brevo.com/v3';
    const brevoHeaders = { 'api-key': brevoKey, 'accept': 'application/json', 'content-type': 'application/json' };

    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'hola@news.vinotecaligier.com';
    const senderName = process.env.BREVO_SENDER_NAME || 'Vinoteca Ligier';
    // listId destino: por payload (lista_id) o env BREVO_DEFAULT_LIST_ID.
    const brevoListId = parseInt(lista_id || process.env.BREVO_DEFAULT_LIST_ID || '0', 10);
    if (!brevoListId) return res.status(400).json({ error: 'Falta lista_id en payload o BREVO_DEFAULT_LIST_ID en el entorno' });

    const campaignTitle = `Ligier · ${tipo} · ${dia} ${mes}`;

    // scheduledAt en formato ISO 8601 con offset (Brevo lo acepta). Argentina
    // es GMT-3 fijo (sin DST): construimos el instante UTC explícito.
    let scheduleTime = null;
    if (modo !== 'borrador') {
      let sendDate;
      if (fecha) {
        const [y, mo, d] = fecha.split('-').map(Number);
        sendDate = new Date(y, mo - 1, d);
      } else {
        const diasMap = { Lunes:1, Martes:2, Miércoles:3, Jueves:4, Viernes:5, Sábado:6, Domingo:0 };
        const today = new Date();
        const targetDay = diasMap[dia] ?? 3;
        let daysUntil = (targetDay - today.getDay() + 7) % 7 || 7;
        sendDate = new Date(today);
        sendDate.setDate(today.getDate() + daysUntil);
      }
      const [h, m] = (hora || '10:30').split(':');
      const utcDate = new Date(Date.UTC(
        sendDate.getFullYear(), sendDate.getMonth(), sendDate.getDate(),
        parseInt(h) + 3, parseInt(m), 0, 0
      ));
      scheduleTime = utcDate.toISOString().replace('.000Z', '+00:00');
    }

    const createBody = {
      name: campaignTitle,
      subject: subjectFinal,
      sender: { name: senderName, email: senderEmail },
      replyTo: 'ventas@ligier.com.ar',
      htmlContent: emailHtml,
      preheader: preheaderFinal,
      recipients: { listIds: [brevoListId] },
      ...(scheduleTime ? { scheduledAt: scheduleTime } : {}),
    };

    const createRes = await fetch(`${brevoBase}/emailCampaigns`, {
      method: 'POST', headers: brevoHeaders, body: JSON.stringify(createBody),
    });
    const campaign = await createRes.json();
    if (!createRes.ok || !campaign.id) {
      return res.status(500).json({ error: 'Error Brevo crear campaña', detail: JSON.stringify(campaign) });
    }

    // Envío de prueba al emailPrueba (siempre, igual que con Mailchimp).
    const testEmail = emailPrueba || 'mdd145@gmail.com';
    const testRes = await fetch(`${brevoBase}/emailCampaigns/${campaign.id}/sendTest`, {
      method: 'POST', headers: brevoHeaders,
      body: JSON.stringify({ emailTo: [testEmail] }),
    });
    const testOk = testRes.ok;
    const testDetail = testOk ? null : await testRes.text().catch(() => null);

    return res.status(200).json({
      success: true,
      canal: 'brevo',
      campaignId: campaign.id,
      campaignName: campaignTitle,
      scheduleTime,
      isDraft: modo === 'borrador',
      testEmail,
      testSent: testOk,
      ...(testDetail ? { testError: testDetail } : {}),
      productsFound: products.length,
      brevoUrl: `https://app.brevo.com/camp/dashboard/email-listing/list/details/${campaign.id}`,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
