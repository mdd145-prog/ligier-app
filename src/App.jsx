import { useState } from "react";
import { TITULOS, BAJADAS, SUBJECTS, PREHEADERS } from "./copy-library";

const TIPOS = [
  { id: "vinos", label: "Vinos", icon: "🍷" },
  { id: "whisky", label: "Whisky", icon: "🥃" },
  { id: "espirituosas", label: "Espirituosas", icon: "🍸" },
  { id: "vinos-guardados", label: "Guardados", icon: "🏆" },
  { id: "wine-club", label: "Wine Club", icon: "♣" },
  { id: "experiencias", label: "Experiencias", icon: "✨" },
  { id: "gift-cards", label: "Gift Cards", icon: "🎁" },
];

const RANGOS = ["20-30k", "30-40k", "40-60k", "60-90k", "90-120k", "+120k"];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];


const STEPS = ["Tipo", "Productos", "Accesorio", "Título", "Promos", "Fecha", "Opciones", "Confirmar"];

const PROGRESS_STEPS = [
  "Cargando template...",
  "Consultando productos...",
  "Armando el email...",
  "Creando campaña...",
  "Programando envío...",
];

export default function App() {
  const [view, setView] = useState("home"); // "home" | "create" | "analysis"
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    tipo: "", rango: "", seleccion: "carrito", carrito: "", urls: "",
    accesorio: "auto", accesorioUrl: "",
    titulo: "", tituloCustom: false, bajada: "",
    subject: "", preheader: "",
    tienePromo: true,
    dia: "Miércoles", hora: "10:30",
    modo: "programar", // "programar" | "borrador"
    emailPrueba: "dayanmartin@gmail.com",
    notas: "",
  });
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tituloSearch, setTituloSearch] = useState("");

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedTipo = TIPOS.find(t => t.id === form.tipo);
  const titulosDisponibles = form.tipo ? (TITULOS[form.tipo] || []) : [];
  const titulosFiltrados = tituloSearch
    ? titulosDisponibles.filter(t => t.toLowerCase().includes(tituloSearch.toLowerCase()))
    : titulosDisponibles;
  const bajadasDisponibles = form.tipo ? (BAJADAS[form.tipo] || []) : [];
  const subjectsDisponibles = form.tipo ? (SUBJECTS[form.tipo] || []) : [];
  const preheadersDisponibles = form.tipo ? (PREHEADERS[form.tipo] || []) : [];

  const canNext = () => {
    if (step === 0) return form.tipo !== "";
    if (step === 1) {
      if (form.seleccion === "carrito") return form.carrito !== "";
      if (form.seleccion === "urls") return form.urls.trim() !== "";
      return false;
    }
    if (step === 2) return form.accesorio === "ninguno" || form.accesorio === "auto" || (form.accesorio === "manual" && form.accesorioUrl !== "");
    if (step === 3) return form.titulo !== "";
    if (step === 4) return true;
    if (step === 5) return form.dia !== "" && form.hora !== "";
    if (step === 6) return form.emailPrueba !== "";
    return true;
  };

  const loadAnalysis = async () => {
    setView("analysis");
    setAnalysisLoading(true);
    try {
      const res = await fetch('/api/analyze');
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setAnalysis({ error: err.message });
    }
    setAnalysisLoading(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setLoadingStep(0);
    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, PROGRESS_STEPS.length - 1)), 6000);
    try {
      const res = await fetch('/api/generate-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      clearInterval(interval);
      if (!res.ok || !data.success) { setError(data.error || 'Error desconocido'); setLoading(false); return; }
      setResult(data);
      setLoading(false);
    } catch (err) {
      clearInterval(interval);
      setError(err.message);
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null); setStep(0); setError(null); setTituloSearch(""); setView("home");
    setForm({ tipo: "", rango: "", seleccion: "carrito", carrito: "", urls: "", accesorio: "auto", accesorioUrl: "", titulo: "", tituloCustom: false, bajada: "", subject: "", preheader: "", tienePromo: true, dia: "Miércoles", hora: "10:30", modo: "programar", emailPrueba: "dayanmartin@gmail.com", notas: "" });
  };


  // HOME SCREEN
  if (view === "home") return (
    <div style={s.container}>
      <div style={s.header}><div style={s.logo}>LIGIER</div><div style={s.sub}>Campañas de email</div></div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button style={s.homeBtn} onClick={() => { setView("create"); setStep(0); }}>
          <span style={{ fontSize: 28, marginBottom: 8, display: 'block' }}>✉️</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#111', display: 'block', marginBottom: 4 }}>Crear campaña</span>
          <span style={{ fontSize: 12, color: '#888' }}>Armá y programá un nuevo email</span>
        </button>
        <button style={s.homeBtn} onClick={loadAnalysis}>
          <span style={{ fontSize: 28, marginBottom: 8, display: 'block' }}>📊</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#111', display: 'block', marginBottom: 4 }}>Análisis de campañas</span>
          <span style={{ fontSize: 12, color: '#888' }}>Qué funciona y qué optimizar</span>
        </button>
      </div>
    </div>
  );

  // ANALYSIS SCREEN
  if (view === "analysis") return (
    <div style={s.container}>
      <div style={s.header}><div style={s.logo}>LIGIER</div><div style={s.sub}>Análisis de campañas</div></div>
      <div style={{ padding: 16 }}>
        {analysisLoading && <div style={{ ...s.card, textAlign: 'center', padding: 48 }}><div style={s.spinner} /><p style={s.loadingText}>Analizando campañas...</p></div>}
        {!analysisLoading && analysis?.error && <div style={s.errorBox}>{analysis.error}</div>}
        {!analysisLoading && analysis?.message && <div style={s.card}><p style={{ fontSize: 14, color: '#888', textAlign: 'center' }}>{analysis.message}</p></div>}
        {!analysisLoading && analysis?.overall && <>
          {/* Overall stats */}
          <div style={s.card}>
            <h2 style={s.stepTitle}>Resumen general</h2>
            <div style={s.summaryBox}>
              <div style={s.summaryRow}><span style={s.summaryLabel}>Campañas</span><span style={s.summaryValue}>{analysis.overall.campañas}</span></div>
              <div style={s.summaryRow}><span style={s.summaryLabel}>Apertura prom.</span><span style={s.summaryValue}>{analysis.overall.apertura_promedio}%</span></div>
              <div style={s.summaryRow}><span style={s.summaryLabel}>Click prom.</span><span style={s.summaryValue}>{analysis.overall.click_promedio}%</span></div>
              {analysis.overall.ctor != null && <div style={s.summaryRow}><span style={s.summaryLabel}>CTOR</span><span style={s.summaryValue}>{analysis.overall.ctor}%</span></div>}
              <div style={s.summaryRow}><span style={s.summaryLabel}>Ventas</span><span style={s.summaryValue}>${analysis.overall.revenue_total.toLocaleString('es-AR')}</span></div>
              {analysis.overall.revenue_por_email != null && <div style={s.summaryRow}><span style={s.summaryLabel}>Revenue / email</span><span style={s.summaryValue}>${analysis.overall.revenue_por_email.toLocaleString('es-AR')}</span></div>}
              <div style={s.summaryRow}><span style={s.summaryLabel}>Órdenes</span><span style={s.summaryValue}>{analysis.overall.ordenes_total}</span></div>
              {analysis.overall.bounce_rate != null && <div style={s.summaryRow}><span style={s.summaryLabel}>Rebote</span><span style={s.summaryValue}>{analysis.overall.bounce_rate}%</span></div>}
              {analysis.overall.unsub_rate != null && <div style={s.summaryRow}><span style={s.summaryLabel}>Desuscripción</span><span style={s.summaryValue}>{analysis.overall.unsub_rate}%</span></div>}
              {analysis.overall.abuse_rate != null && <div style={s.summaryRow}><span style={s.summaryLabel}>Quejas spam</span><span style={s.summaryValue}>{analysis.overall.abuse_rate}%</span></div>}
            </div>
          </div>
          {/* Insights */}
          {analysis.insights?.length > 0 && <div style={s.card}>
            <h2 style={s.stepTitle}>Qué aprendimos</h2>
            {analysis.insights.map((ins, i) => (
              <div key={i} style={{ padding: '12px 14px', background: '#f4f1ec', borderRadius: 2, marginBottom: 8, fontSize: 13, color: '#111', lineHeight: 1.5 }}>💡 {ins}</div>
            ))}
          </div>}
          {/* By type */}
          {analysis.byTipo?.length > 0 && <div style={s.card}>
            <h2 style={s.stepTitle}>Por tipo de email</h2>
            <div style={s.summaryBox}>
              {analysis.byTipo.map((t, i) => (
                <div key={i} style={s.summaryRow}>
                  <span style={{ ...s.summaryLabel, textTransform: 'capitalize' }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: '#888' }}>{t.open_rate}% ap · {t.ctor != null ? `${t.ctor}% ctor` : `${t.click_rate}% clk`} · ${t.revenue.toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>
          </div>}
        </>}
        <button style={{ ...s.resetBtn, marginTop: 8 }} onClick={() => setView("home")}>← Volver al inicio</button>
      </div>
    </div>
  );

  if (loading) return (
    <div style={s.container}>
      <div style={s.header}><div style={s.logo}>LIGIER</div><div style={s.sub}>Generando campaña</div></div>
      <div style={{ ...s.card, textAlign: 'center', paddingTop: 48, paddingBottom: 48 }}>
        <div style={s.spinner} />
        <p style={s.loadingText}>{PROGRESS_STEPS[loadingStep]}</p>
        <div style={s.dots}>{PROGRESS_STEPS.map((_, i) => <div key={i} style={{ ...s.dot, background: i <= loadingStep ? '#111' : '#e0e0e0' }} />)}</div>
      </div>
    </div>
  );

  if (result) return (
    <div style={s.container}>
      <div style={s.header}><div style={s.logo}>LIGIER</div></div>
      <div style={s.card}>
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>{result.isDraft ? 'Borrador creado' : 'Campaña programada'}</h2>
        <div style={s.summaryBox}>
          {[
            { label: "Campaña", value: result.campaignName },
            result.isDraft ? null : { label: "Programada", value: new Date(result.scheduleTime).toLocaleString('es-AR') },
            { label: "Prueba enviada a", value: result.testEmail },
            { label: "Productos", value: `${result.productsFound} productos` },
          ].filter(Boolean).map((item, i) => (
            <div key={i} style={s.summaryRow}>
              <span style={s.summaryLabel}>{item.label}</span>
              <span style={s.summaryValue}>{item.value}</span>
            </div>
          ))}
        </div>
        {result.mailchimpUrl && <a href={result.mailchimpUrl} target="_blank" rel="noopener noreferrer" style={s.mcLink}>Ver en Mailchimp →</a>}
        <button style={s.resetBtn} onClick={reset}>Nueva campaña</button>
      </div>
    </div>
  );

  return (
    <div style={s.container}>
      <div style={s.header}><div style={s.logo}>LIGIER</div><div style={s.sub}>Campañas de email</div></div>

      {/* Progress */}
      <div style={s.progress}>
        {STEPS.map((label, i) => (
          <div key={i} style={s.progressItem}>
            <div style={{ ...s.progressDot, background: i <= step ? '#111' : '#e0e0e0', transform: i === step ? 'scale(1.3)' : 'scale(1)' }} />
            <span style={{ ...s.progressLabel, color: i <= step ? '#111' : '#bbb', display: i <= step + 1 ? 'block' : 'none' }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={s.card}>

        {/* STEP 0 — Tipo */}
        {step === 0 && <>
          <h2 style={s.stepTitle}>¿Qué tipo de email?</h2>
          <div style={s.tipoGrid}>
            {TIPOS.map(t => (
              <button key={t.id} style={{ ...s.tipoBtn, background: form.tipo === t.id ? '#111' : '#fff', color: form.tipo === t.id ? '#fff' : '#111', border: `2px solid ${form.tipo === t.id ? '#111' : '#e8e8e8'}` }} onClick={() => update('tipo', t.id)}>
                <span style={{ fontSize: 22 }}>{t.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{t.label}</span>
              </button>
            ))}
          </div>
        </>}

        {/* STEP 1 — Productos */}
        {step === 1 && <>
          <h2 style={s.stepTitle}>¿Cómo elegimos los productos?</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {[
              { id: "carrito", label: "Link del carrito", sub: "Generaste el carrito en el sitio" },
              { id: "urls", label: "URLs de productos", sub: "Pegás los links uno por uno" },
            ].map(m => (
              <button key={m.id} style={{ ...s.modeBtn, background: form.seleccion === m.id ? '#111' : '#fff', color: form.seleccion === m.id ? '#fff' : '#111', border: `2px solid ${form.seleccion === m.id ? '#111' : '#e8e8e8'}` }} onClick={() => update('seleccion', m.id)}>
                <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 2 }}>{m.label}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{m.sub}</span>
              </button>
            ))}
          </div>
          {form.seleccion === 'carrito' && <>
            <label style={s.label}>Link del carrito</label>
            <textarea style={s.textarea} placeholder="https://vinotecaligier.com/compartircarrito/..." value={form.carrito} onChange={e => update('carrito', e.target.value)} rows={3} />
          </>}
          {form.seleccion === 'urls' && <>
            <label style={s.label}>URLs (una por línea)</label>
            <textarea style={s.textarea} placeholder={"https://vinotecaligier.com/producto-1.html\n..."} value={form.urls} onChange={e => update('urls', e.target.value)} rows={7} />
          </>}
          {form.tipo && !['vinos-guardados','wine-club','experiencias'].includes(form.tipo) && <>
            <label style={{ ...s.label, marginTop: 20 }}>Rango de precio (opcional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {RANGOS.map(r => (
                <button key={r} style={{ ...s.rangoBtn, background: form.rango === r ? '#111' : '#fff', color: form.rango === r ? '#fff' : '#111', border: `2px solid ${form.rango === r ? '#111' : '#e8e8e8'}` }} onClick={() => update('rango', r)}>${r}</button>
              ))}
            </div>
          </>}
        </>}

        {/* STEP 2 — Accesorio */}
        {step === 2 && <>
          <h2 style={s.stepTitle}>Artículo complementario</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {[
              { id: "auto", label: "Claude elige automáticamente", sub: "Busca el accesorio más afín a los productos" },
              { id: "manual", label: "Yo elijo el accesorio", sub: "Pegás la URL del producto" },
              { id: "ninguno", label: "Sin accesorio", sub: "El email va sin sección complementaria" },
            ].map(m => (
              <button key={m.id} style={{ ...s.modeBtn, background: form.accesorio === m.id ? '#111' : '#fff', color: form.accesorio === m.id ? '#fff' : '#111', border: `2px solid ${form.accesorio === m.id ? '#111' : '#e8e8e8'}` }} onClick={() => update('accesorio', m.id)}>
                <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 2 }}>{m.label}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{m.sub}</span>
              </button>
            ))}
          </div>
          {form.accesorio === 'manual' && <>
            <label style={s.label}>URL del accesorio</label>
            <input style={s.input} placeholder="https://vinotecaligier.com/accesorio.html" value={form.accesorioUrl} onChange={e => update('accesorioUrl', e.target.value)} />
          </>}
        </>}

        {/* STEP 3 — Título */}
        {step === 3 && <>
          <h2 style={s.stepTitle}>Título del email</h2>
          <input style={{ ...s.input, marginBottom: 16 }} placeholder="Buscar título..." value={tituloSearch} onChange={e => setTituloSearch(e.target.value)} />
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {titulosFiltrados.map((t, i) => (
              <button key={i} style={{ ...s.tituloBtn, background: form.titulo === t ? '#111' : '#fff', color: form.titulo === t ? '#fff' : '#111', border: `1.5px solid ${form.titulo === t ? '#111' : '#e8e8e8'}` }} onClick={() => { update('titulo', t); update('tituloCustom', false); }}>
                {t.split('\n').map((line, j) => <span key={j} style={{ display: 'block', lineHeight: 1.3 }}>{line}</span>)}
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <label style={s.label}>O escribí tu propio título</label>
            <textarea style={s.textarea} placeholder={"Máx 3 líneas · máx 6 palabras por línea\nSin punto final · sin precio ni promo"} rows={3}
              value={form.tituloCustom ? form.titulo : ''}
              onChange={e => { update('titulo', e.target.value); update('tituloCustom', true); }}
            />
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 16 }}>
            <label style={s.label}>Bajada (texto bajo el título)</label>
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {bajadasDisponibles.map((b, i) => (
                <button key={i} style={{ ...s.tituloBtn, background: form.bajada === b ? '#111' : '#fff', color: form.bajada === b ? '#fff' : '#111', border: `1.5px solid ${form.bajada === b ? '#111' : '#e8e8e8'}`, fontSize: 13 }}
                  onClick={() => update('bajada', b)}
                  dangerouslySetInnerHTML={{ __html: b }} />
              ))}
            </div>
            <textarea style={s.textarea} placeholder={"O escribí tu propia bajada (máx 2 líneas)"} rows={2}
              value={form.bajada && !bajadasDisponibles.includes(form.bajada) ? form.bajada.replace(/<br>/g, '\n') : ''}
              onChange={e => update('bajada', e.target.value)}
            />
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 16 }}>
            <label style={s.label}>Asunto del email (lo que se ve en la bandeja)</label>
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {subjectsDisponibles.map((sj, i) => (
                <button key={i} style={{ ...s.tituloBtn, background: form.subject === sj ? '#111' : '#fff', color: form.subject === sj ? '#fff' : '#111', border: `1.5px solid ${form.subject === sj ? '#111' : '#e8e8e8'}`, fontSize: 13 }}
                  onClick={() => update('subject', sj)}>{sj}</button>
              ))}
            </div>
            <textarea style={s.textarea} placeholder={"O escribí tu propio asunto (28–42 caracteres · sin promo)"} rows={2}
              value={form.subject && !subjectsDisponibles.includes(form.subject) ? form.subject : ''}
              onChange={e => update('subject', e.target.value)}
            />
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 16 }}>
            <label style={s.label}>Preheader (texto de preview — complementa el asunto)</label>
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {preheadersDisponibles.map((ph, i) => (
                <button key={i} style={{ ...s.tituloBtn, background: form.preheader === ph ? '#111' : '#fff', color: form.preheader === ph ? '#fff' : '#111', border: `1.5px solid ${form.preheader === ph ? '#111' : '#e8e8e8'}`, fontSize: 13 }}
                  onClick={() => update('preheader', ph)}>{ph}</button>
              ))}
            </div>
            <textarea style={s.textarea} placeholder={"O escribí tu propio preheader (40–90 caracteres · acá sí puede ir la promo)"} rows={2}
              value={form.preheader && !preheadersDisponibles.includes(form.preheader) ? form.preheader : ''}
              onChange={e => update('preheader', e.target.value)}
            />
          </div>
        </>}

        {/* STEP 4 — Promos */}
        {step === 4 && <>
          <h2 style={s.stepTitle}>¿Aplica promoción?</h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.5 }}>¿El total del carrito ya incluye algún descuento o promoción aplicada por Magento?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: true, label: "Sí, hay promoción activa", sub: "Ej: 6x5, descuento porcentual, etc." },
              { id: false, label: "No, precio de lista", sub: "Sin descuentos aplicados" },
            ].map(m => (
              <button key={String(m.id)} style={{ ...s.modeBtn, background: form.tienePromo === m.id ? '#111' : '#fff', color: form.tienePromo === m.id ? '#fff' : '#111', border: `2px solid ${form.tienePromo === m.id ? '#111' : '#e8e8e8'}` }} onClick={() => update('tienePromo', m.id)}>
                <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 2 }}>{m.label}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{m.sub}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <label style={s.label}>Notas adicionales (opcional)</label>
            <textarea style={s.textarea} placeholder="Ej: enfocarse en Malbecs de Altamira..." value={form.notas} onChange={e => update('notas', e.target.value)} rows={3} />
          </div>
        </>}

        {/* STEP 5 — Fecha */}
        {step === 5 && <>
          <h2 style={s.stepTitle}>¿Cuándo se manda?</h2>
          <label style={s.label}>Día</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 8, marginBottom: 20 }}>
            {DIAS.map(d => (
              <button key={d} style={{ ...s.diaBtn, background: form.dia === d ? '#111' : '#fff', color: form.dia === d ? '#fff' : '#111', border: `2px solid ${form.dia === d ? '#111' : '#e8e8e8'}` }} onClick={() => update('dia', d)}>{d.slice(0,3)}</button>
            ))}
          </div>
          <label style={s.label}>Hora</label>
          <input type="time" style={{ ...s.input, marginBottom: 0 }} value={form.hora} onChange={e => update('hora', e.target.value)} />
        </>}

        {/* STEP 6 — Opciones */}
        {step === 6 && <>
          <h2 style={s.stepTitle}>Opciones de envío</h2>
          <label style={s.label}>¿Crear campaña o borrador?</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[
              { id: "programar", label: "Crear y programar", sub: `Se manda el ${form.dia} a las ${form.hora}` },
              { id: "borrador", label: "Solo guardar borrador", sub: "Lo revisás en Mailchimp antes de mandar" },
            ].map(m => (
              <button key={m.id} style={{ ...s.modeBtn, background: form.modo === m.id ? '#111' : '#fff', color: form.modo === m.id ? '#fff' : '#111', border: `2px solid ${form.modo === m.id ? '#111' : '#e8e8e8'}` }} onClick={() => update('modo', m.id)}>
                <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 2 }}>{m.label}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{m.sub}</span>
              </button>
            ))}
          </div>
          <label style={s.label}>Email de prueba</label>
          <input style={s.input} type="email" value={form.emailPrueba} onChange={e => update('emailPrueba', e.target.value)} placeholder="email@ejemplo.com" />
        </>}

        {/* STEP 7 — Confirmar */}
        {step === 7 && <>
          <h2 style={s.stepTitle}>Confirmar</h2>
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.summaryBox}>
            {[
              { label: "Tipo", value: selectedTipo?.label },
              { label: "Selección", value: form.seleccion === 'carrito' ? 'Link de carrito' : 'URLs de productos' },
              { label: "Accesorio", value: form.accesorio === 'auto' ? 'Claude elige' : form.accesorio === 'ninguno' ? 'Sin accesorio' : 'Manual' },
              { label: "Título", value: form.titulo.replace(/\n/g, ' · ') },
              { label: "Asunto", value: form.subject || '(default por tipo)' },
              { label: "Preheader", value: form.preheader || '(default por tipo)' },
              { label: "Promoción", value: form.tienePromo ? 'Sí' : 'No' },
              { label: "Envío", value: form.modo === 'borrador' ? 'Borrador' : `${form.dia} · ${form.hora}` },
              { label: "Email prueba", value: form.emailPrueba },
            ].map((item, i) => (
              <div key={i} style={s.summaryRow}>
                <span style={s.summaryLabel}>{item.label}</span>
                <span style={s.summaryValue}>{item.value}</span>
              </div>
            ))}
          </div>
        </>}
      </div>

      {/* Nav */}
      <div style={s.nav}>
        <button style={s.backBtn} onClick={() => { if (step === 0) { setView('home'); } else { setError(null); setStep(s => s - 1); } }}>← Volver</button>
        {step < STEPS.length - 1
          ? <button style={{ ...s.nextBtn, opacity: canNext() ? 1 : 0.4 }} disabled={!canNext()} onClick={() => setStep(s => s + 1)}>Continuar →</button>
          : <button style={s.nextBtn} onClick={handleSubmit}>
              {form.modo === 'borrador' ? 'Guardar borrador →' : 'Generar y programar →'}
            </button>
        }
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#f4f1ec', fontFamily: 'Georgia, serif', maxWidth: 480, margin: '0 auto', paddingBottom: 40 },
  header: { background: '#111', padding: '28px 24px 24px', textAlign: 'center' },
  logo: { color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: 6, marginBottom: 4 },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  progress: { display: 'flex', justifyContent: 'center', gap: 16, padding: '16px 24px', background: '#fff', borderBottom: '1px solid #eee', overflowX: 'auto' },
  progressItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 40 },
  progressDot: { width: 8, height: 8, borderRadius: '50%', transition: 'all 0.2s' },
  progressLabel: { fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', transition: 'color 0.2s', whiteSpace: 'nowrap' },
  card: { background: '#fff', margin: 16, padding: 24, borderRadius: 2 },
  stepTitle: { fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 20, letterSpacing: -0.5 },
  tipoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  tipoBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s', gap: 6 },
  modeBtn: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 16px', borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' },
  rangoBtn: { padding: '10px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.15s' },
  tituloBtn: { textAlign: 'left', padding: '12px 14px', borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1.4, fontSize: 14, fontWeight: 500 },
  label: { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#aaa', marginBottom: 8 },
  textarea: { width: '100%', padding: 12, border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 13, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', outline: 'none' },
  input: { width: '100%', padding: 12, border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'Georgia, serif' },
  diaBtn: { padding: '10px 4px', borderRadius: 2, cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' },
  summaryBox: { border: '1.5px solid #e8e8e8', borderRadius: 2, overflow: 'hidden' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #f0f0f0' },
  summaryLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#aaa' },
  summaryValue: { fontSize: 12, fontWeight: 700, color: '#111', textAlign: 'right', maxWidth: '60%' },
  nav: { display: 'flex', gap: 10, padding: '0 16px', marginTop: 8 },
  backBtn: { flex: 1, padding: 14, background: '#fff', border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#111' },
  nextBtn: { flex: 2, padding: 14, background: '#111', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', transition: 'opacity 0.15s' },
  errorBox: { background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 2, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#cc0000' },
  spinner: { width: 40, height: 40, border: '3px solid #f0f0f0', borderTop: '3px solid #111', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px' },
  loadingText: { fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 16 },
  dots: { display: 'flex', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: '50%', transition: 'background 0.5s' },
  successIcon: { width: 48, height: 48, background: '#111', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 16, letterSpacing: -0.5 },
  mcLink: { display: 'block', textAlign: 'center', padding: 14, background: '#f4f1ec', color: '#111', fontWeight: 700, fontSize: 13, textDecoration: 'none', borderRadius: 2, marginTop: 16, marginBottom: 10 },
  homeBtn: { width: '100%', background: '#fff', border: '1.5px solid #e8e8e8', borderRadius: 2, padding: '28px 24px', cursor: 'pointer', textAlign: 'center' },
  resetBtn: { width: '100%', padding: 14, background: '#fff', color: '#111', border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
};
