// URL del CSV publicado (tu enlace de "Publicar al web" en formato CSV)
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSgVaeNu0Y5beRFiJc96wBv78_LWtZWv-DeFjZafuwhXUWPqSoMILllf1qJerCss17LdrQteulx7gcZ/pub?gid=0&single=true&output=csv";

// -------- Parser CSV robusto (respeta comas entrecomilladas) --------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQuotes) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === '\r') { /* ignore */ }
      else { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  return parseCSV(text);
}

// normaliza encabezados: minúsculas, sin acentos ni espacios raros
function norm(s){
  return (s||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

// Mapeo de alias -> clave canónica
const headerMap = {
  ticker: "ticker",
  empresa: "empresa",

  exdate: "ex_date",
  ex_date: "ex_date",
  fechaex: "ex_date",
  data: "ex_date",

  paydate: "pay_date",
  pay_date: "pay_date",
  paydat: "pay_date",
  pay_dat: "pay_date",

  importebruto: "importe_bruto",
  importe_bruto: "importe_bruto",
  importebru: "importe_bruto",
  "divaccion": "importe_bruto",
  "divaccio": "importe_bruto",

  moneda: "moneda",
  estado: "estado",

  fuenteurl: "fuente_url",
  fuente_url: "fuente_url",
  fuente: "fuente_url",
  link: "fuente_url"
};

function parse(rows) {
  if (!rows.length) return [];
  const head = rows[0].map(h => norm(h));
  const idxCanon = {};
  head.forEach((h, i) => {
    const canon = headerMap[h] || headerMap[h.replace(/s$/,"")];
    if (canon && idxCanon[canon] == null) idxCanon[canon] = i;
  });

  const data = rows.slice(1).filter(r => r.some(c => c && c.trim() !== ""));
  return data.map(r => {
    const g = k => (idxCanon[k] != null ? (r[idxCanon[k]] || "").trim() : "");

    // normaliza estado a minúsculas
    const estado = (g("estado") || "").toLowerCase();

    return {
      ticker: g("ticker"),
      empresa: g("empresa"),
      ex_date: g("ex_date"),
      pay_date: g("pay_date"),
      importe_bruto: g("importe_bruto"), // se muestra tal cual (sea 1,02 o 1.02)
      moneda: g("moneda") || "EUR",
      estado,
      fuente_url: g("fuente_url")
    };
  });
}

function monthKey(iso){
  if(!iso) return "Sin fecha";
  const trim = iso.trim();
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trim)) {
    d = new Date(trim); // YYYY-MM-DD
  } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trim)) {
    const [dd, mm, yy] = trim.split(/[\/\-]/);
    const y = (+yy < 100 ? 2000 + +yy : +yy);
    d = new Date(y, +mm - 1, +dd);
  } else {
    d = new Date(trim);
  }
  if (isNaN(d)) return iso;
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2, "0");
}

function renderTimeline(items){
  const byMonth = new Map();
  items.forEach(it => {
    const k = monthKey(it.ex_date);
    if(!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(it);
  });
  const container = document.getElementById("timeline");
  const months = Array.from(byMonth.keys()).sort();
  container.innerHTML = months.map(m => {
    const [y, mo] = m.split("-");
    const nice = (y && mo && !isNaN(+y)) ?
      (new Date(+y,(+mo||1)-1,1)).toLocaleDateString("es-ES",{month:"long",year:"numeric"}) :
      m;
    const lis = byMonth.get(m).map(it => `
      <li>
        <strong>${it.ticker || it.empresa}</strong> — ex: ${it.ex_date} (${it.estado || "?"})
        <span class="note"> imp: ${it.importe_bruto} ${it.moneda}</span>
      </li>`).join("");
    return `<div class="card"><h3>${nice}</h3><ul>${lis}</ul></div>`;
  }).join("");
}

function renderTable(items){
  const tbody = document.querySelector("#tabla tbody");
  tbody.innerHTML = items.map(it => `
    <tr>
      <td>${it.ticker}</td>
      <td>${it.empresa}</td>
      <td>${it.ex_date}</td>
      <td>${it.pay_date}</td>
      <td>${it.importe_bruto} ${it.moneda}</td>
      <td>${it.estado}</td>
      <td>${it.fuente_url ? `<a href="${it.fuente_url}" target="_blank" rel="noopener">fuente</a>` : ""}</td>
    </tr>`).join("");
}

function applyFilters(items){
  const q = (document.getElementById("q").value || "").toLowerCase();
  const st = document.getElementById("estado").value;
  return items.filter(it =>
    (it.ticker + " " + it.empresa).toLowerCase().includes(q) &&
    (!st || it.estado === st)
  );
}

(async function(){
  try{
    const rows = await fetchCSV(CSV_URL);
    let items = parse(rows);

    // primer pintado
    renderTimeline(items);
    renderTable(applyFilters(items));

    // filtros
    const qEl = document.getElementById("q");
    const stEl = document.getElementById("estado");
    if (qEl) qEl.addEventListener("input", () => renderTable(applyFilters(items)));
    if (stEl) stEl.addEventListener("change", () => renderTable(applyFilters(items)));

  }catch(err){
    console.error(err);
    document.getElementById("timeline").innerHTML =
      '<div class="card">No se pudo cargar el CSV. ¿Está publicado como CSV y accesible?</div>';
  }
})();
