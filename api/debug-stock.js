// GET /api/debug-stock?sku=BE01153
// Endpoint temporal para diagnosticar qué devuelve Magento sobre stock.
// Borrar después de validar el filtro de stock del transaccional.

import { debugMagentoProduct } from '../lib/render.js';

export default async function handler(req, res) {
  const sku = (req.query?.sku || '').toString();
  if (!sku) return res.status(400).json({ error: 'Falta ?sku=...' });
  const data = await debugMagentoProduct(sku);
  return res.status(200).json(data);
}
