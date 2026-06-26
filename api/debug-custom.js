// GET /api/debug-custom?endpoint=productos|stock|promos&sku=BE01153&categoria_id=882
//
// Endpoint temporal para inspeccionar los endpoints custom de Magento:
//   - /api_productos.php (con sku o categoria_id+contenido)
//   - /api_stock.php (?skus=A,B,C)
//   - /api_promos.php (?activas=true)
// Borrar después de validar el refactor a custom API.

export const config = { maxDuration: 20 };

const MAGENTO_BASE = process.env.MAGENTO_BASE_URL || 'https://vinotecaligier.com';
const CUSTOM_KEY = process.env.MAGENTO_CUSTOM_API_KEY;

export default async function handler(req, res) {
  if (!CUSTOM_KEY) {
    return res.status(500).json({ error: 'Falta MAGENTO_CUSTOM_API_KEY en el entorno de Vercel' });
  }

  const endpoint = (req.query?.endpoint || 'productos').toString();
  const sku = (req.query?.sku || '').toString();
  const categoria_id = (req.query?.categoria_id || '').toString();
  const contenido = (req.query?.contenido || '25').toString();

  let url;
  if (endpoint === 'productos') {
    if (sku) {
      url = `${MAGENTO_BASE}/api_productos.php?sku=${encodeURIComponent(sku)}`;
    } else if (categoria_id) {
      url = `${MAGENTO_BASE}/api_productos.php?categoria_id=${categoria_id}&contenido=${contenido}&activos=1&per_page=3`;
    } else {
      return res.status(400).json({ error: 'Para endpoint=productos, mandá ?sku=X o ?categoria_id=Y' });
    }
  } else if (endpoint === 'stock') {
    if (!sku) return res.status(400).json({ error: 'Para endpoint=stock, mandá ?sku=A,B,C' });
    url = `${MAGENTO_BASE}/api_stock.php?skus=${encodeURIComponent(sku)}`;
  } else if (endpoint === 'promos') {
    url = `${MAGENTO_BASE}/api_promos.php?activas=true`;
  } else {
    return res.status(400).json({ error: 'endpoint debe ser productos|stock|promos' });
  }

  try {
    const t0 = Date.now();
    // OJO: el header real es X-API-KEY (la spec borrador decía X-LGR-Key pero
    // Magento lo nombró X-API-KEY) Y el UA NO puede ser de navegador (dispara
    // el WAF de Nexcess → 403 HTML). UA neutro tipo "LGR-Mailer/1.0" pasa.
    const r = await fetch(url, {
      headers: {
        'X-API-KEY': CUSTOM_KEY,
        'Accept': 'application/json',
        'User-Agent': 'LGR-Mailer/1.0 (Vercel)',
      },
    });
    const ms = Date.now() - t0;
    const text = await r.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) {}
    return res.status(200).json({
      url,
      status: r.status,
      durationMs: ms,
      ok: parsed?.ok,
      meta: parsed?.meta,
      firstItem: parsed?.data?.[0] || null,
      totalItems: Array.isArray(parsed?.data) ? parsed.data.length : null,
      rawPreview: text.substring(0, 1500),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, url });
  }
}
