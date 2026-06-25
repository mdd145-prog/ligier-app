// POST /api/send-transactional
// Endpoint para envíos transaccionales 1:1 (Recompra, Bienvenida, Dormidos,
// NPS, etc.). Reusa los templates del repo Mailing pero con flujo simplificado:
// sin promo, sin pack, sin accesorio, sin programación. Manda con Brevo SMTP.
//
// Diseño en docs/diseno-n8n-marketing-orquestacion.md (LGR repo).
//
// Body esperado:
// {
//   "recipientEmail": "ana@cliente.com",      (requerido)
//   "recipientName":  "Ana Pérez",            (opcional)
//   "fname":          "Ana",                  (opcional, default = primer palabra de recipientName)
//   "template":       "vinos",                (vinos | whisky | guardados; default = vinos)
//   "subject":        "Ana, ¿repetimos?",     (requerido)
//   "preheader":      "Tu carrito te espera", (opcional, default = subject)
//   "titulo":         "Ana,\n¿repetimos\npedido?", (requerido, soporta \n)
//   "bajada":         "Te armamos el carrito con tus productos preferidos.", (opcional)
//   "eyebrow":        "RECOMPRA · LIGIER",    (opcional, default = "VINOTECA LIGIER")
//   "ctaText":        "REPETIR MI COMPRA",    (opcional)
//   "ctaUrl":         "https://vinotecaligier.com/...", (opcional)
//   "skus":           ["BE77849","BE72259","PR0011"],   (opcional, 0..6; si vacío no hay sección productos)
//   "modo":           "envio"                 (envio | dry; default envio; dry no manda y devuelve HTML)
// }
//
// Auth: el endpoint NO valida token. Está pensado para que solo n8n lo llame
// desde la red privada. Si en producción se expone, hay que sumar header
// X-LGR-Token o similar.

export const config = { maxDuration: 30 };

import { fetchTemplate, injectTransactional, getMagentoProduct, getProductsByCategory } from '../lib/render.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }

  try {
    const {
      recipientEmail,
      recipientName,
      fname,
      template = 'vinos',
      subject,
      preheader,
      titulo,
      bajada,
      eyebrow,
      ctaText,
      ctaUrl,
      skus = [],
      // --- Selección variada por categoría + rango de precio ---
      categoria,         // 'vinos' | 'vinos-guardados' | 'whisky' | ... (clave de CATEGORIAS)
      priceMin,          // número (ARS) — opcional
      priceMax,          // número (ARS) — opcional
      productCount,      // cantidad total de productos (1..6); default según skus/categoria
      excludeSkus,       // SKUs a excluir de la búsqueda por categoría
      modo = 'envio',
    } = req.body || {};

    if (!recipientEmail) return res.status(400).json({ error: 'Falta recipientEmail' });
    if (!subject) return res.status(400).json({ error: 'Falta subject' });
    if (!titulo) return res.status(400).json({ error: 'Falta titulo' });

    const finalFname = fname || (recipientName ? recipientName.split(' ')[0] : '');
    const finalEyebrow = eyebrow || 'VINOTECA LIGIER';
    const finalPreheader = preheader || subject;
    const isGuardados = template === 'guardados';

    // 1. Armado de productos. Tres modos posibles:
    //   (a) skus manual            → traer esos exactos (uso de prueba o carrito fijo)
    //   (b) categoria + rango      → N variados de la categoría en ese rango (Recompra T1, Bienvenida, Dormidos)
    //   (c) skus + categoria       → el carrito arriba + (productCount - skus.length) variados (Recompra T2)
    // Si no viene NI skus NI categoria → sin productos (NPS).
    const skusManual = (Array.isArray(skus) ? skus : []).filter(Boolean).slice(0, 6);
    const skusRequested = skusManual.length;
    const totalCount = Math.min(productCount || (categoria ? 6 : skusRequested), 6);
    let products = [];
    let productsFromCategory = 0;

    if (skusManual.length) {
      const fromSkus = (await Promise.all(skusManual.map(getMagentoProduct))).filter(Boolean);
      products = products.concat(fromSkus);
    }

    if (categoria && products.length < totalCount) {
      const need = totalCount - products.length;
      const allExclude = [
        ...(Array.isArray(excludeSkus) ? excludeSkus : []),
        ...skusManual,           // no duplicar lo del carrito
        ...products.map(p => p.sku),
      ];
      const fromCat = await getProductsByCategory(categoria, {
        count: need,
        priceMin: priceMin != null ? Number(priceMin) : undefined,
        priceMax: priceMax != null ? Number(priceMax) : undefined,
        excludeSkus: allExclude,
      });
      products = products.concat(fromCat);
      productsFromCategory = fromCat.length;
    }

    // 2. Descargar template + inyectar
    const tpl = await fetchTemplate(template);
    const html = injectTransactional(tpl, {
      eyebrow: finalEyebrow,
      titulo,
      bajada: bajada || '',
      products,
      ctaText: ctaText || 'VER MI CARRITO',
      ctaUrl: ctaUrl || 'https://vinotecaligier.com',
      isGuardados,
    });

    // 3. Modo dry: devolver HTML sin mandar
    if (modo === 'dry') {
      return res.status(200).json({
        success: true,
        modo: 'dry',
        recipientEmail,
        subject,
        productsFound: products.length,
        productsFromSkus: products.length - productsFromCategory,
        productsFromCategory,
        skusRequested,
        skus: products.map(p => p.sku),
        htmlPreview: html.substring(0, 500) + '...',
        htmlLength: html.length,
      });
    }

    // 4. Envío via Brevo /v3/smtp/email
    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) return res.status(500).json({ error: 'Falta BREVO_API_KEY en el entorno' });

    // Brevo /smtp/email exige `name` no vacío en `to`. Fallback al fname o al
    // local-part del email para que el envío nunca falle por eso.
    const safeName = (recipientName && recipientName.trim())
      || (finalFname && finalFname.trim())
      || (recipientEmail ? recipientEmail.split('@')[0] : 'Cliente');

    const brevoBody = {
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'Vinoteca Ligier',
        email: process.env.BREVO_SENDER_EMAIL || 'hola@news.vinotecaligier.com',
      },
      // replyTo apunta a un email REAL que sí recibe. news.vinotecaligier.com
      // es solo dominio de envío DKIM (sin MX), si el cliente le responde se
      // bouncea. ventas@ligier.com.ar es el canal de respuesta del área.
      replyTo: {
        name: 'Vinoteca Ligier',
        email: process.env.BREVO_REPLY_TO || 'ventas@ligier.com.ar',
      },
      to: [{ email: recipientEmail, name: safeName }],
      subject,
      htmlContent: html,
    };

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'accept': 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(brevoBody),
    });

    const brevoData = await brevoRes.json().catch(() => ({}));
    if (!brevoRes.ok) {
      return res.status(502).json({ error: 'Brevo rechazó el envío', detail: brevoData });
    }

    return res.status(200).json({
      success: true,
      recipientEmail,
      subject,
      messageId: brevoData.messageId,
      productsFound: products.length,
      productsFromSkus: products.length - productsFromCategory,
      productsFromCategory,
      skusRequested,
      skus: products.map(p => p.sku),
    });

  } catch (e) {
    console.error('send-transactional error:', e);
    return res.status(500).json({ error: e.message });
  }
}
