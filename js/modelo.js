/* Modelo compartido por la visualización (js/main.js) y la tablet (tablet.html).
 * 100 colmenas; cada trimestre muere el % que reportó el USDA.
 *   sin  -> encadena el % de pérdida, sin reposición (100 → ~3)
 *   real -> número de colonias indexado a 100 (los apicultores reponen)
 * Las celdas mueren siempre en el mismo orden (semilla fija), así el PC y la tablet muestran el mismo panal.
 * Necesita d3 y data/data.js cargados antes.
 */
window.Modelo = (function () {
  const D = window.DATA;
  const Q = D.periods;
  const N = Q.length;                           // puntos 0..N = inicio de cada trimestre (+ final)
  const CELLS = 100;
  const MES = ['ene', 'abr', 'jul', 'oct'];

  const rows = D.series.US;
  const sin = [100];
  rows.forEach((r, t) => sin.push(sin[t] * (1 - (r.missing || r.pct == null ? 0 : r.pct) / 100)));
  const n0 = rows.find(r => r.n)?.n;
  let real = rows.map(r => (r.n ? (r.n / n0) * 100 : null));
  real = real.map((v, i) => v ?? (((real[i - 1] ?? real[i + 1]) + (real[i + 1] ?? real[i - 1])) / 2));
  real.push(real[N - 1]);                       // el último punto repite el último conteo publicado
  const meanPct = d3.mean(rows.filter(r => !r.missing && r.pct != null), r => r.pct);

  const rank = d3.shuffler(d3.randomLcg(0.42))(d3.range(CELLS));

  const alive = (t, mode) => (mode === 'sin' ? sin[t] : real[t]);
  function cellState(i, t, mode) {
    const r = rank[i];
    const A = Math.round(sin[t]);
    if (mode === 'sin') return r < A ? 'viva' : 'muerta';
    const R = Math.min(CELLS, Math.round(real[t]));
    if (R <= A) return r < R ? 'viva' : 'muerta';
    if (r < A) return 'viva';
    return r >= CELLS - (R - A) ? 'repuesta' : 'muerta';
  }
  const pointLabel = t => (t < N ? `${MES[Q[t].q - 1]} ${Q[t].year}` : 'jul 2021');

  return { N, CELLS, rows, sin, real, meanPct, rank, alive, cellState, pointLabel };
})();
