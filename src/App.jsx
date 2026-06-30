import { useState, useEffect } from "react";
import { TITULOS, BAJADAS, SUBJECTS, PREHEADERS } from "./copy-library";

const TIPOS = [
  { id: "vinos", label: "Vinos", icon: "🍷" },
  { id: "whisky", label: "Whisky", icon: "🥃" },
  { id: "espirituosas", label: "Espirituosas", icon: "🍸" },
  { id: "vinos-guardados", label: "Guardados", icon: "🏆" },
  { id: "wine-club", label: "Wine Club", icon: "♣" },
  { id: "experiencias", label: "Experiencias", icon: "✨" },
  { id: "gift-cards", label: "Gift Cards", icon: "🎁" },
  { id: "banner", label: "Banner", icon: "🖼️" },
];

// Pasos que se saltean cuando tipo=banner (no aplica accesorio ni promo)
const BANNER_SKIP_STEPS = [2, 4];

const STEPS = ["Tipo", "Productos", "Accesorio", "Título", "Promos", "Fecha", "Canal", "Opciones", "Vista previa"];

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PROGRESS_STEPS = [
  "Cargando template...",
  "Consultando productos...",
  "Armando el email...",
  "Generando vista previa...",
];

export default function App() {
  const [view, setView] = useState("home"); // "home" | "create"
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm());
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tituloSearch, setTituloSearch] = useState("");
  // v2
  const [extra, setExtra] = useState({ titulo: [], bajada: [], subject: [], preheader: [] }); // sugerencias IA
  const [sugiriendo, setSugiriendo] = useState("");
  const [promos, setPromos] = useState(null);
  const [listasLgr, setListasLgr] = useState(null);
  const [preview, setPreview] = useState(null); // {html, subject, preheader, cartTotal, productsFound}
  const [aprobando, setAprobando] = useState(false);
  const [bannerSource, setBannerSource] = useState("file"); // "file" | "url"
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState(null);

  function initialForm() {
    return {
      tipo: "", cantidad: 6, seleccion: "carrito", carrito: "", urls: "",
      accesorio: "ninguno", accesorioUrl: "",
      bannerImageUrl: "", bannerCtaText: "VER MÁS", bannerCtaUrl: "",
      titulo: "", tituloCustom: false, bajada: "",
      subject: "", preheader: "",
      tienePromo: true,
      fecha: todayLocal(), hora: "17:30",
      canal: "brevo", lista_id: "",
      modo: "programar",
      emailPrueba: "dayanmartin@gmail.com",
      notas: "",
    };
  }

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Navegación con skip automático de pasos que no aplican según tipo
  const nextStep = () => {
    let next = step + 1;
    if (form.tipo === 'banner') {
      while (BANNER_SKIP_STEPS.includes(next)) next++;
    }
    setStep(next);
  };
  const prevStep = () => {
    let prev = step - 1;
    if (form.tipo === 'banner') {
      while (BANNER_SKIP_STEPS.includes(prev)) prev--;
    }
    setStep(prev);
  };
  const selectedTipo = TIPOS.find(t => t.id === form.tipo);
  const titulosDisponibles = form.tipo ? [...(extra.titulo), ...(TITULOS[form.tipo] || [])] : [];
  const titulosFiltrados = tituloSearch
    ? titulosDisponibles.filter(t => t.toLowerCase().includes(tituloSearch.toLowerCase()))
    : titulosDisponibles;
  const bajadasDisponibles = form.tipo ? [...(extra.bajada), ...(BAJADAS[form.tipo] || [])] : [];
  const subjectsDisponibles = form.tipo ? [...(extra.subject), ...(SUBJECTS[form.tipo] || [])] : [];
  const preheadersDisponibles = form.tipo ? [...(extra.preheader), ...(PREHEADERS[form.tipo] || [])] : [];

  const canNext = () => {
    if (step === 0) return form.tipo !== "";
    if (step === 1) {
      if (form.tipo === 'banner') return form.bannerImageUrl.trim() !== '' && form.bannerCtaText.trim() !== '' && form.bannerCtaUrl.trim() !== '';
      if (form.seleccion === "carrito") return form.carrito !== "";
      if (form.seleccion === "urls") return form.urls.trim() !== "";
      return false;
    }
    if (step === 2) return form.accesorio === "ninguno" || (form.accesorio === "manual" && form.accesorioUrl !== "");
    if (step === 3) return form.titulo !== "";
    if (step === 4) return true;
    if (step === 5) return form.fecha !== "" && form.hora !== "";
    if (step === 6) return form.canal === "brevo" || form.canal === "mailchimp" || (form.canal === "lgr" && form.lista_id !== "");
    if (step === 7) return form.canal === "lgr" || form.emailPrueba !== "";
    return true;
  };

  // ── IA: sugerir copys nuevos ──
  const sugerir = async (campo) => {
    setSugiriendo(campo);
    try {
      const res = await fetch("/api/assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "copys", campo, tipo: form.tipo, cantidad: form.cantidad, contexto: form.notas || undefined }),
      });
      const data = await res.json();
      if (data.sugerencias) setExtra(e => ({ ...e, [campo]: [...data.sugerencias, ...e[campo]] }));
    } catch (e) { /* silencioso */ }
    setSugiriendo("");
  };

  // ── Canal: cargar listas LGR ──
  useEffect(() => {
    if (step === 6 && form.canal === "lgr" && !listasLgr) {
      fetch("/api/assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "lgr_listas" }),
      }).then(r => r.json()).then(setListasLgr).catch(() => setListasLgr({ error: "No se pudo conectar con LGR" }));
    }
  }, [step, form.canal]);

  // ── Promos vigentes ──
  useEffect(() => {
    if (step === 4 && !promos) {
      fetch("/api/assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "promos" }),
      }).then(r => r.json()).then(setPromos).catch(() => {});
    }
  }, [step]);

  const buildPayload = (dryRun) => ({ ...form, dryRun });

  const uploadBanner = async (file) => {
    if (!file) return;
    setBannerUploadError(null);
    setBannerUploading(true);
    try {
      const res = await fetch('/api/upload-banner', {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'x-filename': file.name },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo subir la imagen');
      update('bannerImageUrl', data.url);
    } catch (err) {
      setBannerUploadError(err.message);
    }
    setBannerUploading(false);
  };

  // ── Paso final: generar vista previa (dryRun) ──
  const generarPreview = async () => {
    setLoading(true); setError(null); setLoadingStep(0); setPreview(null);
    const interval = setInterval(() => setLoadingStep(s2 => Math.min(s2 + 1, PROGRESS_STEPS.length - 1)), 6000);
    try {
      const res = await fetch("/api/generate-campaign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(true)),
      });
      const data = await res.json();
      clearInterval(interval);
      if (!res.ok || !data.success) { setError(data.error || "Error generando la vista previa"); setLoading(false); return; }
      setPreview(data);
      setLoading(false);
    } catch (err) {
      clearInterval(interval); setError(err.message); setLoading(false);
    }
  };

  useEffect(() => { if (step === 8 && !preview && !loading) generarPreview(); }, [step]);

  // ── Aprobar: envío real ──
  const aprobar = async () => {
    setAprobando(true); setError(null);
    try {
      const res = await fetch("/api/generate-campaign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(false)),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || "Error al crear la campaña"); setAprobando(false); return; }
      setResult(data);
    } catch (err) { setError(err.message); }
    setAprobando(false);
  };

  const reset = () => {
    setResult(null); setStep(0); setError(null); setTituloSearch(""); setView("home");
    setForm(initialForm()); setExtra({ titulo: [], bajada: [], subject: [], preheader: [] });
    setClaudeProds(null); setClaudeSel(new Set()); setPreview(null); setPromos(null);
  };

  const fechaLegible = form.fecha
    ? new Date(form.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    : "";

  // HOME SCREEN
  if (view === "home") return (
    <div style={s.container}>
      <div style={s.header}><div style={s.logo}>LIGIER</div><div style={s.sub}>Campañas de email</div></div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button style={s.homeBtn} onClick={() => { setView("create"); setStep(0); }}>
          <span style={{ fontSize: 28, marginBottom: 8, display: 'block' }}>✉️</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#111', display: 'block', marginBottom: 4 }}>Crear campaña</span>
          <span style={{ fontSize: 12, color: '#888' }}>Armá, previsualizá y programá un email</span>
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div style={s.container}>
      <div style={s.header}><div style={s.logo}>LIGIER</div><div style={s.sub}>Generando vista previa</div></div>
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
            { label: "Canal", value: result.canal === 'lgr' ? 'LGR · base propia (AWS)' : (result.canal === 'mailchimp' ? 'Mailchimp' : 'Brevo') },
            { label: "Campaña", value: result.campaignName },
            result.isDraft || !result.scheduleTime ? null : { label: "Programada", value: new Date(result.scheduleTime).toLocaleString('es-AR') },
            result.testEmail ? { label: "Prueba", value: result.testSent === false ? `✗ falló (${result.testEmail})` : `✓ enviada a ${result.testEmail}` } : null,
            { label: "Productos", value: `${result.productsFound} productos` },
          ].filter(Boolean).map((item, i) => (
            <div key={i} style={s.summaryRow}>
              <span style={s.summaryLabel}>{item.label}</span>
              <span style={s.summaryValue}>{item.value}</span>
            </div>
          ))}
        </div>
        {result.testSent === false && result.testError && (
          <div style={{ ...s.errorBox, marginTop: 12 }}>No salió el email de prueba: {result.testError.slice(0, 240)}</div>
        )}
        {result.brevoUrl && <a href={result.brevoUrl} target="_blank" rel="noopener noreferrer" style={s.mcLink}>Ver en Brevo →</a>}
        {result.mailchimpUrl && <a href={result.mailchimpUrl} target="_blank" rel="noopener noreferrer" style={s.mcLink}>Ver en Mailchimp →</a>}
        {result.lgrUrl && <a href={result.lgrUrl} target="_blank" rel="noopener noreferrer" style={s.mcLink}>Ver en LGR →</a>}
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
        {error && step !== 8 && <div style={s.errorBox}>{error}</div>}

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

        {/* STEP 1 — Banner (cuando tipo=banner) */}
        {step === 1 && form.tipo === 'banner' && <>
          <h2 style={s.stepTitle}>Banner del email</h2>
          <label style={s.label}>Imagen del banner</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[
              { id: 'file', label: 'Subir archivo' },
              { id: 'url', label: 'Pegar URL' },
            ].map(o => (
              <button key={o.id} onClick={() => setBannerSource(o.id)} style={{
                flex: 1, padding: '10px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                background: bannerSource === o.id ? '#111' : '#fff', color: bannerSource === o.id ? '#fff' : '#111',
                border: `2px solid ${bannerSource === o.id ? '#111' : '#e8e8e8'}`,
              }}>{o.label}</button>
            ))}
          </div>
          {bannerSource === 'file' && <>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={e => uploadBanner(e.target.files?.[0])}
              disabled={bannerUploading}
              style={{ width: '100%', padding: 12, border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 13, boxSizing: 'border-box', background: '#fff', marginBottom: 8 }}
            />
            {bannerUploading && <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>Subiendo imagen…</p>}
            {bannerUploadError && <div style={s.errorBox}>{bannerUploadError}</div>}
            <p style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>JPG / PNG / WEBP / GIF · máx 5 MB · ancho recomendado 600px. Se sube a Vercel Blob (URL pública estable).</p>
          </>}
          {bannerSource === 'url' && <>
            <input style={s.input} type="url" placeholder="https://i.imgur.com/abc.jpg" value={form.bannerImageUrl} onChange={e => update('bannerImageUrl', e.target.value)} />
            <p style={{ fontSize: 11, color: '#888', marginTop: -8, marginBottom: 16 }}>Subí la imagen a Mailchimp / Imgur / Drive público y pegá la URL acá. Ancho recomendado: 600px.</p>
          </>}
          {form.bannerImageUrl && (
            <div style={{ marginBottom: 16, padding: 8, background: '#f4f1ec', borderRadius: 2 }}>
              <img src={form.bannerImageUrl} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }} onError={e => e.target.style.display = 'none'} />
              <p style={{ fontSize: 10, color: '#888', wordBreak: 'break-all', marginTop: 6 }}>{form.bannerImageUrl}</p>
            </div>
          )}
          <label style={s.label}>Texto del botón (CTA)</label>
          <input style={s.input} placeholder="VER MÁS" value={form.bannerCtaText} onChange={e => update('bannerCtaText', e.target.value)} />
          <label style={s.label}>URL a la que lleva el botón</label>
          <input style={s.input} type="url" placeholder="https://vinotecaligier.com/..." value={form.bannerCtaUrl} onChange={e => update('bannerCtaUrl', e.target.value)} />
        </>}

        {/* STEP 1 — Productos (resto de tipos) */}
        {step === 1 && form.tipo !== 'banner' && <>
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
        </>}

        {/* STEP 2 — Accesorio */}
        {step === 2 && <>
          <h2 style={s.stepTitle}>Artículo complementario</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {[
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

        {/* STEP 3 — Título / bajada / subject / preheader, todos con "sugerir nuevos" */}
        {step === 3 && <>
          <h2 style={s.stepTitle}>Título del email</h2>
          <label style={s.label}>¿Cuántas botellas mencionar en el título?</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
            {[1, 2, 3, 6].map(n => (
              <button key={n} style={{ ...s.rangoBtn, background: form.cantidad === n ? '#111' : '#fff', color: form.cantidad === n ? '#fff' : '#111', border: `2px solid ${form.cantidad === n ? '#111' : '#e8e8e8'}` }} onClick={() => update('cantidad', n)}>{n}</button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>Solo afecta los <strong>títulos sugeridos</strong> (singular/plural coherente). La promo 6×5 y los productos los toma del carrito real.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input style={{ ...s.input, marginBottom: 0, flex: 1 }} placeholder="Buscar título..." value={tituloSearch} onChange={e => setTituloSearch(e.target.value)} />
            <button style={s.sugerirBtn} disabled={sugiriendo === 'titulo'} onClick={() => sugerir('titulo')}>{sugiriendo === 'titulo' ? '…' : '✨ Sugerir nuevos'}</button>
          </div>
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
            <div style={s.labelRow}><label style={s.label}>Bajada (texto bajo el título)</label>
              <button style={s.sugerirBtn} disabled={sugiriendo === 'bajada'} onClick={() => sugerir('bajada')}>{sugiriendo === 'bajada' ? '…' : '✨'}</button></div>
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
            <div style={s.labelRow}><label style={s.label}>Asunto del email (lo que se ve en la bandeja)</label>
              <button style={s.sugerirBtn} disabled={sugiriendo === 'subject'} onClick={() => sugerir('subject')}>{sugiriendo === 'subject' ? '…' : '✨'}</button></div>
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
            <div style={s.labelRow}><label style={s.label}>Preheader (texto de preview — complementa el asunto)</label>
              <button style={s.sugerirBtn} disabled={sugiriendo === 'preheader'} onClick={() => sugerir('preheader')}>{sugiriendo === 'preheader' ? '…' : '✨'}</button></div>
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

        {/* STEP 4 — Promos (sin notas — pasaron a Productos→Claude) */}
        {step === 4 && <>
          <h2 style={s.stepTitle}>¿Aplica promoción?</h2>
          {promos?.promos?.length > 0 && (
            <div style={{ background: '#f4f1ec', borderRadius: 2, padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ ...s.label, marginBottom: 8 }}>Promociones vigentes {promos.fuente === 'magento' ? 'en Magento' : ''}</p>
              {promos.promos.map((p, i) => (
                <p key={i} style={{ fontSize: 13, color: '#111', margin: '4px 0' }}>· <strong>{p.nombre}</strong>{p.descripcion ? ` — ${p.descripcion}` : ''}</p>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: true, label: "Sí, hay promoción activa", sub: "El total del pack se lee del carrito real (con el descuento aplicado)" },
              { id: false, label: "No, precio de lista", sub: "Sin descuentos aplicados" },
            ].map(m => (
              <button key={String(m.id)} style={{ ...s.modeBtn, background: form.tienePromo === m.id ? '#111' : '#fff', color: form.tienePromo === m.id ? '#fff' : '#111', border: `2px solid ${form.tienePromo === m.id ? '#111' : '#e8e8e8'}` }} onClick={() => update('tienePromo', m.id)}>
                <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 2 }}>{m.label}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{m.sub}</span>
              </button>
            ))}
          </div>
        </>}

        {/* STEP 5 — Fecha (calendario) */}
        {step === 5 && <>
          <h2 style={s.stepTitle}>¿Cuándo se manda?</h2>
          <label style={s.label}>Fecha</label>
          <input type="date" style={{ ...s.input, marginBottom: 4 }} value={form.fecha}
            min={new Date().toISOString().slice(0, 10)}
            onChange={e => update('fecha', e.target.value)} />
          {fechaLegible && <p style={{ fontSize: 12, color: '#888', marginBottom: 16, textTransform: 'capitalize' }}>{fechaLegible}</p>}
          <label style={s.label}>Hora</label>
          <input type="time" style={{ ...s.input, marginBottom: 0 }} value={form.hora} onChange={e => update('hora', e.target.value)} />
        </>}

        {/* STEP 6 — Canal de envío (NUEVO) */}
        {step === 6 && <>
          <h2 style={s.stepTitle}>¿Por qué canal sale?</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {[
              { id: "brevo", label: "Brevo", sub: "Sender principal — base actualizada, métricas en Brevo" },
              { id: "mailchimp", label: "Mailchimp", sub: "Transitorio hasta dar de baja la cuenta — audiencia histórica" },
              { id: "lgr", label: "LGR · base propia", sub: "Sale por AWS a nuestra base (38.950 suscriptos), con métricas propias" },
            ].map(m => (
              <button key={m.id} style={{ ...s.modeBtn, background: form.canal === m.id ? '#111' : '#fff', color: form.canal === m.id ? '#fff' : '#111', border: `2px solid ${form.canal === m.id ? '#111' : '#e8e8e8'}` }} onClick={() => update('canal', m.id)}>
                <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 2 }}>{m.label}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{m.sub}</span>
              </button>
            ))}
          </div>
          {form.canal === 'lgr' && <>
            <label style={s.label}>Lista / segmento destinatario *</label>
            {!listasLgr && <p style={{ fontSize: 13, color: '#888' }}>Cargando listas de LGR…</p>}
            {listasLgr?.error && <div style={s.errorBox}>{listasLgr.error}</div>}
            {listasLgr?.listas && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {listasLgr.listas.map(l => (
                  <button key={l.id} style={{ ...s.modeBtn, background: String(form.lista_id) === String(l.id) ? '#111' : '#fff', color: String(form.lista_id) === String(l.id) ? '#fff' : '#111', border: `2px solid ${String(form.lista_id) === String(l.id) ? '#111' : '#e8e8e8'}` }} onClick={() => update('lista_id', l.id)}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{l.tipo === 'dinamica' ? '⚡' : '📋'} {l.nombre}</span>
                    <span style={{ fontSize: 11, opacity: 0.7, display: 'block' }}>{l.aptos_envio.toLocaleString('es-AR')} contactos aptos</span>
                  </button>
                ))}
              </div>
            )}
          </>}
        </>}

        {/* STEP 7 — Opciones */}
        {step === 7 && <>
          <h2 style={s.stepTitle}>Opciones de envío</h2>
          <label style={s.label}>¿Programar o guardar borrador?</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[
              { id: "programar", label: "Crear y programar", sub: `Se manda el ${fechaLegible || form.fecha} a las ${form.hora}` },
              { id: "borrador", label: "Solo guardar borrador", sub: form.canal === 'lgr' ? "Lo revisás en LGR antes de mandar" : (form.canal === 'mailchimp' ? "Lo revisás en Mailchimp antes de mandar" : "Lo revisás en Brevo antes de mandar") },
            ].map(m => (
              <button key={m.id} style={{ ...s.modeBtn, background: form.modo === m.id ? '#111' : '#fff', color: form.modo === m.id ? '#fff' : '#111', border: `2px solid ${form.modo === m.id ? '#111' : '#e8e8e8'}` }} onClick={() => update('modo', m.id)}>
                <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 2 }}>{m.label}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{m.sub}</span>
              </button>
            ))}
          </div>
          {(form.canal === 'brevo' || form.canal === 'mailchimp') && <>
            <label style={s.label}>Email de prueba</label>
            <input style={s.input} type="email" value={form.emailPrueba} onChange={e => update('emailPrueba', e.target.value)} placeholder="email@ejemplo.com" />
          </>}
        </>}

        {/* STEP 8 — Vista previa + Aprobar */}
        {step === 8 && <>
          <h2 style={s.stepTitle}>Vista previa</h2>
          {error && <div style={s.errorBox}>{error}</div>}
          {preview && <>
            <div style={s.summaryBox}>
              {[
                { label: "Canal", value: form.canal === 'lgr' ? 'LGR · base propia' : (form.canal === 'mailchimp' ? 'Mailchimp' : 'Brevo') },
                { label: "Asunto", value: preview.subject },
                { label: "Preheader", value: preview.preheader },
                { label: "Productos", value: `${preview.productsFound}` },
                preview.cartTotal ? { label: "Total del pack", value: preview.cartTotal } : null,
                { label: "Envío", value: form.modo === 'borrador' ? 'Borrador' : `${fechaLegible} · ${form.hora}` },
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={s.summaryRow}>
                  <span style={s.summaryLabel}>{item.label}</span>
                  <span style={s.summaryValue}>{item.value}</span>
                </div>
              ))}
            </div>
            <div style={{ border: '1.5px solid #e8e8e8', borderRadius: 2, marginTop: 16, height: 480, overflow: 'hidden' }}>
              <iframe title="preview" srcDoc={preview.html} style={{ width: '100%', height: '100%', border: 'none' }} sandbox="" />
            </div>
            <button style={{ ...s.nextBtn, width: '100%', marginTop: 16, opacity: aprobando ? 0.5 : 1 }} disabled={aprobando} onClick={aprobar}>
              {aprobando ? 'Creando campaña…' : form.modo === 'borrador' ? '✓ Aprobar y guardar borrador' : '✓ Aprobar y programar'}
            </button>
            <button style={{ ...s.resetBtn, marginTop: 8 }} disabled={loading} onClick={generarPreview}>↻ Regenerar vista previa</button>
          </>}
          {!preview && !loading && error && (
            <button style={{ ...s.resetBtn, marginTop: 8 }} onClick={generarPreview}>↻ Reintentar</button>
          )}
        </>}
      </div>

      {/* Nav */}
      <div style={s.nav}>
        <button style={s.backBtn} onClick={() => { if (step === 0) { setView('home'); } else { setError(null); if (step === 8) setPreview(null); prevStep(); } }}>← Volver</button>
        {step < STEPS.length - 1 && (
          <button style={{ ...s.nextBtn, opacity: canNext() ? 1 : 0.4 }} disabled={!canNext()} onClick={nextStep}>
            {step === STEPS.length - 2 ? 'Generar vista previa →' : 'Continuar →'}
          </button>
        )}
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
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sugerirBtn: { padding: '8px 12px', background: '#fff', border: '1.5px solid #111', borderRadius: 2, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#111', whiteSpace: 'nowrap' },
  textarea: { width: '100%', padding: 12, border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 13, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', outline: 'none' },
  input: { width: '100%', padding: 12, border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'Georgia, serif' },
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
