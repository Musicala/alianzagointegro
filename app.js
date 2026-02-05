'use strict';

/* =========================
   GOintegro x Musicala MVP (2026)
   - Sin backend (localStorage)
   - Regla: 1 beneficio por año (por email/doc)
   - Foco: SOLO 2026 (hard-lock)
========================= */

const LS_KEY = 'gointegro_claims_v2_2026';
const YEAR_LOCK = '2026';

// Puedes cambiar esto si quieren CSV con ; (útil en es-CO/Excel)
const CSV_SEPARATOR = ',';

// Beneficios (texto actualizado a 2026)
const BENEFITS = Object.freeze({
  GRUPALES: {
    title: 'Clases grupales en sede',
    detail: '20% en el primer mes + 5% permanente (2026)',
  },
  AUTOMUSICALA: {
    title: 'AutoMusicala (Online)',
    detail: '1 mes gratuito',
  },
  PERSONALIZADAS: {
    title: 'Clases personalizadas',
    detail: '5% de descuento por 12 meses',
  }
});

let pickedBenefit = null;
let isSubmitting = false;

/* =========================
   DOM
========================= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const modal = $('#modal');
const receiptModal = $('#receiptModal');
const claimsModal = $('#claimsModal');

const pickedLabel = $('#pickedLabel');
const alertBox = $('#alert');

const form = $('#form');
const yearEl = $('#year');
const areaEl = $('#area');
const nameEl = $('#name');
const emailEl = $('#email');
const phoneEl = $('#phone');
const docEl = $('#doc');
const notesEl = $('#notes');
const acceptEl = $('#accept');

const btnSubmit = $('#btnSubmit');

const receiptEl = $('#receipt');
const btnWhats = $('#btnWhats');
const btnCopy = $('#btnCopy');

const claimsTableBody = $('#claimsTable tbody');

/* =========================
   INIT
========================= */
ensureYearLockUI();

/* =========================
   EVENTS
========================= */
$('#btnStart')?.addEventListener('click', () => openPick(null));
$('#btnStart2')?.addEventListener('click', () => openPick(null));

$('#btnHow')?.addEventListener('click', () => {
  $('#conditions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$$('.pickBtn').forEach(btn => {
  btn.addEventListener('click', () => openPick(btn.dataset.pick));
});

$('#btnClose')?.addEventListener('click', () => safeClose(modal));
$('#btnCancel')?.addEventListener('click', () => safeClose(modal));

$('#btnReceiptClose')?.addEventListener('click', () => safeClose(receiptModal));

$('#btnViewClaims')?.addEventListener('click', () => {
  renderClaimsTable();
  safeShowModal(claimsModal);
});
$('#btnClaimsClose')?.addEventListener('click', () => safeClose(claimsModal));

$('#btnExport')?.addEventListener('click', exportCSV);
$('#btnClear')?.addEventListener('click', () => {
  if (!confirm('¿Borrar TODOS los registros guardados en este dispositivo?')) return;
  localStorage.removeItem(LS_KEY);
  renderClaimsTable();
});

// Si existe tu botón del index mejorado, lo conectamos
$('#btnCopySummary')?.addEventListener('click', copySummary2026);

btnCopy?.addEventListener('click', async () => {
  const text = (receiptEl?.innerText || '').trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    btnCopy.textContent = 'Copiado ✅';
    setTimeout(() => btnCopy.textContent = 'Copiar mensaje', 1200);
  } catch (e) {
    alert('No se pudo copiar. Selecciona el texto y copia manual.');
  }
});

// Cerrar modales con ESC (algunos navegadores ya lo hacen, pero no todos)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    [modal, receiptModal, claimsModal].forEach(safeClose);
  }
});

// Submit
form?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (isSubmitting) return;
  clearAlert();

  if (!pickedBenefit) {
    showAlert('Selecciona un beneficio primero.');
    return;
  }

  const payload = readForm();
  const err = validate(payload);
  if (err) {
    showAlert(err);
    return;
  }

  // Enforce: 1 per year per identity (doc/email)
  const claims = getClaims();
  const keyIdentity = buildIdentityKey(payload);

  const alreadyAnyBenefitSameYear = claims.find(c =>
    String(c.year) === String(payload.year) &&
    String(c.identityKey) === String(keyIdentity)
  );

  if (alreadyAnyBenefitSameYear) {
    const b = BENEFITS[alreadyAnyBenefitSameYear.benefitKey];
    showAlert(
      `Ya existe una redención para ${payload.year} con este afiliado (beneficio: ${b?.title || alreadyAnyBenefitSameYear.benefitKey}). ` +
      `Regla: 1 beneficio por año.`
    );
    return;
  }

  setSubmitting(true);

  try {
    const claim = {
      id: makeId(payload.year, payload.benefitKey),
      createdAtISO: new Date().toISOString(),
      createdAtHuman: new Date().toLocaleString('es-CO'),
      identityKey: keyIdentity,
      ...payload
    };

    claims.unshift(claim);
    saveClaims(claims);

    safeClose(modal);
    showReceipt(claim);
  } finally {
    setSubmitting(false);
  }
});

/* =========================
   CORE UI
========================= */
function openPick(benefitKey) {
  if (benefitKey) pickedBenefit = benefitKey;

  // Si abren el modal desde "Elegir beneficio" sin escoger tarjeta
  if (!pickedBenefit) {
    pickedLabel.textContent = 'Beneficio: — (elige uno en las tarjetas)';
  } else {
    const b = BENEFITS[pickedBenefit];
    pickedLabel.textContent = `Beneficio: ${b.title} · ${b.detail}`;
  }

  // Asegura year lock en el form
  if (yearEl) yearEl.value = YEAR_LOCK;

  clearAlert();
  safeShowModal(modal);
}

function readForm() {
  return {
    year: YEAR_LOCK, // hard-lock
    benefitKey: pickedBenefit,
    benefitTitle: BENEFITS[pickedBenefit]?.title || pickedBenefit,
    benefitDetail: BENEFITS[pickedBenefit]?.detail || '',
    area: (areaEl?.value || '').trim(),
    name: normalizeName(nameEl?.value || ''),
    email: normalizeEmail(emailEl?.value || ''),
    phone: normalizePhoneCO(phoneEl?.value || ''),
    doc: normalizeDoc(docEl?.value || ''),
    notes: (notesEl?.value || '').trim(),
    accepted: !!acceptEl?.checked
  };
}

function validate(p) {
  if (!p.year || p.year !== YEAR_LOCK) return `Año inválido. Este aplicativo es solo para ${YEAR_LOCK}.`;
  if (!p.benefitKey || !BENEFITS[p.benefitKey]) return 'Selecciona un beneficio.';
  if (!p.area) return 'Selecciona un área.';
  if (!p.name || p.name.length < 5) return 'Escribe tu nombre completo.';
  if (!isValidEmail(p.email)) return 'Email inválido.';
  if (!p.phone || p.phone.length < 10) return 'Número de WhatsApp inválido (mínimo 10 dígitos).';
  if (!p.accepted) return 'Debes aceptar las condiciones para continuar.';
  return '';
}

/* =========================
   RECEIPT / WHATSAPP
========================= */
function showReceipt(claim) {
  const message = buildMessage(claim);

  receiptEl.innerHTML = `
    <div><b>GOintegro · Beneficios Musicala</b></div>
    <div style="margin-top:6px"><b>Código:</b> ${escapeHtml(claim.id)}</div>
    <div><b>Fecha:</b> ${escapeHtml(claim.createdAtHuman)}</div>
    <div><b>Año:</b> ${escapeHtml(claim.year)}</div>
    <div><b>Beneficio:</b> ${escapeHtml(claim.benefitTitle)} (${escapeHtml(claim.benefitDetail)})</div>
    <div><b>Área:</b> ${escapeHtml(claim.area)}</div>
    <hr style="border:none;border-top:1px solid rgba(16,24,40,.12);margin:10px 0">
    <div><b>Afiliado(a):</b> ${escapeHtml(claim.name)}</div>
    <div><b>Email:</b> ${escapeHtml(claim.email)}</div>
    <div><b>WhatsApp:</b> ${escapeHtml(claim.phone)}</div>
    ${claim.doc ? `<div><b>Documento:</b> ${escapeHtml(claim.doc)}</div>` : ''}
    ${claim.notes ? `<div style="margin-top:6px"><b>Notas:</b> ${escapeHtml(claim.notes)}</div>` : ''}
    <hr style="border:none;border-top:1px solid rgba(16,24,40,.12);margin:10px 0">
    <div class="muted tiny">
      Condiciones: 1 beneficio en ${YEAR_LOCK} · no transferible · no acumulable · no repetir beneficio en el mismo año.
    </div>
    <div style="margin-top:8px"><b>Mensaje sugerido:</b></div>
    <div style="white-space:pre-wrap;margin-top:6px">${escapeHtml(message)}</div>
  `;

  // WhatsApp generic deep-link
  btnWhats.href = `https://wa.me/?text=${encodeURIComponent(message)}`;

  safeShowModal(receiptModal);
}

function buildMessage(c) {
  return (
`Hola Musicala 💙
Soy afiliado(a) GOintegro y quiero redimir mi beneficio ${YEAR_LOCK}.

Código: ${c.id}
Nombre: ${c.name}
Email: ${c.email}
WhatsApp: ${c.phone}
${c.doc ? `Documento: ${c.doc}\n` : ''}Beneficio: ${c.benefitTitle} (${c.benefitDetail})
Área: ${c.area}
${c.notes ? `Notas: ${c.notes}\n` : ''}

Quedo atento(a) a la validación y al paso a paso para activar el beneficio.`
  ).trim();
}

/* =========================
   STORAGE
========================= */
function getClaims() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveClaims(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function buildIdentityKey(p) {
  // Prioridad: documento si existe, si no email
  if (p.doc) return `doc:${p.doc}`;
  return `email:${p.email}`;
}

/* =========================
   CLAIMS TABLE
========================= */
function renderClaimsTable() {
  const claims = getClaims();
  claimsTableBody.innerHTML = '';

  if (!claims.length) {
    claimsTableBody.innerHTML = `<tr><td colspan="7" class="muted">No hay registros en este dispositivo.</td></tr>`;
    return;
  }

  for (const c of claims) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(c.createdAtHuman || '')}</td>
      <td>${escapeHtml(c.year || '')}</td>
      <td>${escapeHtml(c.benefitTitle || c.benefitKey || '')}</td>
      <td>${escapeHtml(c.name || '')}</td>
      <td>${escapeHtml(c.email || '')}</td>
      <td>${escapeHtml(c.phone || '')}</td>
      <td>${escapeHtml(c.area || '')}</td>
    `;
    claimsTableBody.appendChild(tr);
  }
}

/* =========================
   EXPORT CSV
========================= */
function exportCSV() {
  const claims = getClaims();
  if (!claims.length) {
    alert('No hay registros para exportar.');
    return;
  }

  const headers = ['Fecha','Año','Beneficio','Detalle','Nombre','Email','WhatsApp','Documento','Área','Notas','Código'];
  const rows = claims.map(c => ([
    c.createdAtHuman || '',
    c.year || '',
    c.benefitTitle || '',
    c.benefitDetail || '',
    c.name || '',
    c.email || '',
    c.phone || '',
    c.doc || '',
    c.area || '',
    (c.notes || '').replace(/\n/g, ' '),
    c.id || ''
  ]));

  const sep = CSV_SEPARATOR;
  const csvBody = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(sep))
    .join('\n');

  // BOM para Excel (si no, a veces rompe acentos)
  const csv = '\uFEFF' + csvBody;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `gointegro_musicala_registros_${YEAR_LOCK}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/* =========================
   SUMMARY COPY (opcional)
========================= */
async function copySummary2026() {
  const summary =
`✨ Beneficios Musicala para afiliados GOintegro (${YEAR_LOCK})

1) 🎸 Clases grupales en sede:
   - 20% de descuento en el primer mes (nuevo estudiante)
   - 5% de descuento durante ${YEAR_LOCK} mientras siga afiliado y activo
   - Áreas: Música, Danza, Artes Plásticas, Teatro
   - Sede Pasadena: Carrera 45a #103B-34

2) 💻 AutoMusicala (Online):
   - 1 mes gratuito en la plataforma

3) 🏡 Clases personalizadas:
   - 5% de descuento por 12 meses
   - Modalidades: Sede / Musicala Hogar / Virtual

Condiciones:
- 1 beneficio por afiliado/a en ${YEAR_LOCK}
- No acumulables ni transferibles
- No se puede repetir el mismo beneficio en el mismo año
- Aplica a estudiantes nuevos (excepto el 5% grupales, vigente mientras esté activo en ${YEAR_LOCK})
`;

  try {
    await navigator.clipboard.writeText(summary);
    const btn = $('#btnCopySummary');
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = 'Resumen copiado ✅';
      setTimeout(() => btn.textContent = prev, 1200);
    }
  } catch (e) {
    alert('No se pudo copiar automáticamente. Copia manual:\n\n' + summary);
  }
}

/* =========================
   UTILITIES
========================= */
function makeId(year, benefitKey) {
  // Código simple: GI-2026-GRU-XXXX (y evita decir 2025 como en el comentario anterior)
  const short = benefitKey === 'GRUPALES' ? 'GRU'
              : benefitKey === 'AUTOMUSICALA' ? 'AUT'
              : 'PER';
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `GI-${year}-${short}-${rand}`;
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function normalizeName(v) {
  // Limpia espacios dobles y capitaliza suave sin ponerse nazi de ortografía
  const s = String(v || '').trim().replace(/\s+/g, ' ');
  return s;
}

function normalizeDoc(v) {
  const s = String(v || '').trim().replace(/\s+/g, '').toLowerCase();
  return s;
}

function normalizePhoneCO(v) {
  // Deja solo dígitos, si viene con +57 lo normaliza
  let s = String(v || '').replace(/[^\d]/g, '');
  if (s.startsWith('57') && s.length >= 12) s = s.slice(2);
  // limita a 10-15 por si meten locuras
  return s.slice(0, 15);
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

function showAlert(msg) {
  alertBox.hidden = false;
  alertBox.textContent = msg;
}

function clearAlert() {
  alertBox.hidden = true;
  alertBox.textContent = '';
}

function setSubmitting(on) {
  isSubmitting = !!on;
  if (!btnSubmit) return;

  if (isSubmitting) {
    btnSubmit.disabled = true;
    btnSubmit.dataset.prev = btnSubmit.textContent;
    btnSubmit.textContent = 'Generando…';
  } else {
    btnSubmit.disabled = false;
    btnSubmit.textContent = btnSubmit.dataset.prev || 'Generar comprobante';
    delete btnSubmit.dataset.prev;
  }
}

function ensureYearLockUI() {
  // Si el select existe, lo dejamos SOLO en 2026 (defensa extra)
  if (!yearEl) return;
  yearEl.innerHTML = `<option value="${YEAR_LOCK}" selected>${YEAR_LOCK}</option>`;
  yearEl.value = YEAR_LOCK;
}

function safeShowModal(dlg) {
  if (!dlg) return;
  try {
    if (typeof dlg.showModal === 'function') {
      if (!dlg.open) dlg.showModal();
    } else {
      // fallback (muy viejo): mostrar como bloque
      dlg.setAttribute('open', 'open');
    }
  } catch (e) {
    // Si ya estaba abierto o el navegador se queja, intentamos open
    try { dlg.setAttribute('open', 'open'); } catch(_) {}
  }
}

function safeClose(dlg) {
  if (!dlg) return;
  try {
    if (typeof dlg.close === 'function' && dlg.open) dlg.close();
    else dlg.removeAttribute('open');
  } catch (e) {
    try { dlg.removeAttribute('open'); } catch(_) {}
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
