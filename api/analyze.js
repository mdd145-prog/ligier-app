export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const mcKey = process.env.MAILCHIMP_API_KEY;
    const dc = mcKey.split('-').pop();
    const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
    const mcAuth = 'Basic ' + Buffer.from(`anystring:${mcKey}`).toString('base64');
    const mcHeaders = { 'Authorization': mcAuth };

    // 1. Get sent campaigns (last 50)
    const campRes = await fetch(`${mcBase}/campaigns?status=sent&count=50&sort_field=send_time&sort_dir=DESC`, { headers: mcHeaders });
    const campData = await campRes.json();
    const campaigns = campData.campaigns || [];

    if (campaigns.length === 0) {
      return res.status(200).json({ success: true, insights: [], message: 'Todavía no hay campañas enviadas para analizar.' });
    }

    // 2. Get report for each campaign
    const reports = await Promise.all(campaigns.map(async (c) => {
      try {
        const r = await fetch(`${mcBase}/reports/${c.id}`, { headers: mcHeaders });
        const report = await r.json();
        // Parse type and day from title "Ligier · tipo · dia mes"
        const titleParts = (c.settings?.title || '').split('·').map(s => s.trim());
        const tipo = titleParts[1] || 'desconocido';
        const diaMatch = (titleParts[2] || '').split(' ')[0];
        const sendDate = c.send_time ? new Date(c.send_time) : null;
        const diaSemana = sendDate ? ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][sendDate.getDay()] : diaMatch;
        const hora = sendDate ? `${String(sendDate.getHours()).padStart(2,'0')}:${String(sendDate.getMinutes()).padStart(2,'0')}` : null;

        return {
          id: c.id,
          title: c.settings?.title,
          subject: c.settings?.subject_line,
          tipo,
          dia: diaSemana,
          hora,
          emails_sent: report.emails_sent || 0,
          open_rate: report.opens?.open_rate || 0,
          click_rate: report.clicks?.click_rate || 0,
          revenue: report.ecommerce?.total_revenue || 0,
          orders: report.ecommerce?.total_orders || 0,
          // Métricas de engagement y deliverability (antes se descartaban)
          unique_opens: report.opens?.unique_opens || 0,
          unique_clicks: report.clicks?.unique_clicks || 0,
          bounces: (report.bounces?.hard_bounces || 0) + (report.bounces?.soft_bounces || 0),
          unsubscribed: report.unsubscribed || 0,
          abuse: report.abuse_reports || 0,
        };
      } catch(e) { return null; }
    }));

    const valid = reports.filter(Boolean).filter(r => r.emails_sent > 0);

    if (valid.length === 0) {
      return res.status(200).json({ success: true, insights: [], message: 'Las campañas todavía no tienen datos suficientes.' });
    }

    // 3. Aggregate by dimension
    const avg = (arr, key) => arr.length ? arr.reduce((s,x) => s + x[key], 0) / arr.length : 0;
    const sum = (arr, key) => arr.reduce((s,x) => s + x[key], 0);
    const pct = (num, den) => den ? +((num / den) * 100).toFixed(2) : 0;

    // CTOR = clicks únicos / aperturas únicas. Más fiable que el click_rate puro
    // post Apple MPP (que infla las aperturas). Revenue por email normaliza envíos
    // de distinto tamaño. Bounce/unsub/abuse son las métricas que predicen daño
    // a la reputación de envío.
    const metrics = (items) => {
      const sent = sum(items, 'emails_sent');
      return {
        open_rate: +(avg(items, 'open_rate') * 100).toFixed(1),
        click_rate: +(avg(items, 'click_rate') * 100).toFixed(1),
        ctor: pct(sum(items, 'unique_clicks'), sum(items, 'unique_opens')),
        revenue: +sum(items, 'revenue').toFixed(0),
        revenue_por_email: +(sent ? sum(items, 'revenue') / sent : 0).toFixed(1),
        orders: sum(items, 'orders'),
        bounce_rate: pct(sum(items, 'bounces'), sent),
        unsub_rate: pct(sum(items, 'unsubscribed'), sent),
        abuse_rate: pct(sum(items, 'abuse'), sent),
      };
    };

    const groupBy = (key) => {
      const groups = {};
      valid.forEach(r => {
        const k = r[key];
        if (!k || k === 'desconocido') return;
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
      });
      return Object.entries(groups).map(([name, items]) => ({
        name,
        count: items.length,
        ...metrics(items),
      })).sort((a,b) => b.ctor - a.ctor);
    };

    const byTipo = groupBy('tipo');
    const byDia = groupBy('dia');
    const byHora = groupBy('hora');

    // 4. Build recommendations
    const recommendations = {};
    if (byTipo.length) recommendations.mejorTipo = byTipo[0].name;
    if (byDia.length) {
      const bestOpenDay = [...byDia].sort((a,b) => b.open_rate - a.open_rate)[0];
      recommendations.mejorDia = bestOpenDay.name;
    }
    if (byHora.length) recommendations.mejorHora = byHora.sort((a,b) => b.open_rate - a.open_rate)[0].name;

    // 5. Overall stats
    const om = metrics(valid);
    const overall = {
      campañas: valid.length,
      apertura_promedio: om.open_rate,
      click_promedio: om.click_rate,
      ctor: om.ctor,
      revenue_total: om.revenue,
      revenue_por_email: om.revenue_por_email,
      ordenes_total: om.orders,
      bounce_rate: om.bounce_rate,
      unsub_rate: om.unsub_rate,
      abuse_rate: om.abuse_rate,
    };

    // 6. Build human-readable insights
    // Significancia mínima: no afirmar un patrón con menos de 3 campañas en el grupo.
    const MIN = 3;
    const insights = [];
    if (byDia.length >= 2) {
      const best = [...byDia].sort((a,b)=>b.open_rate-a.open_rate)[0];
      if (best.count >= MIN) insights.push(`Los emails del ${best.name} tienen la mejor apertura (${best.open_rate}%).`);
    }
    if (byTipo.length >= 2) {
      const best = byTipo[0];
      if (best.count >= MIN) insights.push(`Los emails de ${best.name} generan más interacción (CTOR ${best.ctor}%).`);
      const bestRev = [...byTipo].filter(t=>t.count>=MIN).sort((a,b)=>b.revenue_por_email-a.revenue_por_email)[0];
      if (bestRev && bestRev.revenue_por_email > 0) insights.push(`${bestRev.name} es el que más factura por email enviado ($${bestRev.revenue_por_email.toLocaleString('es-AR')} c/u).`);
    }
    if (byHora.length >= 2) {
      const best = [...byHora].sort((a,b)=>b.open_rate-a.open_rate)[0];
      if (best.count >= MIN) insights.push(`Enviar a las ${best.name} mejora la apertura.`);
    }
    // Alertas de deliverability (sobre el total)
    if (overall.unsub_rate > 0.5) insights.push(`⚠ La tasa de desuscripción (${overall.unsub_rate}%) está alta — revisá frecuencia y segmentación.`);
    if (overall.abuse_rate > 0.08) insights.push(`⚠ Las quejas de spam (${overall.abuse_rate}%) están sobre el umbral seguro (0,08%).`);
    if (overall.bounce_rate > 1) insights.push(`⚠ El rebote (${overall.bounce_rate}%) está alto — limpiá la lista de direcciones inválidas.`);

    return res.status(200).json({
      success: true,
      overall,
      byTipo,
      byDia,
      byHora,
      recommendations,
      insights,
      topCampaigns: valid.sort((a,b)=>b.click_rate-a.click_rate).slice(0,5).map(c => ({
        title: c.title, subject: c.subject, open_rate: +(c.open_rate*100).toFixed(1), click_rate: +(c.click_rate*100).toFixed(1), revenue: c.revenue
      })),
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
