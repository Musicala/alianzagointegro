'use strict';

/* =========================
   GOintegro x Musicala — app.js (Página pública)
   Solo lógica de la vista de beneficios.
   El registro de afiliados y generación de códigos
   se gestiona en admin.html (Firebase).
========================= */

const YEAR_LOCK = '2026';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ── Modales ──────────────────────────────────────────────
const howToModal = $('#howToModal');

function openHowTo() {
  if (howToModal && !howToModal.open) howToModal.showModal();
}

function closeHowTo() {
  if (howToModal?.open) howToModal.close();
}

$('#btnHowTo')?.addEventListener('click', openHowTo);
$('#btnHowTo2')?.addEventListener('click', openHowTo);
$('#btnHowToClose')?.addEventListener('click', closeHowTo);
$('#btnHowToOk')?.addEventListener('click', closeHowTo);

$$('.howToBtn').forEach(btn => btn.addEventListener('click', openHowTo));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeHowTo();
});

// ── Scroll a condiciones ──────────────────────────────────
$('#btnConditions')?.addEventListener('click', () => {
  $('#conditions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ── Copiar resumen ────────────────────────────────────────
const SUMMARY = `✨ Beneficios Musicala para afiliados GOintegro (${YEAR_LOCK})

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

Para redimir: acércate a Musicala sede Pasadena (Cra 45a #103B-34, Bogotá).
`;

$('#btnCopySummary')?.addEventListener('click', async () => {
  const btn = $('#btnCopySummary');
  try {
    await navigator.clipboard.writeText(SUMMARY);
    btn.textContent = 'Copiado ✅';
    setTimeout(() => btn.textContent = 'Copiar resumen', 1400);
  } catch {
    alert('No se pudo copiar automáticamente.\n\nCopia manual:\n\n' + SUMMARY);
  }
});
