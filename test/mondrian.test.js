import * as M from '../src/scripts/mondrian.js';
let fail = 0;
const bad = (m) => { console.log('FAIL: ' + m); fail++; };

// 1. determinism
const a = JSON.stringify(M.generate({ seed: 42 }));
const b = JSON.stringify(M.generate({ seed: 42 }));
if (a !== b) bad('same seed gave different output');
if (a === JSON.stringify(M.generate({ seed: 43 }))) bad('different seeds gave identical output');

// 2. Beta(2,2) via median-of-three: mean ~0.5, and genuinely center-weighted
const r = M.Rng(7); let s = 0, mid = 0, N = 20000;
for (let i = 0; i < N; i++) { const v = r.beta22(); s += v; if (v > 0.3 && v < 0.7) mid++; }
const mean = s / N, midFrac = mid / N;
if (Math.abs(mean - 0.5) > 0.01) bad('beta22 mean ' + mean.toFixed(3));
// Beta(2,2) CDF is 3t^2-2t^3, so P(0.3<X<0.7) = 0.568 exactly.
if (Math.abs(midFrac - 0.568) > 0.015) bad('beta22 center mass ' + midFrac.toFixed(3));

// 3. classic geometry: cells in bounds, non-degenerate, area conserved
for (const density of ['sparse', 'balanced', 'dense']) {
  for (let seed = 1; seed <= 60; seed++) {
    const sc = M.generate({ seed, style: 'classic', density });
    let area = 0;
    sc.cells.forEach(c => {
      if (![c.x, c.y, c.w, c.h].every(Number.isFinite)) bad('non-finite cell');
      if (c.w <= 0 || c.h <= 0) bad('degenerate cell');
      if (c.x < -0.01 || c.y < -0.01 || c.x + c.w > sc.width + 0.01 || c.y + c.h > sc.height + 0.01) bad('cell out of bounds');
      area += c.w * c.h;
    });
    if (Math.abs(area - sc.width * sc.height) > 1) bad(density + ' seed ' + seed + ' area ' + area + ' vs ' + sc.width * sc.height);
    sc.lines.forEach(L => { if (!Number.isFinite(L.pos) || !(L.width > 0)) bad('bad line'); });
  }
}

// 4. cuts land on the 10-unit grid so T-junctions align
for (let seed = 1; seed <= 40; seed++) {
  M.generate({ seed, style: 'classic' }).lines.forEach(L => {
    if (L.pos % 10 !== 0) bad('cut off-grid at ' + L.pos);
  });
}

// 5. density actually orders cell counts
const avg = d => { let n = 0; for (let s = 1; s <= 40; s++) n += M.generate({ seed: s, density: d }).cells.length; return n / 40; };
const [sp, ba, de] = [avg('sparse'), avg('balanced'), avg('dense')];
if (!(sp < ba && ba < de)) bad(`density not monotonic: ${sp.toFixed(1)} ${ba.toFixed(1)} ${de.toFixed(1)}`);

// 6. color restraint: filled cells stay a minority, and no same-hue neighbors
let worstFrac = 0, adjacency = 0, sumFrac = 0, nFrac = 0;
for (let seed = 1; seed <= 80; seed++) {
  const sc = M.generate({ seed, color: 'vivid', density: 'dense' });
  const filled = sc.cells.filter(c => c.fill);
  worstFrac = Math.max(worstFrac, filled.length / sc.cells.length);
  sumFrac += filled.length / sc.cells.length; nFrac++;
  for (let i = 0; i < filled.length; i++)
    for (let j = i + 1; j < filled.length; j++) {
      const p = filled[i], q = filled[j], g = 24;
      if (p.fill === q.fill && p.x < q.x + q.w + g && q.x < p.x + p.w + g && p.y < q.y + q.h + g && q.y < p.y + p.h + g) adjacency++;
    }
}
const meanFrac = sumFrac / nFrac;
if (meanFrac > 0.30) bad('mean color too high at vivid: ' + meanFrac.toFixed(2));
if (worstFrac > 0.55) bad('worst-case color too high: ' + worstFrac.toFixed(2));
if (adjacency > 0) bad(adjacency + ' same-hue adjacent pairs slipped through');

// 7. composition: centroid inside the accepted band most of the time
let inBand = 0, trials = 200;
for (let seed = 1; seed <= trials; seed++) {
  const sc = M.generate({ seed });
  const d = M.colorCentroid(sc.cells.filter(c => c.fill), sc.width, sc.height);
  if (d > 0.08 && d < 0.35) inBand++;
}
if (inBand / trials < 0.9) bad('centroid rejection weak: ' + (inBand / trials * 100).toFixed(0) + '% in band');

// 8. woven modes
for (const style of ['nyc', 'boogie']) {
  for (let seed = 1; seed <= 40; seed++) {
    const sc = M.generate({ seed, style });
    if (!sc.lines.length) bad(style + ' produced no lines');
    sc.lines.forEach(L => { if (!Number.isFinite(L.pos) || !L.hue) bad(style + ' bad line'); });
    (sc.blocks || []).forEach(B => { if (!Number.isFinite(B.x) || !(B.w > 0)) bad(style + ' bad block'); });
    if (style === 'boogie' && !sc.blocks.length) bad('boogie produced no blocks');
    if (style === 'nyc' && sc.blocks.length) bad('nyc should have no blocks');
    if (sc.lines.some(L => L.hue === 'ink')) bad(style + ' used black, but 1941+ has none');
    const nV = sc.lines.filter(L => L.vertical).length, nH = sc.lines.length - nV;
    if (sc.crossings.length !== nV * nH) bad(style + ' crossing count wrong');
    sc.crossings.forEach(c => { if (typeof c.vOnTop !== 'boolean') bad('crossing missing weave'); });
  }
}

// 8b. resolution independence: one seed, one composition, any canvas size.
// Lengths used to be absolute pixels tuned for a 1000-wide canvas, so a 250px
// thumbnail failed the minimum-size check and rendered a single blank rectangle.
for (const seed of [4471, 7, 88, 1042]) {
  const shapes = [[1000,1240],[500,620],[333,413],[250,310]].map(([w,h]) => {
    const s = M.generate({ seed, density: 'balanced', width: w, height: h });
    return { cells: s.cells.length, lines: s.lines.length,
             filled: s.cells.filter(c => c.fill).length };
  });
  const ref = JSON.stringify(shapes[0]);
  shapes.forEach((s, i) => {
    if (JSON.stringify(s) !== ref) bad(`seed ${seed} differs at size index ${i}: ${JSON.stringify(s)} vs ${ref}`);
  });
  if (shapes[0].cells < 2) bad(`seed ${seed} produced a blank canvas`);
}

// 9. naive counterexample really is the uniform lattice
const nv = M.generate({ seed: 5, naive: true });
if (new Set(nv.lines.map(L => L.width)).size !== 1) bad('naive should use one line width');
if (nv.paint.ground !== '#FFFFFF' || nv.paint.ink !== '#000000') bad('naive should use pure white/black');
if (nv.cells.length !== 25) bad('naive 4x4 cuts should give 25 cells, got ' + nv.cells.length);

console.log(fail ? `\n${fail} failure(s)` : '\nall checks passed');
console.log(`cells  sparse ${sp.toFixed(1)} | balanced ${ba.toFixed(1)} | dense ${de.toFixed(1)}`);
console.log(`beta22 mean ${mean.toFixed(3)}  center-mass ${midFrac.toFixed(3)} (Beta(2,2) = 0.568)`);
console.log(`color at vivid/dense: mean ${(meanFrac * 100).toFixed(0)}%, max ${(worstFrac * 100).toFixed(0)}%`);
console.log(`composition in band: ${(inBand / trials * 100).toFixed(0)}%`);
process.exit(fail ? 1 : 0);
