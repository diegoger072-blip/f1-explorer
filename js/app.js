/* ===========================================================
   F1 Explorer — lógica de la aplicación (JavaScript)
   Consume la Jolpica F1 API (compatible con Ergast) y renderiza
   dinámicamente las vistas. Sin dependencias extra (solo Bootstrap
   para componentes/responsividad).
   =========================================================== */
'use strict';

const API = 'https://api.jolpi.ca/ergast/f1';

// ---- utilidades ----
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const cache = new Map();

/** fetch con caché en memoria para no repetir llamadas a la API */
async function api(path){
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Error ${res.status} al consultar la API`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}

// Traducción de nacionalidades (inglés -> español + bandera)
const NAT = {
  British:'Británico 🇬🇧', Dutch:'Neerlandés 🇳🇱', Spanish:'Español 🇪🇸', German:'Alemán 🇩🇪',
  Mexican:'Mexicano 🇲🇽', Monegasque:'Monegasco 🇲🇨', Australian:'Australiano 🇦🇺', Finnish:'Finlandés 🇫🇮',
  French:'Francés 🇫🇷', Canadian:'Canadiense 🇨🇦', Thai:'Tailandés 🇹🇭', Japanese:'Japonés 🇯🇵',
  Danish:'Danés 🇩🇰', Italian:'Italiano 🇮🇹', American:'Estadounidense 🇺🇸', Chinese:'Chino 🇨🇳',
  Brazilian:'Brasileño 🇧🇷', Argentine:'Argentino 🇦🇷', 'New Zealander':'Neozelandés 🇳🇿', Austrian:'Austriaco 🇦🇹',
};
const nat = n => NAT[n] || n;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---- estado ----
const state = { season:'2024', category:'pilotos', query:'', lastListView:'resultados', standings:null, standingsSeason:null };

// ====================== NAVEGACIÓN ENTRE VISTAS ======================
const VIEWS = ['home','busqueda','resultados','detalle','calendario'];

function showView(name){
  VIEWS.forEach(v => $(`#view-${v}`).classList.toggle('d-none', v !== name));
  // resalta el enlace activo de la navbar
  $$('.app-navbar .nav-link').forEach(a =>
    a.classList.toggle('active', a.dataset.view === name ||
      (name === 'resultados' && a.dataset.view === 'busqueda')));
  if (name === 'resultados' || name === 'calendario') state.lastListView = name;
  // cierra el menú colapsado en móvil
  const nav = $('#mainNav');
  if (nav.classList.contains('show')) bootstrap.Collapse.getOrCreateInstance(nav).hide();
  window.scrollTo({ top:0, behavior:'auto' });
}

// delega los clics con data-view (navbar, botones, marca)
document.addEventListener('click', e => {
  const t = e.target.closest('[data-view]');
  if (t){ e.preventDefault(); showView(t.dataset.view); }
});

// ====================== HELPERS DE RENDER ======================
const loading = el => { el.innerHTML =
  `<div class="col-12"><div class="state-box">
     <div class="spinner-border text-f1" role="status"></div>
     <p class="mt-3 mb-0">Cargando datos…</p></div></div>`; };

const errorBox = (el, msg) => { el.innerHTML =
  `<div class="col-12"><div class="state-box">
     <i class="bi bi-exclamation-triangle fs-3"></i>
     <p class="mt-2 mb-0">${esc(msg)}</p></div></div>`; };

const emptyBox = (el, msg) => { el.innerHTML =
  `<div class="col-12"><div class="state-box">
     <i class="bi bi-inbox fs-3"></i><p class="mt-2 mb-0">${esc(msg)}</p></div></div>`; };

// ====================== DATOS (API) ======================
async function getStandings(season){
  if (state.standingsSeason === season && state.standings) return state.standings;
  const data = await api(`/${season}/driverStandings/?limit=50&format=json`);
  const list = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
  const map = {};
  list.forEach(s => { map[s.Driver.driverId] = {
    points:s.points, wins:s.wins, position:s.position,
    team:s.Constructors?.[0]?.name || '—' }; });
  state.standings = map; state.standingsSeason = season;
  return map;
}
const getDrivers  = s => api(`/${s}/drivers/?limit=50&format=json`).then(d => d.MRData.DriverTable.Drivers);
const getRaces    = s => api(`/${s}/races/?limit=30&format=json`).then(d => d.MRData.RaceTable.Races);
const getCircuits = s => api(`/${s}/circuits/?limit=40&format=json`).then(d => d.MRData.CircuitTable.Circuits);

// ====================== VISTA: RESULTADOS ======================
const grid = $('#results-grid');

async function renderResults(){
  const { category, season, query } = state;
  $('#results-sub').textContent =
    `${category[0].toUpperCase()+category.slice(1)} · Temporada ${season}`;
  $('#results-count').textContent = '';
  showView('resultados');
  loading(grid);
  try{
    if (category === 'pilotos')   return await renderDrivers(season, query);
    if (category === 'carreras')  return await renderRaces(season, query);
    if (category === 'circuitos') return await renderCircuits(season, query);
  }catch(err){
    errorBox(grid, err.message || 'No se pudieron cargar los datos.');
  }
}

function filterBy(items, query, fields){
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(it => fields(it).some(f => String(f).toLowerCase().includes(q)));
}

function cardCol(inner, onClick){
  const col = document.createElement('div');
  col.className = 'col-12 col-sm-6 col-lg-3';
  const card = document.createElement('button');
  card.type = 'button'; card.className = 'card-f1 w-100'; card.innerHTML = inner;
  card.addEventListener('click', onClick);
  col.appendChild(card); return col;
}

async function renderDrivers(season, query){
  const [drivers, standings] = await Promise.all([ getDrivers(season), getStandings(season) ]);
  const list = filterBy(drivers, query, d => [d.givenName, d.familyName, d.nationality, standings[d.driverId]?.team]);
  $('#results-count').textContent = `${list.length} resultados`;
  if (!list.length) return emptyBox(grid, 'Sin pilotos para esa búsqueda.');
  grid.innerHTML = '';
  list.forEach(d => {
    const s = standings[d.driverId] || {};
    grid.appendChild(cardCol(
      `<span class="num">#${esc(d.permanentNumber || '—')}</span>
       <span class="title">${esc(d.givenName)} ${esc(d.familyName)}</span>
       <span class="sub">${esc(s.team || nat(d.nationality))}</span>
       <span class="go">Ver detalles →</span>`,
      () => openDriver(d.driverId, season)));
  });
}

async function renderRaces(season, query){
  const races = await getRaces(season);
  const list = filterBy(races, query, r => [r.raceName, r.Circuit.circuitName, r.Circuit.Location.country]);
  $('#results-count').textContent = `${list.length} resultados`;
  if (!list.length) return emptyBox(grid, 'Sin carreras para esa búsqueda.');
  grid.innerHTML = '';
  list.forEach(r => grid.appendChild(cardCol(
    `<span class="num">RONDA ${esc(r.round)}</span>
     <span class="title">${esc(r.raceName)}</span>
     <span class="sub">${esc(r.Circuit.Location.locality)}, ${esc(r.Circuit.Location.country)} · ${fmtDate(r.date)}</span>
     <span class="go">Ver detalles →</span>`,
    () => openRace(r.round, season))));
}

async function renderCircuits(season, query){
  const [circuits, races] = await Promise.all([ getCircuits(season), getRaces(season) ]);
  const list = filterBy(circuits, query, c => [c.circuitName, c.Location.locality, c.Location.country]);
  $('#results-count').textContent = `${list.length} resultados`;
  if (!list.length) return emptyBox(grid, 'Sin circuitos para esa búsqueda.');
  grid.innerHTML = '';
  list.forEach(c => grid.appendChild(cardCol(
    `<span class="num"><i class="bi bi-geo-alt"></i> CIRCUITO</span>
     <span class="title">${esc(c.circuitName)}</span>
     <span class="sub">${esc(c.Location.locality)}, ${esc(c.Location.country)}</span>
     <span class="go">Ver detalles →</span>`,
    () => openCircuit(c.circuitId, season, races))));
}

// ====================== VISTA: DETALLE ======================
function setDetail(crumbsHtml, contentHtml, listView){
  $('#detail-crumbs').innerHTML = crumbsHtml;
  $('#detail-content').innerHTML = contentHtml;
  state.lastListView = listView;
  showView('detalle');
}

async function openDriver(id, season){
  setDetail('Resultados <i class="bi bi-chevron-right"></i> <b>Detalle</b>',
    `<div class="state-box"><div class="spinner-border text-f1"></div></div>`, 'resultados');
  try{
    const [drivers, standings, results] = await Promise.all([
      getDrivers(season), getStandings(season),
      api(`/${season}/drivers/${id}/results/?limit=30&format=json`)
    ]);
    const d = drivers.find(x => x.driverId === id);
    const s = standings[id] || {};
    const races = results.MRData.RaceTable.Races || [];
    const rows = races.map(r => {
      const res = r.Results[0];
      return `<tr><td class="pos">P${esc(res.position)}</td><td>${esc(r.raceName)}</td>
        <td>${esc(res.points)} pts</td><td>${esc(res.status)}</td></tr>`;
    }).join('');
    $('#detail-content').innerHTML = `
      <div class="detail-hero">
        <div class="avatar">${esc(d.code || (d.familyName||'').slice(0,3).toUpperCase())}</div>
        <div style="flex:1;min-width:0">
          <h2 class="view-title mb-1">${esc(d.givenName)} ${esc(d.familyName)}</h2>
          <p class="text-secondary mb-0">${esc(s.team || '—')} · ${nat(d.nationality)}</p>
          <span class="tag">Piloto</span>
        </div>
        <div class="big-num">${esc(d.permanentNumber || '')}</div>
      </div>
      <ul class="specs">
        <li><div class="k">Número</div><div class="v">${esc(d.permanentNumber || '—')}</div></li>
        <li><div class="k">Nacionalidad</div><div class="v">${nat(d.nationality)}</div></li>
        <li><div class="k">Escudería</div><div class="v">${esc(s.team || '—')}</div></li>
        <li><div class="k">Posición ${season}</div><div class="v">${s.position ? 'P'+esc(s.position) : '—'}</div></li>
        <li><div class="k">Victorias ${season}</div><div class="v">${esc(s.wins ?? '—')}</div></li>
        <li><div class="k">Puntos ${season}</div><div class="v">${esc(s.points ?? '—')}</div></li>
      </ul>
      ${rows ? `<h3 class="view-title fs-5 mt-4">Resultados por carrera · ${season}</h3>
        <div class="table-responsive"><table class="mini-table">
          <thead><tr><th>Pos.</th><th>Gran Premio</th><th>Puntos</th><th>Estado</th></tr></thead>
          <tbody>${rows}</tbody></table></div>` : ''}`;
  }catch(err){ errorBox($('#detail-content'), err.message); }
}

async function openRace(round, season){
  setDetail('Resultados <i class="bi bi-chevron-right"></i> <b>Detalle</b>',
    `<div class="state-box"><div class="spinner-border text-f1"></div></div>`, state.lastListView);
  try{
    const data = await api(`/${season}/${round}/results/?limit=30&format=json`);
    const race = data.MRData.RaceTable.Races[0];
    const results = race.Results || [];
    const rows = results.slice(0, 10).map(r => `
      <tr><td class="pos">P${esc(r.position)}</td>
          <td>${esc(r.Driver.givenName)} ${esc(r.Driver.familyName)}</td>
          <td>${esc(r.Constructor.name)}</td>
          <td>${esc(r.points)} pts</td>
          <td>${esc(r.Time?.time || r.status)}</td></tr>`).join('');
    $('#detail-content').innerHTML = `
      <div class="detail-hero">
        <div class="avatar">${esc(String(round).padStart(2,'0'))}</div>
        <div style="flex:1;min-width:0">
          <h2 class="view-title mb-1">${esc(race.raceName)}</h2>
          <p class="text-secondary mb-0">${esc(race.Circuit.circuitName)} · ${esc(race.Circuit.Location.locality)}, ${esc(race.Circuit.Location.country)}</p>
          <span class="tag">Carrera</span>
        </div>
        <div class="big-num">${fmtDate(race.date).toUpperCase()}</div>
      </div>
      <ul class="specs">
        <li><div class="k">Ronda</div><div class="v">${esc(race.round)} de ${season==='2024'?'24':'—'}</div></li>
        <li><div class="k">Circuito</div><div class="v">${esc(race.Circuit.circuitName)}</div></li>
        <li><div class="k">País</div><div class="v">${esc(race.Circuit.Location.country)}</div></li>
        <li><div class="k">Fecha</div><div class="v">${fmtDate(race.date)}</div></li>
      </ul>
      ${rows ? `<h3 class="view-title fs-5 mt-4">Clasificación final (Top 10)</h3>
        <div class="table-responsive"><table class="mini-table">
          <thead><tr><th>Pos.</th><th>Piloto</th><th>Escudería</th><th>Puntos</th><th>Tiempo/Estado</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
        : `<p class="text-secondary mt-3">Esta carrera aún no tiene resultados disponibles.</p>`}`;
  }catch(err){ errorBox($('#detail-content'), err.message); }
}

function openCircuit(id, season, races){
  const gps = races.filter(r => r.Circuit.circuitId === id);
  const c = gps[0]?.Circuit;
  if (!c) return;
  const rows = gps.map(r => `
    <tr><td class="pos">R${esc(r.round)}</td><td>${esc(r.raceName)}</td><td>${fmtDate(r.date)}</td></tr>`).join('');
  setDetail('Resultados <i class="bi bi-chevron-right"></i> <b>Detalle</b>', `
    <div class="detail-hero">
      <div class="avatar"><i class="bi bi-geo-alt"></i></div>
      <div style="flex:1;min-width:0">
        <h2 class="view-title mb-1">${esc(c.circuitName)}</h2>
        <p class="text-secondary mb-0">${esc(c.Location.locality)}, ${esc(c.Location.country)}</p>
        <span class="tag">Circuito</span>
      </div>
    </div>
    <ul class="specs">
      <li><div class="k">Localidad</div><div class="v">${esc(c.Location.locality)}</div></li>
      <li><div class="k">País</div><div class="v">${esc(c.Location.country)}</div></li>
      <li><div class="k">Latitud</div><div class="v">${esc(c.Location.lat)}</div></li>
      <li><div class="k">Longitud</div><div class="v">${esc(c.Location.long)}</div></li>
    </ul>
    <h3 class="view-title fs-5 mt-4">Gran Premio en este circuito · ${season}</h3>
    <div class="table-responsive"><table class="mini-table">
      <thead><tr><th>Ronda</th><th>Gran Premio</th><th>Fecha</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`, 'resultados');
}

// ====================== VISTA: CALENDARIO ======================
async function renderCalendar(){
  $('#cal-season').textContent = state.season;
  showView('calendario');
  const list = $('#calendar-list');
  list.innerHTML = `<div class="state-box"><div class="spinner-border text-f1"></div>
    <p class="mt-3 mb-0">Cargando calendario…</p></div>`;
  try{
    const races = await getRaces(state.season);
    list.innerHTML = '';
    races.forEach(r => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'race-item w-100';
      btn.innerHTML = `
        <span class="rnd">${esc(String(r.round).padStart(2,'0'))}</span>
        <span class="info"><span class="gp d-block">${esc(r.raceName)}</span>
          <span class="where">${esc(r.Circuit.circuitName)} · ${esc(r.Circuit.Location.country)}</span></span>
        <span class="date">${fmtDate(r.date)}</span>`;
      btn.addEventListener('click', () => openRace(r.round, state.season));
      list.appendChild(btn);
    });
  }catch(err){
    list.innerHTML = `<div class="state-box"><i class="bi bi-exclamation-triangle fs-3"></i>
      <p class="mt-2 mb-0">${esc(err.message)}</p></div>`;
  }
}

// ---- formato de fecha (es-MX) ----
const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
function fmtDate(iso){
  const [y,m,d] = (iso||'').split('-');
  if (!y) return '';
  return `${d} ${MESES[(+m)-1]}`;
}

// ====================== EVENTOS ======================
$('#search-form').addEventListener('submit', e => {
  e.preventDefault();
  state.season   = $('#season').value;
  state.category = $('input[name="cat"]:checked').value;
  state.query    = $('#q').value;
  state.standings = null;             // invalida caché de standings al cambiar temporada
  renderResults();
});

// botón "Regresar" del detalle: vuelve a la última lista mostrada
$('#btn-back').addEventListener('click', () => {
  if (state.lastListView === 'calendario') renderCalendar();
  else showView('resultados');
});

// al entrar a la vista Calendario desde la navbar/botones, carga datos
document.addEventListener('click', e => {
  const t = e.target.closest('[data-view="calendario"]');
  if (t) renderCalendar();
});

// ====================== INICIO ======================
showView('home');
