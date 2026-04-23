'use strict';

/* =========================
   GOintegro x Musicala — admin.js
   Panel de administración con Firebase Auth + Firestore.
   Solo los ADMIN_EMAILS pueden ingresar.
   Registra afiliados, genera códigos, exporta CSV.
========================= */

const ADMIN_EMAILS = Object.freeze([
  'alekcaballeromusic@gmail.com',
  'alekcaballeromusic@googlemail.com',
  'catalina.medina.leal@gmail.com',
  'catalina.medina.leal@googlemail.com',
  'musicalaasesor@gmail.com',
  'musicalaasesor@googlemail.com',
].map(normalizeEmail));

const COLLECTION = 'gointegro_claims_2026';
const YEAR_LOCK = '2026';

const BENEFITS = Object.freeze({
  GRUPALES:      { title: 'Clases grupales en sede',  detail: '20% primer mes + 5% permanente (2026)' },
  AUTOMUSICALA:  { title: 'AutoMusicala (Online)',     detail: '1 mes gratuito'                        },
  PERSONALIZADAS:{ title: 'Clases personalizadas',    detail: '5% de descuento por 12 meses'          },
});

/* ── Firebase init ─────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            'AIzaSyDaRj0SRv7xbusayq2gQ2fnoCwlvoyGF4s',
  authDomain:        'gointegro-148e6.firebaseapp.com',
  projectId:         'gointegro-148e6',
  storageBucket:     'gointegro-148e6.firebasestorage.app',
  messagingSenderId: '789518911385',
  appId:             '1:789518911385:web:7549179a4a7031996c7508',
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

/* ── Estado ────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
let currentUser  = null;
let allClaims    = [];
let isSubmitting = false;

/* ══════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════ */
auth.onAuthStateChanged(user => {
  if (!user) {
    showScreen('login');
    return;
  }

  const userEmail = normalizeEmail(user.email);

  if (!ADMIN_EMAILS.includes(userEmail)) {
    $('unauthMsg').textContent =
      `La cuenta "${user.email}" no está en la lista de administradores. Inicia sesión con una cuenta autorizada.`;
    showScreen('unauthorized');
    return;
  }

  currentUser = user;
  $('adminUserEmail').textContent = user.email;
  showScreen('admin');
  loadClaims();
});

function showScreen(name) {
  $('loginScreen').hidden       = name !== 'login';
  $('unauthorizedScreen').hidden = name !== 'unauthorized';
  $('adminPanel').hidden         = name !== 'admin';
}

$('btnLogin').addEventListener('click', () => {
  auth.signInWithPopup(googleProvider).catch(err => {
    alert('Error al ingresar: ' + err.message);
  });
});

$('btnLogout').addEventListener('click', () => auth.signOut());
$('btnLogoutUnauth').addEventListener('click', () => auth.signOut());

/* ══════════════════════════════════════════════════════════
   FIRESTORE — Carga de registros
══════════════════════════════════════════════════════════ */
async function loadClaims() {
  $('claimsBody').innerHTML =
    `<tr><td colspan="9" class="muted" style="text-align:center;padding:28px">Cargando…</td></tr>`;

  try {
    const snap = await db
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();

    allClaims = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    updateStats();
    renderTable(allClaims);
  } catch (err) {
    console.error('Error cargando registros:', err);
    $('claimsBody').innerHTML =
      `<tr><td colspan="9" class="muted" style="text-align:center;padding:28px;color:var(--brahms)">
        Error al cargar registros. Verifica las reglas de Firestore.<br>
        <small style="font-weight:400">${escHtml(err.message)}</small>
      </td></tr>`;
  }
}

/* ── Stats ─────────────────────────────────────────────── */
function updateStats() {
  $('statTotal').textContent = allClaims.length;
  $('statGRU').textContent   = allClaims.filter(c => c.benefitKey === 'GRUPALES').length;
  $('statAUT').textContent   = allClaims.filter(c => c.benefitKey === 'AUTOMUSICALA').length;
  $('statPER').textContent   = allClaims.filter(c => c.benefitKey === 'PERSONALIZADAS').length;
}

/* ── Tabla ──────────────────────────────────────────────── */
function renderTable(claims) {
  const tbody = $('claimsBody');
  tbody.innerHTML = '';

  if (!claims.length) {
    tbody.innerHTML =
      `<tr><td colspan="9" class="muted" style="text-align:center;padding:32px">
        Sin registros aún.
      </td></tr>`;
    return;
  }

  claims.forEach(c => {
    const tr = document.createElement('tr');

    // Código
    const tdCode = document.createElement('td');
    const codeEl = document.createElement('code');
    codeEl.style.cssText =
      'font-size:11.5px;background:rgba(12,65,196,.08);padding:3px 8px;border-radius:6px;letter-spacing:.3px';
    codeEl.textContent = c.code || '—';
    tdCode.appendChild(codeEl);

    // Fecha
    const tdDate = document.createElement('td');
    tdDate.style.whiteSpace = 'nowrap';
    tdDate.textContent = c.createdAtHuman || '—';

    // Beneficio
    const tdBen = document.createElement('td');
    tdBen.textContent = BENEFITS[c.benefitKey]?.title || c.benefitKey || '—';

    // Nombre
    const tdName = document.createElement('td');
    tdName.textContent = c.name || '—';

    // Email
    const tdEmail = document.createElement('td');
    tdEmail.style.fontSize = '12.5px';
    tdEmail.textContent = c.email || '—';

    // WhatsApp
    const tdPhone = document.createElement('td');
    tdPhone.textContent = c.phone || '—';

    // Área
    const tdArea = document.createElement('td');
    tdArea.textContent = c.area || '—';

    // Registrado por
    const tdBy = document.createElement('td');
    tdBy.style.cssText = 'font-size:11.5px;color:var(--muted)';
    tdBy.textContent = (c.registeredBy || '').replace('@gmail.com', '').replace('@', '');

    // Acción: Ver
    const tdBtn = document.createElement('td');
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn--ghost';
    viewBtn.style.cssText = 'height:30px;padding:0 10px;font-size:12px';
    viewBtn.textContent = 'Ver';
    viewBtn.addEventListener('click', () => showReceipt(c));
    tdBtn.appendChild(viewBtn);

    [tdCode, tdDate, tdBen, tdName, tdEmail, tdPhone, tdArea, tdBy, tdBtn]
      .forEach(td => tr.appendChild(td));

    tbody.appendChild(tr);
  });
}

/* ── Búsqueda ───────────────────────────────────────────── */
$('searchInput').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { renderTable(allClaims); return; }
  renderTable(allClaims.filter(c =>
    (c.name  || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.code  || '').toLowerCase().includes(q) ||
    (c.phone || '').includes(q)
  ));
});

/* ══════════════════════════════════════════════════════════
   REGISTRAR AFILIADO
══════════════════════════════════════════════════════════ */
$('btnNewClaim').addEventListener('click', openClaimModal);
$('btnClaimClose').addEventListener('click', () => safeClose($('claimModal')));
$('btnClaimCancel').addEventListener('click', () => safeClose($('claimModal')));

function openClaimModal() {
  ['fBenefit','fArea','fName','fEmail','fPhone','fDoc','fNotes']
    .forEach(id => { const el = $(id); if (el) el.value = ''; });
  $('claimAlert').hidden = true;
  safeShowModal($('claimModal'));
}

$('btnClaimSave').addEventListener('click', async () => {
  if (isSubmitting) return;
  $('claimAlert').hidden = true;

  const payload = {
    benefitKey: $('fBenefit').value || '',
    area:       ($('fArea').value  || '').trim(),
    name:       ($('fName').value  || '').trim(),
    email:      ($('fEmail').value || '').trim().toLowerCase(),
    phone:      normalizePhone($('fPhone').value || ''),
    doc:        ($('fDoc').value   || '').trim(),
    notes:      ($('fNotes').value || '').trim(),
  };

  // Validación
  const err = validatePayload(payload);
  if (err) { showClaimAlert(err); return; }

  // Anti-duplicado: mismo email o documento en 2026
  const identityKey = payload.doc
    ? `doc:${payload.doc.replace(/\s+/g,'').toLowerCase()}`
    : `email:${payload.email}`;

  const dup = allClaims.find(c => c.identityKey === identityKey);
  if (dup) {
    showClaimAlert(
      `Ya existe un registro para este afiliado en 2026 ` +
      `(beneficio: ${BENEFITS[dup.benefitKey]?.title || dup.benefitKey}). ` +
      `Regla: 1 beneficio por año.`
    );
    return;
  }

  // Guardar
  setSubmitting(true);
  try {
    const code = makeCode(payload.benefitKey);
    const now  = new Date();

    const docData = {
      ...payload,
      identityKey,
      code,
      year:           YEAR_LOCK,
      createdAtHuman: now.toLocaleString('es-CO'),
      registeredBy:   currentUser.email,
      createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
    };

    const ref  = await db.collection(COLLECTION).add(docData);
    const saved = { _docId: ref.id, ...docData };

    allClaims.unshift(saved);
    updateStats();
    renderTable(allClaims);

    safeClose($('claimModal'));
    showReceipt(saved);

  } catch (err) {
    console.error('Error guardando:', err);
    showClaimAlert('Error al guardar: ' + err.message);
  } finally {
    setSubmitting(false);
  }
});

function validatePayload(p) {
  if (!p.benefitKey || !BENEFITS[p.benefitKey]) return 'Selecciona un beneficio.';
  if (!p.area)                                   return 'Selecciona un área.';
  if (!p.name || p.name.length < 3)              return 'Escribe el nombre completo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return 'Email inválido.';
  if (!p.phone || p.phone.length < 10)           return 'WhatsApp inválido (mínimo 10 dígitos).';
  return '';
}

function setSubmitting(on) {
  isSubmitting = on;
  const btn = $('btnClaimSave');
  if (!btn) return;
  btn.disabled = on;
  btn.textContent = on ? 'Guardando…' : 'Registrar y generar código';
}

/* ══════════════════════════════════════════════════════════
   COMPROBANTE / RECEIPT
══════════════════════════════════════════════════════════ */
function showReceipt(c) {
  const b   = BENEFITS[c.benefitKey] || {};
  const msg = buildMessage(c);

  $('receiptContent').innerHTML = `
    <div><b>GOintegro × Musicala</b></div>
    <div style="margin-top:8px">
      <span style="background:rgba(12,65,196,.10);padding:4px 10px;border-radius:8px;font-size:13px;font-weight:900;letter-spacing:.5px">
        ${escHtml(c.code || '—')}
      </span>
    </div>
    <div style="margin-top:8px"><b>Fecha:</b> ${escHtml(c.createdAtHuman || '—')}</div>
    <div><b>Año:</b> ${escHtml(c.year || YEAR_LOCK)}</div>
    <div><b>Beneficio:</b> ${escHtml(b.title || c.benefitKey || '—')}</div>
    <div><b>Detalle:</b> ${escHtml(b.detail || '—')}</div>
    <div><b>Área:</b> ${escHtml(c.area || '—')}</div>
    <hr style="border:none;border-top:1px solid rgba(16,24,40,.12);margin:10px 0">
    <div><b>Afiliado(a):</b> ${escHtml(c.name || '—')}</div>
    <div><b>Email:</b> ${escHtml(c.email || '—')}</div>
    <div><b>WhatsApp:</b> ${escHtml(c.phone || '—')}</div>
    ${c.doc   ? `<div><b>Documento:</b> ${escHtml(c.doc)}</div>` : ''}
    ${c.notes ? `<div style="margin-top:6px"><b>Notas:</b> ${escHtml(c.notes)}</div>` : ''}
    <hr style="border:none;border-top:1px solid rgba(16,24,40,.12);margin:10px 0">
    <div style="font-size:12px;color:var(--muted)">
      Registrado por: ${escHtml(c.registeredBy || '—')}
    </div>
    <div style="margin-top:10px"><b>Mensaje sugerido para el afiliado:</b></div>
    <div style="white-space:pre-wrap;margin-top:6px;font-size:12.5px;background:rgba(255,255,255,.6);padding:10px;border-radius:10px;border:1px solid rgba(16,24,40,.10)">${escHtml(msg)}</div>
  `;

  $('btnWhats').href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  safeShowModal($('receiptModal'));
}

$('btnReceiptClose').addEventListener('click', () => safeClose($('receiptModal')));

$('btnCopyReceipt').addEventListener('click', async () => {
  const text = ($('receiptContent')?.innerText || '').trim();
  try {
    await navigator.clipboard.writeText(text);
    $('btnCopyReceipt').textContent = 'Copiado ✅';
    setTimeout(() => $('btnCopyReceipt').textContent = 'Copiar mensaje', 1400);
  } catch {
    alert('Copia manual: selecciona el texto del comprobante.');
  }
});

function buildMessage(c) {
  const b = BENEFITS[c.benefitKey] || {};
  return (
`Hola${c.name ? ' ' + c.name.split(' ')[0] : ''}! Te confirmamos tu beneficio GOintegro × Musicala ${YEAR_LOCK} 💙

Código: ${c.code}
Beneficio: ${b.title || c.benefitKey} (${b.detail || ''})
Área: ${c.area}
${c.notes ? `Notas: ${c.notes}\n` : ''}
El equipo Musicala se pondrá en contacto para coordinar el inicio. Sede Pasadena: Cra 45a #103B-34, Bogotá.

¡Bienvenido(a)! 🎵`
  ).trim();
}

/* ══════════════════════════════════════════════════════════
   EXPORT CSV
══════════════════════════════════════════════════════════ */
$('btnExportCSV').addEventListener('click', () => {
  if (!allClaims.length) { alert('Sin registros para exportar.'); return; }

  const headers = [
    'Código','Fecha','Año','Beneficio','Detalle',
    'Nombre','Email','WhatsApp','Documento','Área','Notas','Registrado por'
  ];

  const rows = allClaims.map(c => [
    c.code          || '',
    c.createdAtHuman|| '',
    c.year          || '',
    BENEFITS[c.benefitKey]?.title  || c.benefitKey || '',
    BENEFITS[c.benefitKey]?.detail || '',
    c.name  || '',
    c.email || '',
    c.phone || '',
    c.doc   || '',
    c.area  || '',
    (c.notes || '').replace(/\n/g, ' '),
    c.registeredBy  || '',
  ]);

  const csv = '\uFEFF' + [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a   = Object.assign(document.createElement('a'), {
    href:     url,
    download: `gointegro_musicala_${YEAR_LOCK}_${new Date().toISOString().slice(0,10)}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ══════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════ */
function makeCode(benefitKey) {
  const short = benefitKey === 'GRUPALES' ? 'GRU'
              : benefitKey === 'AUTOMUSICALA' ? 'AUT'
              : 'PER';
  const rand  = Math.floor(1000 + Math.random() * 9000);
  const ts    = Date.now().toString(36).toUpperCase().slice(-3);
  return `GI-${YEAR_LOCK}-${short}-${rand}${ts}`;
}

function normalizePhone(v) {
  let s = String(v || '').replace(/[^\d]/g, '');
  if (s.startsWith('57') && s.length >= 12) s = s.slice(2);
  return s.slice(0, 15);
}

function normalizeEmail(value) {
  let email = String(value || '').trim().toLowerCase();
  if (!email) return '';
  if (email.endsWith('@googlemail.com')) {
    email = email.replace(/@googlemail\.com$/i, '@gmail.com');
  }
  return email;
}

function showClaimAlert(msg) {
  const el = $('claimAlert');
  el.hidden = false;
  el.textContent = msg;
}

function escHtml(str) {
  return String(str || '')
    .replaceAll('&',  '&amp;')
    .replaceAll('<',  '&lt;')
    .replaceAll('>',  '&gt;')
    .replaceAll('"',  '&quot;')
    .replaceAll("'",  '&#039;');
}

function safeShowModal(dlg) {
  if (!dlg) return;
  try { if (!dlg.open) dlg.showModal(); }
  catch { dlg.setAttribute('open', 'open'); }
}

function safeClose(dlg) {
  if (!dlg) return;
  try { if (dlg.open) dlg.close(); }
  catch { dlg.removeAttribute('open'); }
}
