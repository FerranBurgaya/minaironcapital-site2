
async function loadCromos(){
  const res = await fetch('/data/cromos.json');
  const items = await res.json();
  const grid = document.getElementById('grid-cromos');
  grid.innerHTML = items.map(it => `
    <a class="flip" href="${it.url_substack}" target="_blank" rel="noopener" title="${it.empresa}">
      <div class="flip-inner">
        <div class="flip-face">
          <div>
            <div class="badge">${it.mercado}:${it.ticker}</div>
            <h3 style="margin-top:10px">${it.empresa}</h3>
          </div>
        </div>
        <div class="flip-face flip-back">
          <p>${it.resumen}</p>
          <div class="badge ${it.premium?'lock':''}" style="margin-top:8px">${it.premium?'Premium':'Libre'}</div>
        </div>
      </div>
    </a>
  `).join('');
}
loadCromos();
