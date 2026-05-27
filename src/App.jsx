import { useState } from "react";

const TIPOS = [
  { id: "vinos", label: "Vinos", icon: "🍷", url: "https://vinotecaligier.com/vino" },
  { id: "whisky", label: "Whisky", icon: "🥃", url: "https://vinotecaligier.com/whisky" },
  { id: "espirituosas", label: "Espirituosas", icon: "🍸", url: "https://vinotecaligier.com/espirituosas" },
  { id: "vinos-guardados", label: "Guardados", icon: "🏆", url: "https://vinotecaligier.com/vinos-guardados" },
  { id: "wine-club", label: "Wine Club", icon: "♣", url: "https://vinotecaligier.com/contenido-wineclub" },
  { id: "experiencias", label: "Experiencias", icon: "✨", url: "https://vinotecaligier.com/contenido-experiencias" },
  { id: "gift-cards", label: "Gift Cards", icon: "🎁", url: "https://vinotecaligier.com/gift-card-ligier.html" },
];

const RANGOS = ["20-30k", "30-40k", "40-60k", "60-90k", "90-120k", "+120k"];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const STEPS = ["Tipo", "Selección", "Fecha", "Confirmar"];

const PROGRESS_STEPS = [
  "Buscando productos...",
  "Generando email...",
  "Creando campaña...",
  "Programando envío...",
  "Enviando prueba...",
];

export default function App() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ tipo: "", rango: "", seleccion: "carrito", carrito: "", urls: "", dia: "Miércoles", hora: "10:30", notas: "" });
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const selectedTipo = TIPOS.find(t => t.id === form.tipo);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canNext = () => {
    if (step === 0) return form.tipo !== "";
    if (step === 1) {
      if (form.seleccion === "auto") return form.rango !== "";
      if (form.seleccion === "carrito") return form.carrito !== "";
      if (form.seleccion === "urls") return form.urls.trim() !== "";
    }
    if (step === 2) return form.dia !== "" && form.hora !== "";
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setLoadingStep(0);

    const interval = setInterval(() => {
      setLoadingStep(s => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, 8000);

    try {
      const res = await fetch('/api/generate-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      clearInterval(interval);
      if (!res.ok || !data.success) {
        setError(data.error || 'Error desconocido');
        setLoading(false);
        return;
      }
      setResult(data);
      setLoading(false);
    } catch (err) {
      clearInterval(interval);
      setError(err.message);
      setLoading(false);
    }
  };

  // Loading screen
  if (loading) return (
    <div style={s.container}>
      <div style={s.header}><div style={s.logo}>LIGIER</div><div style={s.headerSub}>Generando campaña</div></div>
      <div style={{ ...s.card, textAlign: 'center', paddingTop: 48, paddingBottom: 48 }}>
        <div style={s.spinner} />
        <p style={s.loadingText}>{PROGRESS_STEPS[loadingStep]}</p>
        <div style={s.dots}>
          {PROGRESS_STEPS.map((_, i) => (
            <div key={i} style={{ ...s.dot, background: i <= loadingStep ? '#111' : '#e0e0e0' }} />
          ))}
        </div>
        <p style={s.loadingNote}>Esto puede tardar hasta 60 segundos</p>
      </div>
    </div>
  );

  // Success screen
  if (result) return (
    <div style={s.container}>
      <div style={s.header}><div style={s.logo}>LIGIER</div></div>
      <div style={s.card}>
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>Campaña lista</h2>
        <div style={s.summaryBox}>
          {[
            { label: "Campaña", value: result.campaignName },
            { label: "Programada", value: new Date(result.scheduleTime).toLocaleString('es-AR') },
            { label: "Prueba enviada a", value: "dayanmartin@gmail.com" },
          ].map((item, i) => (
            <div key={i} style={s.summaryRow}>
              <span style={s.summaryLabel}>{item.label}</span>
              <span style={s.summaryValue}>{item.value}</span>
            </div>
          ))}
        </div>
        {result.mailchimpUrl && (
          <a href={result.mailchimpUrl} target="_blank" rel="noopener noreferrer" style={s.mcLink}>
            Ver en Mailchimp →
          </a>
        )}
        <button style={s.resetBtn} onClick={() => { setResult(null); setStep(0); setForm({ tipo: "", rango: "", seleccion: "carrito", carrito: "", urls: "", dia: "Miércoles", hora: "10:30", notas: "" }); }}>
          Nueva campaña
        </button>
      </div>
    </div>
  );

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.logo}>LIGIER</div>
        <div style={s.headerSub}>Campañas de email</div>
      </div>

      {/* Progress */}
      <div style={s.progress}>
        {STEPS.map((label, i) => (
          <div key={i} style={s.progressItem}>
            <div style={{ ...s.progressDot, background: i <= step ? '#111' : '#e0e0e0', transform: i === step ? 'scale(1.3)' : 'scale(1)' }} />
            <span style={{ ...s.progressLabel, color: i <= step ? '#111' : '#bbb' }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={s.card}>

        {/* Step 0 */}
        {step === 0 && (
          <div>
            <h2 style={s.stepTitle}>¿Qué tipo de email?</h2>
            <div style={s.tipoGrid}>
              {TIPOS.map(t => (
                <button key={t.id} style={{ ...s.tipoBtn, background: form.tipo === t.id ? '#111' : '#fff', color: form.tipo === t.id ? '#fff' : '#111', border: `2px solid ${form.tipo === t.id ? '#111' : '#e8e8e8'}` }} onClick={() => update('tipo', t.id)}>
                  <span style={s.tipoIcon}>{t.icon}</span>
                  <span style={s.tipoLabel}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 style={s.stepTitle}>¿Cómo elegimos los productos?</h2>
            <div style={s.modeGroup}>
              {[
                { id: "carrito", label: "Traigo el link del carrito", sub: "Generaste el carrito en el sitio" },
                { id: "urls", label: "Traigo las URLs", sub: "Pegás los links de cada producto" },
                { id: "auto", label: "Claude navega el sitio", sub: "Próximamente — usá carrito o URLs por ahora" },
              ].map(m => (
                <button key={m.id} style={{ ...s.modeBtn, background: form.seleccion === m.id ? '#111' : '#fff', color: form.seleccion === m.id ? '#fff' : m.id === 'auto' ? '#ccc' : '#111', border: `2px solid ${form.seleccion === m.id ? '#111' : '#e8e8e8'}`, opacity: m.id === 'auto' ? 0.5 : 1, cursor: m.id === 'auto' ? 'not-allowed' : 'pointer' }} onClick={() => m.id !== 'auto' && update('seleccion', m.id)}>
                  <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 2 }}>{m.label}</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{m.sub}</span>
                </button>
              ))}
            </div>

            {form.seleccion === 'auto' && (
              <div style={{ marginTop: 20 }}>
                <label style={s.label}>Rango de precio</label>
                <div style={s.rangoGrid}>
                  {RANGOS.map(r => (
                    <button key={r} style={{ ...s.rangoBtn, background: form.rango === r ? '#111' : '#fff', color: form.rango === r ? '#fff' : '#111', border: `2px solid ${form.rango === r ? '#111' : '#e8e8e8'}` }} onClick={() => update('rango', r)}>${r}</button>
                  ))}
                </div>
              </div>
            )}
            {form.seleccion === 'carrito' && (
              <div style={{ marginTop: 20 }}>
                <label style={s.label}>Link del carrito</label>
                <textarea style={s.textarea} placeholder="https://vinotecaligier.com/compartircarrito/..." value={form.carrito} onChange={e => update('carrito', e.target.value)} rows={3} />
              </div>
            )}
            {form.seleccion === 'urls' && (
              <div style={{ marginTop: 20 }}>
                <label style={s.label}>URLs de productos (una por línea, exactamente 6)</label>
                <textarea style={s.textarea} placeholder={"https://vinotecaligier.com/producto-1.html\nhttps://vinotecaligier.com/producto-2.html\n..."} value={form.urls} onChange={e => update('urls', e.target.value)} rows={7} />
              </div>
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h2 style={s.stepTitle}>¿Cuándo se manda?</h2>
            <label style={s.label}>Día</label>
            <div style={s.diaGrid}>
              {DIAS.map(d => (
                <button key={d} style={{ ...s.diaBtn, background: form.dia === d ? '#111' : '#fff', color: form.dia === d ? '#fff' : '#111', border: `2px solid ${form.dia === d ? '#111' : '#e8e8e8'}` }} onClick={() => update('dia', d)}>{d.slice(0, 3)}</button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Hora</label>
            <input type="time" style={s.input} value={form.hora} onChange={e => update('hora', e.target.value)} />
            <label style={{ ...s.label, marginTop: 20 }}>Notas adicionales (opcional)</label>
            <textarea style={s.textarea} placeholder="Ej: enfocarse en Malbecs de Altamira..." value={form.notas} onChange={e => update('notas', e.target.value)} rows={3} />
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h2 style={s.stepTitle}>Confirmar campaña</h2>
            {error && <div style={s.errorBox}>{error}</div>}
            <div style={s.summaryBox}>
              {[
                { label: "Tipo", value: selectedTipo?.label },
                { label: "Selección", value: form.seleccion === 'auto' ? `Claude elige · $${form.rango}` : form.seleccion === 'carrito' ? 'Link de carrito' : 'URLs de productos' },
                { label: "Envío", value: `${form.dia} · ${form.hora}` },
                { label: "Prueba a", value: "dayanmartin@gmail.com" },
                { label: "Reply-to", value: "ventas@ligier.com.ar" },
              ].map((item, i) => (
                <div key={i} style={s.summaryRow}>
                  <span style={s.summaryLabel}>{item.label}</span>
                  <span style={s.summaryValue}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={s.nav}>
        {step > 0 && <button style={s.backBtn} onClick={() => { setError(null); setStep(s => s - 1); }}>← Volver</button>}
        {step < 3
          ? <button style={{ ...s.nextBtn, opacity: canNext() ? 1 : 0.4 }} disabled={!canNext()} onClick={() => setStep(s => s + 1)}>Continuar →</button>
          : <button style={s.nextBtn} onClick={handleSubmit}>Generar y programar →</button>
        }
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#f4f1ec', fontFamily: 'Georgia, serif', maxWidth: 480, margin: '0 auto', paddingBottom: 40 },
  header: { background: '#111', padding: '28px 24px 24px', textAlign: 'center' },
  logo: { color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: 6, marginBottom: 4 },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  progress: { display: 'flex', justifyContent: 'center', gap: 32, padding: '20px 24px', background: '#fff', borderBottom: '1px solid #eee' },
  progressItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  progressDot: { width: 8, height: 8, borderRadius: '50%', transition: 'all 0.2s' },
  progressLabel: { fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', transition: 'color 0.2s' },
  card: { background: '#fff', margin: 16, padding: 24, borderRadius: 2 },
  stepTitle: { fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 20, letterSpacing: -0.5 },
  tipoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  tipoBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s', gap: 6 },
  tipoIcon: { fontSize: 22 },
  tipoLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  modeGroup: { display: 'flex', flexDirection: 'column', gap: 10 },
  modeBtn: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 16px', borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' },
  rangoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 },
  rangoBtn: { padding: '10px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.15s' },
  label: { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#aaa', marginBottom: 8 },
  textarea: { width: '100%', padding: 12, border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 13, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', outline: 'none' },
  input: { width: '100%', padding: 12, border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 16, boxSizing: 'border-box', outline: 'none' },
  diaGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 8 },
  diaBtn: { padding: '10px 4px', borderRadius: 2, cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' },
  summaryBox: { border: '1.5px solid #e8e8e8', borderRadius: 2, overflow: 'hidden' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' },
  summaryLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#aaa' },
  summaryValue: { fontSize: 13, fontWeight: 700, color: '#111', textAlign: 'right', maxWidth: '60%' },
  nav: { display: 'flex', gap: 10, padding: '0 16px', marginTop: 8 },
  backBtn: { flex: 1, padding: 14, background: '#fff', border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#111' },
  nextBtn: { flex: 2, padding: 14, background: '#111', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', transition: 'opacity 0.15s' },
  errorBox: { background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 2, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#cc0000' },
  spinner: { width: 40, height: 40, border: '3px solid #f0f0f0', borderTop: '3px solid #111', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px' },
  loadingText: { fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 16 },
  dots: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: '50%', transition: 'background 0.5s' },
  loadingNote: { fontSize: 12, color: '#aaa' },
  successIcon: { width: 48, height: 48, background: '#111', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 16, letterSpacing: -0.5 },
  mcLink: { display: 'block', textAlign: 'center', padding: 14, background: '#f4f1ec', color: '#111', fontWeight: 700, fontSize: 13, textDecoration: 'none', borderRadius: 2, marginTop: 16, marginBottom: 10 },
  resetBtn: { width: '100%', padding: 14, background: '#fff', color: '#111', border: '1.5px solid #e8e8e8', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
};
