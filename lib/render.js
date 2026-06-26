// Renderizado mínimo para emails transaccionales 1:1 (Recompra, Bienvenida,
// Dormidos, etc.). Reusa los templates de mdd145-prog/Mailing pero con
// flujo simplificado: sin promo 6x5, sin pack, sin accesorio, sin programación.
// Solo: descarga template → trae N productos de Magento → inyecta H1 + bajada +
// productos → devuelve HTML listo para Brevo /v3/smtp/email.
//
// Mantenemos una COPIA de las funciones críticas de generate-campaign.js
// (productCard, injectIntoTemplate light) para no acoplar y poder iterar
// transaccionales sin tocar el flujo de campañas masivas. Si esto se vuelve
// pesado, en una sesión futura se refactoriza extrayendo a este lib desde ambos.

const GITHUB_RAW = 'https://raw.githubusercontent.com/mdd145-prog/Mailing/main/templates/';

export const TEMPLATES_BY_KEY = {
  vinos: 'base-email-vinos.html',
  whisky: 'base-email-whisky.html',
  guardados: 'base-email-guardados.html',
};

const MAGENTO_BASE = process.env.MAGENTO_BASE_URL || 'https://vinotecaligier.com';
const MAGENTO_TOKEN = process.env.MAGENTO_ACCESS_TOKEN;
const CUSTOM_API_KEY = process.env.MAGENTO_CUSTOM_API_KEY;

/**
 * Cliente para los endpoints custom de Magento (api_productos / api_stock /
 * api_promos). Auth por header X-API-KEY (no X-LGR-Key como decía la spec
 * borrador) y User-Agent NEUTRO (un UA de navegador dispara el WAF de Nexcess
 * y devuelve 403 HTML — verificado por LGR backend, 18 jun 2026).
 */
async function callCustomApi(path, query = {}, timeout = 10000) {
  if (!CUSTOM_API_KEY) {
    throw new Error('Falta MAGENTO_CUSTOM_API_KEY en el entorno');
  }
  const qs = Object.entries(query)
    .filter(([_, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${MAGENTO_BASE}${path}${qs ? '?' + qs : ''}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      'X-API-KEY': CUSTOM_API_KEY,
      'Accept': 'application/json',
      'User-Agent': 'LGR-Mailer/1.0 (Vercel)',
    },
  }, timeout);
  if (!res.ok) throw new Error(`Magento custom ${path}: HTTP ${res.status}`);
  const body = await res.json();
  if (!body?.ok) throw new Error(`Magento custom ${path}: ${body?.error || 'respuesta no-ok'}`);
  return body;
}

const COUNTRY_CODES = { AR: 'Argentina', CL: 'Chile', FR: 'Francia', IT: 'Italia',
  ES: 'España', US: 'Estados Unidos', UY: 'Uruguay', PT: 'Portugal', NZ: 'Nueva Zelanda' };

const CEPAS = ['Malbec','Cabernet Franc','Cabernet Sauvignon','Cabernet','Merlot','Bonarda',
  'Syrah','Petit Verdot','Tannat','Pinot Noir','Tempranillo','Sangiovese','Blend','Corte',
  'Chardonnay','Sauvignon Blanc','Torrontés','Torrontes','Semillón','Semillon','Viognier',
  'Riesling','Pinot Grigio','Gewürztraminer','Chenin','Rosé','Rosado'];

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

const _optionCache = {};
async function resolveOption(code, value) {
  if (value == null || value === '') return null;
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
  } catch (e) { return null; }
}

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

  // Stock: el detalle de /products/{sku} NO devuelve stock confiablemente —
  // hay que pegarle al endpoint dedicado /stockItems/{sku}. Cached por SKU.
  // Si falla, asumimos sin stock (más seguro: no ofrecer lo que no se puede confirmar).
  const stock = await getStockItem(data.sku);
  const inStock = stock?.inStock || false;
  const qty = stock?.qty || 0;

  const allAttrs = data.custom_attributes || [];
  const byPattern = async (re) => {
    const cand = allAttrs.find(a => re.test(a.attribute_code) && a.value != null && a.value !== '' && a.value !== '0');
    if (!cand) return null;
    const v = await resolveOption(cand.attribute_code, cand.value);
    return v && v !== '0' ? v : null;
  };
  let cepa = await byPattern(/vari|cepa|uva|grape/i);
  if (!cepa) cepa = CEPAS.find(c => new RegExp(`\\b${c}\\b`, 'i').test(data.name)) || null;
  const region = await byPattern(/region|provinc|zona|appellation|terru?o|valle/i);
  let pais = await byPattern(/pais|origen|country|nacionalidad/i);
  if (pais && COUNTRY_CODES[pais.toUpperCase()]) pais = COUNTRY_CODES[pais.toUpperCase()];
  const bodega = await byPattern(/marca|bodega|brand|fabric|winery/i);
  const anio = await byPattern(/(^|_)an?io?($|_)|year|cosech|vintage|añ/i);

  return { sku: data.sku, name: data.name, price, image, description, url: productUrl,
    cepa, region, pais, bodega, anio, inStock, qty };
}

// Mapping rubro/tipo → categoryId de Magento (relevado por assist.js 6 jun 2026).
// Para que un mail transaccional sugiera productos de la categoría del cliente.
const CATEGORIAS = {
  'vinos': 882,
  'vinos-guardados': 883,
  'whisky': 16,
  'espirituosas': 10,
  'wine-club': 891,
  'gift-cards': 7,
};
const CONTENIDO_750 = 25;   // Atributo `contenido` = presentación en ml; opción 25 = 750ml

/**
 * Mapea el response de api_productos.php (sin custom_attributes ni description)
 * al shape interno que usa buildProductBlock. Cepa se deduce del name.
 * Cuando Magento agregue custom_attributes al endpoint (bodega, varietal, año,
 * región), enriquecer este mapeo.
 */
function parseCustomProduct(p) {
  if (!p?.sku) return null;
  const price = parseFloat(p.price) || 0;
  // Cepa por matcheo contra el name (Malbec, Cabernet, etc.)
  const cepa = CEPAS.find(c => new RegExp(`\\b${c}\\b`, 'i').test(p.name || '')) || null;
  const productUrl = `${MAGENTO_BASE}/catalogsearch/result/?q=${encodeURIComponent(p.sku)}`;
  return {
    sku: p.sku,
    name: p.name,
    price,
    image: p.image_url || p.thumbnail_url || null,
    description: '', // No viene en el endpoint custom hoy.
    url: productUrl,
    cepa,
    region: null,
    pais: null,
    bodega: null,
    anio: null,
    inStock: !!p.is_in_stock,
    qty: parseFloat(p.qty_stock) || 0,
  };
}

/**
 * Devuelve N productos random de la categoría, opcionalmente filtrados por
 * rango de precio. Filtros Magento (status/type/category/contenido=750ml) +
 * filtro de precio CLIENT-SIDE para no superar el límite de URL del WAF de
 * Nexcess (~800 chars / max 2-3 filterGroups). Magento ya devuelve `price`
 * en la respuesta de listado, así que filtramos antes de ir al detalle.
 *
 * @param {string} tipo  Clave de CATEGORIAS (vinos, vinos-guardados, whisky, ...)
 * @param {object} opts
 *   - count?: number       cantidad de productos a devolver (max 6, default 3)
 *   - priceMin?: number    precio mínimo (inclusive) en ARS
 *   - priceMax?: number    precio máximo (inclusive) en ARS
 *   - excludeSkus?: string[] SKUs a excluir (carrito habitual del cliente)
 */
export async function getProductsByCategory(tipo, opts = {}) {
  const { count = 3, priceMin, priceMax, excludeSkus = [] } = opts;
  const catId = CATEGORIAS[tipo];
  if (!catId) return [];

  const exclude = new Set((excludeSkus || []).filter(Boolean));
  const target = Math.min(count, 6);

  let candidates = [];
  try {
    const body = await callCustomApi('/api_productos.php', {
      categoria_id: catId,
      contenido: CONTENIDO_750,
      activos: 1,
      per_page: 200,
    });
    candidates = (body.data || [])
      .map(parseCustomProduct)
      .filter(Boolean)
      .filter(p => p.sku && !exclude.has(p.sku));
  } catch (e) {
    console.error('getProductsByCategory custom error:', e.message);
    return [];
  }

  // Filtros: stock real + rango de precio + exclude.
  candidates = candidates.filter(p => p.inStock && p.qty > 0);
  if (priceMin != null) candidates = candidates.filter(p => p.price >= priceMin);
  if (priceMax != null) candidates = candidates.filter(p => p.price <= priceMax);

  candidates.sort(() => Math.random() - 0.5);
  return candidates.slice(0, target);
}

/**
 * Trae datos de productos por SKU específico vía api_productos.php?sku=A,B,C.
 * Filtra los sin stock (regla: nunca ofrecer lo que no se puede comprar).
 */
export async function getProductsBySkus(skus) {
  const list = (Array.isArray(skus) ? skus : []).filter(Boolean);
  if (!list.length) return [];
  try {
    const body = await callCustomApi('/api_productos.php', {
      sku: list.join(','),
      per_page: list.length,
    });
    return (body.data || [])
      .map(parseCustomProduct)
      .filter(Boolean)
      .filter(p => p.inStock && p.qty > 0);
  } catch (e) {
    console.error('getProductsBySkus custom error:', e.message);
    return [];
  }
}

/**
 * Lee el grand_total del carrito compartido de Magento. Devuelve **número**
 * (ARS) o null si no se pudo leer. Sigue redirects manual con cookie jar
 * porque el render del carrito depende de la sesión.
 *
 * Es la **fuente de verdad** para saber si hay alguna promo aplicada
 * (6×5 / 2×1 / $X off / lo que sea): si `grand_total < suma(precio lleno)`
 * → hay descuento. Si igualan → no hay promo. Sin hardcodear categorías.
 */
export async function getCartGrandTotal(cartUrl) {
  try {
    let url = cartUrl;
    const cookies = {};
    for (let hop = 0; hop < 5; hop++) {
      const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await fetchWithTimeout(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
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
      const gt = html.match(/"grand_total"\s*:\s*"?([\d.]+)"?/);
      if (gt) return Math.round(parseFloat(gt[1]));
      const sub = html.match(/"subtotalAmount"\s*:\s*"?([\d.]+)"?/);
      if (sub) return Math.round(parseFloat(sub[1]));
      return null;
    }
    return null;
  } catch (e) {
    console.error('getCartGrandTotal error:', e.message);
    return null;
  }
}

export async function getMagentoProduct(sku) {
  try {
    const res = await fetchWithTimeout(
      `${MAGENTO_BASE}/rest/V1/products/${encodeURIComponent(sku)}`,
      { headers: { 'Authorization': `Bearer ${MAGENTO_TOKEN}`, 'Content-Type': 'application/json' } }, 8000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return await parseMagentoProduct(data);
  } catch (e) {
    console.error('Magento product error', sku, e.message);
    return null;
  }
}

// Diagnóstico — devuelve el JSON crudo de Magento para un SKU.
export async function debugMagentoProduct(sku) {
  const out = { sku };
  try {
    const res = await fetchWithTimeout(
      `${MAGENTO_BASE}/rest/V1/products/${encodeURIComponent(sku)}`,
      { headers: { 'Authorization': `Bearer ${MAGENTO_TOKEN}`, 'Content-Type': 'application/json' } }, 8000
    );
    out.productHttp = res.status;
    if (res.ok) {
      const data = await res.json();
      out.name = data.name;
      out.status = data.status;
      out.extAttrKeys = data.extension_attributes ? Object.keys(data.extension_attributes) : [];
    }
  } catch (e) { out.productError = e.message; }
  try {
    const res = await fetchWithTimeout(
      `${MAGENTO_BASE}/rest/V1/stockItems/${encodeURIComponent(sku)}`,
      { headers: { 'Authorization': `Bearer ${MAGENTO_TOKEN}`, 'Content-Type': 'application/json' } }, 8000
    );
    out.stockHttp = res.status;
    if (res.ok) out.stockItem = await res.json();
  } catch (e) { out.stockError = e.message; }
  return out;
}

/**
 * Trae el stock_item de Magento para un SKU.
 * Endpoint: /rest/V1/stockItems/{sku} — devuelve { is_in_stock, qty, ... }.
 * Cache en memoria por SKU para no pegarle 2× en el mismo request.
 */
const _stockCache = {};
export async function getStockItem(sku) {
  if (sku in _stockCache) return _stockCache[sku];
  try {
    const res = await fetchWithTimeout(
      `${MAGENTO_BASE}/rest/V1/stockItems/${encodeURIComponent(sku)}`,
      { headers: { 'Authorization': `Bearer ${MAGENTO_TOKEN}`, 'Content-Type': 'application/json' } }, 8000
    );
    if (!res.ok) {
      _stockCache[sku] = null;
      return null;
    }
    const data = await res.json();
    const info = {
      inStock: !!data.is_in_stock,
      qty: parseFloat(data.qty) || 0,
    };
    _stockCache[sku] = info;
    return info;
  } catch (e) {
    console.error('getStockItem error', sku, e.message);
    _stockCache[sku] = null;
    return null;
  }
}

function buildProductBlock(product, index, isLast, isGuardados, withPromo = false) {
  const separator = isLast ? '' : `
        <tr><td colspan="2" style="padding-bottom:0;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" bgcolor="#f0f0f0" style="font-size:0; line-height:0;">&nbsp;</td></tr><tr><td height="24" style="font-size:0; line-height:0;">&nbsp;</td></tr></table>
        </td></tr>`;

  const price = parseFloat(product.price);
  const fmt = (n) => n ? Math.round(n).toLocaleString('es-AR') : '';
  let priceBlock;
  if (withPromo && price) {
    // 6x5 visual: lleno tachado + precio rebajado (×5/6) grande + leyenda
    const pricePromo = price * 5 / 6;
    priceBlock = `<p style="font-size:12px; color:#aaa; text-decoration:line-through; margin:0 0 2px 0;">$${fmt(price)}</p>
            <p style="font-size:22px; font-weight:700; color:#111; line-height:1; margin:0 0 2px 0;">$${fmt(pricePromo)}</p>
            <p style="font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin:0 0 10px 0;">c/u comprando 6</p>`;
  } else {
    priceBlock = `<p style="font-size:18px; font-weight:700; color:#111; margin:0 0 14px 0;">$${fmt(price)}</p>`;
  }

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

function replaceBetween(html, startMarker, endMarker, replacement) {
  const s = html.indexOf(startMarker);
  if (s === -1) return { result: html, found: false };
  const afterStart = s + startMarker.length;
  const e = html.indexOf(endMarker, afterStart);
  if (e === -1) return { result: html, found: false };
  return { result: html.substring(0, afterStart) + replacement + html.substring(e), found: true };
}

function removeBetweenInclusive(html, startMarker, endMarker) {
  const s = html.indexOf(startMarker);
  if (s === -1) return { result: html, found: false };
  const e = html.indexOf(endMarker, s + startMarker.length);
  if (e === -1) return { result: html, found: false };
  return { result: html.substring(0, s) + html.substring(e + endMarker.length), found: true };
}

/**
 * Toma el template + datos y devuelve el HTML armado. Versión TRANSACCIONAL.
 * Por defecto saca PROMO/PACK/ACCESORIO. Con `withPromo: true` deja la banda
 * 6×5 del template (útil para Recompra/Bienvenida/Dormidos) y muestra cada
 * producto con precio lleno tachado + precio promo + "c/u comprando 6".
 *
 * opts: {
 *   eyebrow, titulo, bajada,
 *   products: [{sku, name, price, image, description, url, ...}],
 *   ctaText, ctaUrl,
 *   isGuardados,
 *   withPromo?: bool,    // si true mantiene la banda 6x5 + precios rebajados
 *   cartUrl?: string,    // si viene, reemplaza el cart URL del template (botón APROVECHAR)
 * }
 */
export function injectTransactional(template, opts) {
  let result = template;
  const { eyebrow, titulo, bajada, products, ctaText, ctaUrl, isGuardados, withPromo = false, cartUrl } = opts;

  // 1. Eyebrow
  if (eyebrow) {
    if (/class="hero-eyebrow"/.test(result)) {
      result = result.replace(/(<p[^>]*class="hero-eyebrow"[^>]*>)[\s\S]*?(<\/p>)/, (m, p1, p2) => p1 + eyebrow + p2);
    } else {
      result = result.replace(/(<p[^>]*color:#666[^>]*>)[^<]+(<\/p>)/, (m, p1, p2) => p1 + eyebrow + p2);
    }
  }

  // 2. Título (Hero H1)
  if (titulo) {
    const titleHtml = titulo.replace(/\n/g, '<br>');
    result = result.replace(/(<h1[^>]*class="hero-h1"[^>]*>)[\s\S]*?(<\/h1>)/, (m, p1, p2) => p1 + titleHtml + p2);
  }

  // 3. Bajada (Hero subtitle)
  if (bajada) {
    result = result.replace(/(<p[^>]*class="hero-bajada"[^>]*>)[\s\S]*?(<\/p>)/, (m, p1, p2) => p1 + bajada + p2);
  }

  // 4. CTA del hero (botón blanco)
  if (ctaText || ctaUrl) {
    result = result.replace(
      /(<a[^>]*background:#ffffff[^>]*>)[^<]+(<\/a>)/,
      (m, p1, p2) => p1.replace(/href="[^"]*"/, `href="${ctaUrl || 'https://vinotecaligier.com'}"`) + (ctaText || 'VER SELECCIÓN') + p2
    );
  }

  // 5. Productos (entre INJECT:PRODUCTS_START/END)
  const productsHtml = (products || []).map((p, i) => buildProductBlock(p, i, i === products.length - 1, !!isGuardados, withPromo)).join('\n');
  const prodInject = replaceBetween(result, '<!-- INJECT:PRODUCTS_START -->', '<!-- INJECT:PRODUCTS_END -->', '\n' + productsHtml + '\n    ');
  if (prodInject.found) result = prodInject.result;

  // 6. PROMO 6x5: mantener si withPromo, sino sacar
  if (!withPromo) {
    const noPromo = removeBetweenInclusive(result, '<!-- INJECT:PROMO_START -->', '<!-- INJECT:PROMO_END -->');
    if (noPromo.found) result = noPromo.result;
  } else if (cartUrl) {
    // Reemplazar TODOS los cart URLs del template (botón APROVECHAR de PROMO,
    // botones de pack/promo, etc.) por nuestro cart real.
    result = result.replace(
      /https:\/\/vinotecaligier\.com\/compartircarrito\/index\/share\/data\/[^"]+/g,
      cartUrl
    );
  }

  // 7. Remover PACK
  const noPack = removeBetweenInclusive(result, '<!-- INJECT:PACK_START -->', '<!-- INJECT:PACK_END -->');
  if (noPack.found) result = noPack.result;

  // 8. Remover ACCESORIO
  const noAcc = removeBetweenInclusive(result, '<!-- INJECT:ACC_START -->', '<!-- INJECT:ACC_END -->');
  if (noAcc.found) result = noAcc.result;

  return result;
}

/** Descarga el HTML del template desde GitHub Raw. */
export async function fetchTemplate(templateKey) {
  const file = TEMPLATES_BY_KEY[templateKey] || TEMPLATES_BY_KEY.vinos;
  const res = await fetchWithTimeout(GITHUB_RAW + file, {}, 8000);
  if (!res.ok) throw new Error(`No se pudo descargar template ${file}: HTTP ${res.status}`);
  return await res.text();
}
