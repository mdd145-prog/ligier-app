// Asistente IA del wizard (Claude API) + proxy a LGR.
// Acciones:
//   - copys:      sugiere títulos/bajadas/subjects/preheaders nuevos según tipo
//   - productos:  busca candidatos en Magento por rango de precio y Claude
//                 selecciona la mejor tanda según las notas (cepas/bodegas/marcas)
//   - promos:     lista las promociones vigentes de Magento (cart price rules)
//   - lgr_listas: trae las listas/segmentos de LGR (proxy — el token no se expone al browser)
export const config = { maxDuration: 60 };

import Anthropic from '@anthropic-ai/sdk';

const MAGENTO_BASE = process.env.MAGENTO_BASE_URL || 'https://vinotecaligier.com';
const MAGENTO_TOKEN = process.env.MAGENTO_ACCESS_TOKEN;
const LGR_API_URL = process.env.LGR_API_URL; // ej: https://lgr.vinotecaligier.com
const LGR_API_TOKEN = process.env.LGR_API_TOKEN;

const anthropic = new Anthropic(); // ANTHROPIC_API_KEY del env de Vercel

// Guía de voz Ligier (resumen de guidelines v4.0 del repo mailchimp)
const VOZ_LIGIER = `Voz Ligier: curador experto, sobrio, cercano pero no efusivo.
Sin superlativos, sin signos de exclamación, sin promesas infladas. Español rioplatense.
Títulos: máx 3 líneas, máx 6 palabras por línea, sin punto final, sin precio ni promo (separá las líneas con \\n).
Bajadas: máx 2 líneas, complementan el título sin repetirlo.
Subjects: 28-42 caracteres, informan sin promo, sin emojis.
Preheaders: 40-90 caracteres, acá SÍ puede ir la promo (ej: "Llevá 6, pagá 5.").`;

async function fetchTimeout(url, options = {}, ms = 8000) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: c.signal });
  } finally {
    clearTimeout(id);
  }
}

// ── copys ────────────────────────────────────────────────────────────────
async function sugerirCopys({ campo, tipo, contexto }) {
  const schema = {
    type: 'object',
    properties: {
      sugerencias: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exactamente 5 opciones nuevas',
      },
    },
    required: ['sugerencias'],
    additionalProperties: false,
  };

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{
      role: 'user',
      content: `${VOZ_LIGIER}

Generá 5 opciones NUEVAS de ${campo} para un email de tipo "${tipo}" de Vinoteca Ligier.
${contexto ? `Contexto de la campaña: ${contexto}` : ''}
Tienen que sonar a la misma voz pero ser frescas (no clichés de vinoteca).`,
    }],
  });

  const block = response.content.find(b => b.type === 'text');
  return JSON.parse(block.text);
}

// ── productos ────────────────────────────────────────────────────────────
const RANGO_LIMITES = {
  '20-30k': [20000, 30000], '30-40k': [30000, 40000], '40-60k': [40000, 60000],
  '60-90k': [60000, 90000], '90-120k': [90000, 120000], '+120k': [120000, 100000000],
};

async function buscarCandidatosMagento(min, max) {
  // Productos simples, habilitados, dentro del rango — hasta 80 candidatos
  const params = [
    `searchCriteria[filterGroups][0][filters][0][field]=price`,
    `searchCriteria[filterGroups][0][filters][0][value]=${min}`,
    `searchCriteria[filterGroups][0][filters][0][conditionType]=gteq`,
    `searchCriteria[filterGroups][1][filters][0][field]=price`,
    `searchCriteria[filterGroups][1][filters][0][value]=${max}`,
    `searchCriteria[filterGroups][1][filters][0][conditionType]=lteq`,
    `searchCriteria[filterGroups][2][filters][0][field]=status`,
    `searchCriteria[filterGroups][2][filters][0][value]=1`,
    `searchCriteria[filterGroups][3][filters][0][field]=type_id`,
    `searchCriteria[filterGroups][3][filters][0][value]=simple`,
    `searchCriteria[pageSize]=80`,
    `fields=items[sku,name,price,custom_attributes]`,
  ].join('&');
  const res = await fetchTimeout(`${MAGENTO_BASE}/rest/V1/products?${params}`, {
    headers: { Authorization: `Bearer ${MAGENTO_TOKEN}` },
  }, 12000);
  if (!res.ok) throw new Error(`Magento ${res.status}`);
  const data = await res.json();
  return (data.items || []).map(p => {
    const attr = (code) => p.custom_attributes?.find(a => a.attribute_code === code)?.value;
    return {
      sku: p.sku,
      name: p.name,
      price: p.price,
      url_key: attr('url_key'),
    };
  }).filter(p => p.url_key && p.price > 0);
}

async function elegirProductos({ tipo, rango, notas, cantidad = 6 }) {
  const [min, max] = RANGO_LIMITES[rango] || [20000, 100000000];
  const candidatos = await buscarCandidatosMagento(min, max);
  if (candidatos.length === 0) {
    return { productos: [], mensaje: 'No encontré productos en ese rango de precio.' };
  }

  const schema = {
    type: 'object',
    properties: {
      seleccion: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sku: { type: 'string' },
            motivo: { type: 'string', description: 'Por qué entra en la selección, en una frase' },
          },
          required: ['sku', 'motivo'],
          additionalProperties: false,
        },
      },
      criterio: { type: 'string', description: 'El hilo conductor de la selección, en una frase' },
    },
    required: ['seleccion', 'criterio'],
    additionalProperties: false,
  };

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2500,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{
      role: 'user',
      content: `Sos el curador de Vinoteca Ligier. Armá una selección de ${cantidad} productos
para un email de tipo "${tipo}" eligiendo SOLO de esta lista de candidatos (por sku).
${notas ? `Indicaciones del usuario (cepas, bodegas, marcas, estilo): ${notas}` : 'Sin indicaciones extra: buscá variedad coherente (distintas bodegas, estilos complementarios).'}
Criterios: que la tanda tenga un hilo conductor, sin repetir bodega salvo pedido expreso,
descartá lo que no corresponda al tipo de email (ej: nada de whisky en un email de vinos).

CANDIDATOS:
${candidatos.map(c => `- sku:${c.sku} | ${c.name} | $${c.price}`).join('\n')}`,
    }],
  });

  const block = response.content.find(b => b.type === 'text');
  const out = JSON.parse(block.text);
  const porSku = Object.fromEntries(candidatos.map(c => [c.sku, c]));
  const productos = out.seleccion
    .filter(s => porSku[s.sku])
    .map(s => ({
      ...porSku[s.sku],
      motivo: s.motivo,
      url: `${MAGENTO_BASE}/${porSku[s.sku].url_key}.html`,
    }));

  return { productos, criterio: out.criterio };
}

// ── promos vigentes ──────────────────────────────────────────────────────
async function promosVigentes() {
  try {
    const params = [
      'searchCriteria[filterGroups][0][filters][0][field]=is_active',
      'searchCriteria[filterGroups][0][filters][0][value]=1',
      'searchCriteria[pageSize]=20',
    ].join('&');
    const res = await fetchTimeout(`${MAGENTO_BASE}/rest/V1/salesRules/search?${params}`, {
      headers: { Authorization: `Bearer ${MAGENTO_TOKEN}` },
    }, 8000);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const hoy = new Date().toISOString().slice(0, 10);
    const promos = (data.items || [])
      .filter(r => (!r.from_date || r.from_date <= hoy) && (!r.to_date || r.to_date >= hoy))
      .map(r => ({ nombre: r.name, descripcion: r.description || '', accion: r.simple_action, monto: r.discount_amount }));
    return { promos, fuente: 'magento' };
  } catch (e) {
    // El token puede no tener ACL de salesRules — degradar sin romper el wizard
    return { promos: [{ nombre: '6×5 en vinos', descripcion: 'Llevá 6, pagá 5 (la aplica el carrito)' }], fuente: 'default' };
  }
}

// ── listas de LGR (proxy con token server-side) ─────────────────────────
async function listasLgr() {
  if (!LGR_API_URL || !LGR_API_TOKEN) {
    return { error: 'LGR no configurado (faltan LGR_API_URL / LGR_API_TOKEN en Vercel)' };
  }
  const res = await fetchTimeout(`${LGR_API_URL}/api/publico/mkt/listas`, {
    headers: { 'X-LGR-Token': LGR_API_TOKEN, Accept: 'application/json' },
  }, 8000);
  if (!res.ok) return { error: `LGR respondió ${res.status}` };
  return { listas: await res.json() };
}

// ── handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accion } = req.body || {};
  try {
    switch (accion) {
      case 'copys': return res.status(200).json(await sugerirCopys(req.body));
      case 'productos': return res.status(200).json(await elegirProductos(req.body));
      case 'promos': return res.status(200).json(await promosVigentes());
      case 'lgr_listas': return res.status(200).json(await listasLgr());
      default: return res.status(400).json({ error: `Acción desconocida: ${accion}` });
    }
  } catch (err) {
    console.error('assist error', accion, err);
    return res.status(500).json({ error: err.message });
  }
}
