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
    cepa, region, pais, bodega, anio };
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

function buildProductBlock(product, index, isLast, isGuardados) {
  const separator = isLast ? '' : `
        <tr><td colspan="2" style="padding-bottom:0;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" bgcolor="#f0f0f0" style="font-size:0; line-height:0;">&nbsp;</td></tr><tr><td height="24" style="font-size:0; line-height:0;">&nbsp;</td></tr></table>
        </td></tr>`;

  const price = parseFloat(product.price);
  const priceFormatted = price ? price.toLocaleString('es-AR') : '';
  const priceBlock = `<p style="font-size:18px; font-weight:700; color:#111; margin:0 0 14px 0;">$${priceFormatted}</p>`;

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
 * Toma el template + datos y devuelve el HTML armado. Versión TRANSACCIONAL
 * (sin promo 6x5, sin pack, sin accesorio).
 *
 * opts: { eyebrow, titulo, bajada, products: [{sku, name, price, image, description, url, ...}], ctaText, ctaUrl, isGuardados }
 */
export function injectTransactional(template, opts) {
  let result = template;
  const { eyebrow, titulo, bajada, products, ctaText, ctaUrl, isGuardados } = opts;

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
  const productsHtml = (products || []).map((p, i) => buildProductBlock(p, i, i === products.length - 1, !!isGuardados)).join('\n');
  const prodInject = replaceBetween(result, '<!-- INJECT:PRODUCTS_START -->', '<!-- INJECT:PRODUCTS_END -->', '\n' + productsHtml + '\n    ');
  if (prodInject.found) result = prodInject.result;

  // 6. Remover PROMO 6x5 (no aplica en transaccional 1:1)
  const noPromo = removeBetweenInclusive(result, '<!-- INJECT:PROMO_START -->', '<!-- INJECT:PROMO_END -->');
  if (noPromo.found) result = noPromo.result;

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
