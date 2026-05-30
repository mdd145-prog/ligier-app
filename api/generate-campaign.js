export const config = { maxDuration: 60 };

const GITHUB_RAW = 'https://raw.githubusercontent.com/mdd145-prog/mailchimp/main/templates/';

const TEMPLATES = {
  'vinos':           'base-email-vinos.html',
  'whisky':          'base-email-whisky.html',
  'espirituosas':    'base-email-vinos.html',
  'vinos-guardados': 'base-email-guardados.html',
  'wine-club':       'base-email-vinos.html',
  'experiencias':    'base-email-vinos.html',
  'gift-cards':      'base-email-vinos.html',
};

const HERO_TITLES = {
  'vinos': [
    'Esta semana,<br>elegimos seis.',
    'Difícil<br>quedarse<br>con uno solo.',
    'Seis etiquetas<br>que conocemos<br>de memoria.',
    'Los que<br>guardamos<br>para vos.',
    'Una selección<br>que vale<br>cada peso.',
  ],
  'whisky': [
    'Destilados<br>que cuentan<br>su historia.',
    'Single malts<br>y blends<br>de carácter.',
    'Esta semana,<br>elegimos<br>lo mejor.',
  ],
  'vinos-guardados': [
    'Algunos vinos<br>no vuelven.',
    'El tiempo<br>hizo el trabajo.',
    'Una cava.<br>Décadas.<br>Esta selección.',
    'Lo que el tiempo<br>construyó.',
    'Botellas que<br>ya no se repiten.',
  ],
  'espirituosas': [
    'Para armar<br>tu barra<br>en serio.',
    'Alta graduación,<br>carácter propio.',
  ],
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

async function getMagentoProduct(sku) {
  const baseUrl = process.env.MAGENTO_BASE_URL || 'https://vinotecaligier.com';
  const token = process.env.MAGENTO_ACCESS_TOKEN;
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/rest/V1/products/${encodeURIComponent(sku)}`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } },
      8000
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data.price;
    const mediaEntries = data.media_gallery_entries || [];
    const mainImage = mediaEntries.find(e => e.types?.includes('image')) || mediaEntries[0];
    const image = mainImage ? `${baseUrl}/media/catalog/product${mainImage.file}` : null;
    const shortDesc = data.custom_attributes?.find(a => a.attribute_code === 'short_description');
    const description = shortDesc ? shortDesc.value.replace(/<[^>]+>/g, '').trim().slice(0, 200) : '';
    const urlKey = data.custom_attributes?.find(a => a.attribute_code === 'url_key');
    const productUrl = urlKey ? `${baseUrl}/${urlKey.value}.html` : `${baseUrl}/catalogsearch/result/?q=${sku}`;
    return { sku, name: data.name, price, image, description, url: productUrl, inStock: data.status === 1 };
  } catch(e) {
    console.error('Magento error for SKU', sku, ':', e.message);
    return null;
  }
}

function buildProductBlock(product, index, isLast, tipo) {
  const hasPromo = ['vinos', 'espirituosas'].includes(tipo);
  const price = product.price ? parseFloat(product.price) : 0;
  const promoPrice = Math.round(price * 5 / 6);
  const priceFormatted = price.toLocaleString('es-AR');
  const promoPriceFormatted = promoPrice.toLocaleString('es-AR');

  const separator = isLast ? '' : `
        <tr><td colspan="2" style="padding-bottom:0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td height="1" bgcolor="#f0f0f0" style="font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr><td height="24" style="font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
        </td></tr>`;

  const priceBlock = hasPromo ? `
            <p style="font-size:12px; color:#aaa; text-decoration:line-through; margin:0 0 2px 0;">$${priceFormatted}</p>
            <p style="font-size:22px; font-weight:700; color:#111; line-height:1; margin:0 0 2px 0;">$${promoPriceFormatted}</p>
            <p style="font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin:0 0 10px 0;">c/u comprando 6</p>` :
    `<p style="font-size:18px; font-weight:700; color:#111; margin:0 0 14px 0;">$${priceFormatted}</p>`;

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
            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">[CEPA] · [REGIÓN] · [PROVINCIA]</p>
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

function injectProductsIntoTemplate(template, products, cartLink, cartTotal, tipo, mes) {
  let result = template;

  // 1. Update title
  const monthYear = mes.toUpperCase();
  result = result.replace(
    /(<p[^>]*color:#666[^>]*>)[^<]+(·[^<]+)?(<\/p>)/,
    `$1${tipo.toUpperCase().replace('-', ' ')} · ${monthYear}$3`
  );

  // 2. Update hero H1 with selected title
  const title = titulo ? titulo.replace(/\n/g, '<br>') : (HERO_TITLES[tipo] || HERO_TITLES['vinos'])[0].replace(/\n/g, '<br>');
  result = result.replace(
    /(<h1[^>]*>)[\s\S]*?(<\/h1>)/,
    `<h1 class="hero-h1" style="font-size:34px; font-weight:700; letter-spacing:-1px; color:#ffffff; margin:0 0 16px 0; line-height:1.15;">${title}</h1>`
  );

  // 3. Replace products section
  const prodStart = result.indexOf('<!-- Producto 1 -->');
  const prodEnd = result.indexOf('<!-- ── 4b.');
  if (prodStart !== -1 && prodEnd !== -1) {
    const productsHtml = products.map((p, i) => buildProductBlock(p, i, i === products.length - 1, tipo)).join('\n');
    result = result.substring(0, prodStart) + productsHtml + '\n    ' + result.substring(prodEnd);
  }

  // 4. Update cart links
  if (cartLink) {
    result = result.replace(/https:\/\/vinotecaligier\.com\/compartircarrito\/index\/share\/data\/[^"]+/g, cartLink);
  }

  // 5. Update cart total
  if (cartTotal) {
    result = result.replace(
      /Total 6x5: \$[\d\.,]+/g,
      `Total 6x5: ${cartTotal}`
    );
  }

  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, seleccion, carrito, urls, rango, dia, hora, notas, titulo, accesorio, accesorioUrl, tienePromo, modo, emailPrueba } = req.body;
  const mes = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  try {
    // ── Step 1: Load template from GitHub ──
    const templateFile = TEMPLATES[tipo] || 'base-email-vinos.html';
    const templateRes = await fetchWithTimeout(GITHUB_RAW + templateFile, {}, 8000);
    if (!templateRes.ok) throw new Error('No se pudo cargar el template');
    const baseTemplate = await templateRes.text();

    // ── Step 2: Get SKUs from cart link ──
    let skuList = [];
    let cartLink = carrito?.trim();

    if (seleccion === 'carrito' && cartLink) {
      const base64 = cartLink.split('/data/')[1]?.replace(/\/$/, '');
      if (base64) {
        try {
          skuList = JSON.parse(Buffer.from(base64, 'base64').toString());
        } catch(e) {}
      }
    }

    // ── Step 3: Get product data from Magento API ──
    let products = [];
    if (skuList.length > 0) {
      const results = await Promise.all(skuList.map(s => getMagentoProduct(s.sku)));
      products = results.filter(p => p && p.inStock && p.image);
      console.log(`Got ${products.length} products from Magento`);
    }

    if (products.length === 0) {
      return res.status(400).json({ error: 'No se pudieron obtener los productos del carrito. Verificá el link.' });
    }

    // ── Step 4: Get cart total ──
    let cartTotal = null;
    if (cartLink) {
      try {
        const cartRes = await fetchWithTimeout(cartLink, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8000);
        const cartHtml = await cartRes.text();
        // Extract grand total from Magento cart: <tr class="grand totals"> > <span class="price">
        const grandTotal = cartHtml.match(/class="grand totals"[\s\S]*?class="price"[^>]*>([^<]+)<\/span>/);
        if (grandTotal) {
          cartTotal = grandTotal[1].trim();
        } else {
          // Fallback: last price on the page
          const allPrices = cartHtml.match(/\$[\d]{2,3}(?:\.[\d]{3})+/g);
          cartTotal = allPrices ? allPrices[allPrices.length - 1] : null;
        }
      } catch(e) {}
    }

    // ── Step 5: Inject products into template ──
    const emailHtml = injectProductsIntoTemplate(baseTemplate, products, cartLink, cartTotal, tipo, mes);

    if (!emailHtml.includes('<!DOCTYPE')) {
      return res.status(500).json({ error: 'Error generando el email' });
    }

    // ── Step 6: Create Mailchimp campaign ──
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

    // Send test email
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
        method: 'POST', headers: mcHeaders,
        body: JSON.stringify({ schedule_time: scheduleTime })
      });
    }

    return res.status(200).json({
      success: true,
      campaignId: campaign.id,
      campaignName: campaignTitle,
      scheduleTime,
      isDraft: modo === 'borrador',
      testEmail,
      webId: campaign.web_id,
      productsFound: products.length,
      mailchimpUrl: `https://mc.us1.mailchimp.com/campaigns/show?id=${campaign.web_id}`
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
