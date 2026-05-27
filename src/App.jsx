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

export default function LigierCampaigns() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    tipo: "",
    rango: "",
    seleccion: "auto",
    carrito: "",
    urls: "",
    dia: "Miércoles",
    hora: "10:30",
    notas: "",
  });
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = () => setSubmitted(true);

  const generatedPrompt = `git pull origin main

Leé los archivos guidelines/ligier-email-guidelines.md, prompts/instrucciones-claude.md y el template templates/base-email-vinos.html antes de hacer cualquier cosa.

Generá un email con estos datos:

TIPO: ${form.tipo}${form.rango ? `\nRANGO DE PRECIO: ${form.rango}` : ""}
MES Y AÑO: ${new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
${form.seleccion === "carrito" && form.carrito ? `\nPRODUCTOS (link de carrito):\n${form.carrito}` : ""}
${form.seleccion === "urls" && form.urls ? `\nPRODUCTOS (URLs):\n${form.urls}` : ""}
${form.seleccion === "auto" ? `\nNavegá ${selectedTipo?.url} para seleccionar 6 productos con stock e imagen.` : ""}
${form.notas ? `\nNOTAS ADICIONALES: ${form.notas}` : ""}

Decodificá los SKUs del carrito si aplica. Verificá stock e imagen de cada producto.
Generá el link de carrito con los 6 SKUs. Navegá el link 2 veces para confirmar el total real 6x5.
Elegí un accesorio afín en /cristaleria o /accesorios.

Guardá en templates/vinos-${form.dia.toLowerCase()}-${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }).replace("/", "")}.html

Programar envío: ${form.dia} a las ${form.hora} AM hora Argentina.
Enviar correo de prueba a dayanmartin@gmail.com antes del envío final.`;

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Campaña creada</h2>
          <p style={styles.successSub}>Copiá el prompt y pegalo en Claude Code</p>
          <div style={styles.promptBox}>
            <pre style={styles.promptText}>{generatedPrompt}</pre>
          </div>
          <button
            style={styles.copyBtn}
            onClick={() => {
              navigator.clipboard?.writeText(generatedPrompt);
              alert("Copiado");
            }}
          >
            Copiar prompt
          </button>
          <button style={styles.resetBtn} onClick={() => { setSubmitted(false); setStep(0); setForm({ tipo: "", rango: "", seleccion: "auto", carrito: "", urls: "", dia: "Miércoles", hora: "10:30", notas: "" }); }}>
            Nueva campaña
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>LIGIER</div>
        <div style={styles.headerSub}>Campañas de email</div>
      </div>

      {/* Progress */}
      <div style={styles.progress}>
        {STEPS.map((s, i) => (
          <div key={i} style={styles.progressItem}>
            <div style={{
              ...styles.progressDot,
              background: i <= step ? "#111" : "#e0e0e0",
              transform: i === step ? "scale(1.2)" : "scale(1)",
            }} />
            <span style={{ ...styles.progressLabel, color: i <= step ? "#111" : "#bbb" }}>{s}</span>
          </div>
        ))}
      </div>

      {/* Card */}
      <div style={styles.card}>

        {/* Step 0 — Tipo */}
        {step === 0 && (
          <div>
            <h2 style={styles.stepTitle}>¿Qué tipo de email?</h2>
            <div style={styles.tipoGrid}>
              {TIPOS.map(t => (
                <button
                  key={t.id}
                  style={{
                    ...styles.tipoBtn,
                    background: form.tipo === t.id ? "#111" : "#fff",
                    color: form.tipo === t.id ? "#fff" : "#111",
                    border: form.tipo === t.id ? "2px solid #111" : "2px solid #e8e8e8",
                  }}
                  onClick={() => update("tipo", t.id)}
                >
                  <span style={styles.tipoIcon}>{t.icon}</span>
                  <span style={styles.tipoLabel}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 — Selección */}
        {step === 1 && (
          <div>
            <h2 style={styles.stepTitle}>¿Cómo elegimos los productos?</h2>

            <div style={styles.modeGroup}>
              {[
                { id: "auto", label: "Claude navega el sitio", sub: "Le das el rango de precio y elige" },
                { id: "carrito", label: "Traigo el link del carrito", sub: "Generaste el carrito en el sitio" },
                { id: "urls", label: "Traigo las URLs", sub: "Pegás los links de cada producto" },
              ].map(m => (
                <button
                  key={m.id}
                  style={{
                    ...styles.modeBtn,
                    background: form.seleccion === m.id ? "#111" : "#fff",
                    color: form.seleccion === m.id ? "#fff" : "#111",
                    border: form.seleccion === m.id ? "2px solid #111" : "2px solid #e8e8e8",
                  }}
                  onClick={() => update("seleccion", m.id)}
                >
                  <span style={{ ...styles.modeBtnTitle, color: form.seleccion === m.id ? "#fff" : "#111" }}>{m.label}</span>
                  <span style={{ ...styles.modeBtnSub, color: form.seleccion === m.id ? "rgba(255,255,255,0.7)" : "#999" }}>{m.sub}</span>
                </button>
              ))}
            </div>

            {form.seleccion === "auto" && (
              <div style={{ marginTop: 20 }}>
                <label style={styles.label}>Rango de precio</label>
                <div style={styles.rangoGrid}>
                  {RANGOS.map(r => (
                    <button
                      key={r}
                      style={{
                        ...styles.rangoBtn,
                        background: form.rango === r ? "#111" : "#fff",
                        color: form.rango === r ? "#fff" : "#111",
                        border: form.rango === r ? "2px solid #111" : "2px solid #e8e8e8",
                      }}
                      onClick={() => update("rango", r)}
                    >
                      ${r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.seleccion === "carrito" && (
              <div style={{ marginTop: 20 }}>
                <label style={styles.label}>Link del carrito</label>
                <textarea
                  style={styles.textarea}
                  placeholder="https://vinotecaligier.com/compartircarrito/..."
                  value={form.carrito}
                  onChange={e => update("carrito", e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {form.seleccion === "urls" && (
              <div style={{ marginTop: 20 }}>
                <label style={styles.label}>URLs de productos (una por línea)</label>
                <textarea
                  style={styles.textarea}
                  placeholder={"https://vinotecaligier.com/producto-1.html\nhttps://vinotecaligier.com/producto-2.html\n..."}
                  value={form.urls}
                  onChange={e => update("urls", e.target.value)}
                  rows={6}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Fecha */}
        {step === 2 && (
          <div>
            <h2 style={styles.stepTitle}>¿Cuándo se manda?</h2>

            <label style={styles.label}>Día</label>
            <div style={styles.diaGrid}>
              {DIAS.map(d => (
                <button
                  key={d}
                  style={{
                    ...styles.diaBtn,
                    background: form.dia === d ? "#111" : "#fff",
                    color: form.dia === d ? "#fff" : "#111",
                    border: form.dia === d ? "2px solid #111" : "2px solid #e8e8e8",
                  }}
                  onClick={() => update("dia", d)}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>

            <label style={{ ...styles.label, marginTop: 20 }}>Hora</label>
            <input
              type="time"
              style={styles.input}
              value={form.hora}
              onChange={e => update("hora", e.target.value)}
            />

            <label style={{ ...styles.label, marginTop: 20 }}>Notas adicionales (opcional)</label>
            <textarea
              style={styles.textarea}
              placeholder="Ej: enfocarse en Malbecs de Altamira, evitar Trapiche..."
              value={form.notas}
              onChange={e => update("notas", e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <div>
            <h2 style={styles.stepTitle}>Resumen</h2>
            <div style={styles.summary}>
              {[
                { label: "Tipo", value: selectedTipo?.label },
                { label: "Selección", value: form.seleccion === "auto" ? `Claude elige · $${form.rango}` : form.seleccion === "carrito" ? "Link de carrito" : "URLs de productos" },
                { label: "Envío", value: `${form.dia} · ${form.hora} AM` },
                { label: "Prueba", value: "dayanmartin@gmail.com" },
                { label: "Reply-to", value: "ventas@ligier.com.ar" },
              ].map((item, i) => (
                <div key={i} style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{item.label}</span>
                  <span style={styles.summaryValue}>{item.value}</span>
                </div>
              ))}
            </div>
            {form.notas && (
              <div style={styles.notasBox}>
                <span style={styles.summaryLabel}>Notas</span>
                <p style={{ ...styles.summaryValue, marginTop: 4 }}>{form.notas}</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Nav buttons */}
      <div style={styles.nav}>
        {step > 0 && (
          <button style={styles.backBtn} onClick={() => setStep(s => s - 1)}>
            ← Volver
          </button>
        )}
        {step < 3 ? (
          <button
            style={{ ...styles.nextBtn, opacity: canNext() ? 1 : 0.4 }}
            disabled={!canNext()}
            onClick={() => setStep(s => s + 1)}
          >
            Continuar →
          </button>
        ) : (
          <button style={styles.nextBtn} onClick={handleSubmit}>
            Generar prompt →
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#f4f1ec",
    fontFamily: "'Georgia', serif",
    padding: "0 0 40px",
    maxWidth: 480,
    margin: "0 auto",
  },
  header: {
    background: "#111",
    padding: "28px 24px 24px",
    textAlign: "center",
  },
  logo: {
    color: "#fff",
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 6,
    marginBottom: 4,
  },
  headerSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  progress: {
    display: "flex",
    justifyContent: "center",
    gap: 32,
    padding: "20px 24px",
    background: "#fff",
    borderBottom: "1px solid #eee",
  },
  progressItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    transition: "all 0.2s",
  },
  progressLabel: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    transition: "color 0.2s",
  },
  card: {
    background: "#fff",
    margin: "16px",
    padding: "24px",
    borderRadius: 2,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111",
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  tipoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  tipoBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 12px",
    borderRadius: 2,
    cursor: "pointer",
    transition: "all 0.15s",
    gap: 6,
  },
  tipoIcon: { fontSize: 22 },
  tipoLabel: { fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  modeGroup: { display: "flex", flexDirection: "column", gap: 10 },
  modeBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "14px 16px",
    borderRadius: 2,
    cursor: "pointer",
    transition: "all 0.15s",
    textAlign: "left",
  },
  modeBtnTitle: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  modeBtnSub: { fontSize: 12 },
  rangoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginTop: 8,
  },
  rangoBtn: {
    padding: "10px 8px",
    borderRadius: 2,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    transition: "all 0.15s",
  },
  label: {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#aaa",
    marginBottom: 8,
  },
  textarea: {
    width: "100%",
    padding: "12px",
    border: "1.5px solid #e8e8e8",
    borderRadius: 2,
    fontSize: 13,
    fontFamily: "monospace",
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none",
  },
  input: {
    width: "100%",
    padding: "12px",
    border: "1.5px solid #e8e8e8",
    borderRadius: 2,
    fontSize: 16,
    boxSizing: "border-box",
    outline: "none",
  },
  diaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 6,
    marginTop: 8,
  },
  diaBtn: {
    padding: "10px 4px",
    borderRadius: 2,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    transition: "all 0.15s",
  },
  summary: {
    border: "1.5px solid #e8e8e8",
    borderRadius: 2,
    overflow: "hidden",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #f0f0f0",
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#aaa",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: 700,
    color: "#111",
    textAlign: "right",
  },
  notasBox: {
    marginTop: 12,
    padding: "12px 16px",
    background: "#f9f9f9",
    border: "1.5px solid #e8e8e8",
    borderRadius: 2,
  },
  nav: {
    display: "flex",
    gap: 10,
    padding: "0 16px",
    marginTop: 8,
  },
  backBtn: {
    flex: 1,
    padding: "14px",
    background: "#fff",
    border: "1.5px solid #e8e8e8",
    borderRadius: 2,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    color: "#111",
  },
  nextBtn: {
    flex: 2,
    padding: "14px",
    background: "#111",
    border: "none",
    borderRadius: 2,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    color: "#fff",
    letterSpacing: 0.5,
    transition: "opacity 0.15s",
  },
  successCard: {
    margin: 16,
    background: "#fff",
    padding: 24,
    borderRadius: 2,
  },
  successIcon: {
    width: 48,
    height: 48,
    background: "#111",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 22,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  successSub: {
    fontSize: 13,
    color: "#888",
    marginBottom: 20,
  },
  promptBox: {
    background: "#f4f1ec",
    padding: 16,
    borderRadius: 2,
    overflowX: "auto",
    marginBottom: 16,
    border: "1px solid #e0ddd8",
  },
  promptText: {
    fontSize: 11,
    color: "#444",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
    lineHeight: 1.6,
    fontFamily: "monospace",
  },
  copyBtn: {
    width: "100%",
    padding: "14px",
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 2,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  resetBtn: {
    width: "100%",
    padding: "14px",
    background: "#fff",
    color: "#111",
    border: "1.5px solid #e8e8e8",
    borderRadius: 2,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
};
