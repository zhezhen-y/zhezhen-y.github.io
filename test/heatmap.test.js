import * as H from '../src/scripts/heatmap.js';
let fail = 0; const bad = m => { console.log('FAIL: ' + m); fail++; };
const names = Object.keys(H.PALETTES);

// 1. determinism
const a = H.generate({seed:42}), b = H.generate({seed:42}), c = H.generate({seed:43});
if (Buffer.compare(Buffer.from(a.pixels), Buffer.from(b.pixels)) !== 0) bad('same seed differed');
if (Buffer.compare(Buffer.from(a.pixels), Buffer.from(c.pixels)) === 0) bad('different seeds identical');

// 2. every palette parses to valid rgb and its defaults are legal
for (const n of names) {
  const p = H.PALETTES[n];
  if (p.stops.length < 3) bad(n + ' needs at least 3 stops');
  p.stops.forEach(s => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(s)) bad(n + ' bad hex ' + s);
    const [r,g,bl] = H.hexToRgb(s);
    if ([r,g,bl].some(v => !Number.isFinite(v) || v < 0 || v > 255)) bad(n + ' hex out of range ' + s);
  });
  if (!['static','blobs','bands','rings'].includes(p.structure)) bad(n + ' bad default structure');
  if (!H.ASPECTS[p.aspect]) bad(n + ' bad default aspect');
  if (p.steps !== 0 && p.steps < 2) bad(n + ' steps must be 0 or >= 2');
}

// 3. ramp endpoints land exactly on the first and last stop
for (const n of names) {
  const stops = H.PALETTES[n].stops, r = H.buildRamp(stops, 256);
  const first = H.hexToRgb(stops[0]), last = H.hexToRgb(stops[stops.length-1]);
  for (let i = 0; i < 3; i++) {
    if (Math.abs(r[i] - first[i]) > 1) bad(n + ' ramp start off at channel ' + i);
    if (Math.abs(r[255*3+i] - last[i]) > 1) bad(n + ' ramp end off at channel ' + i);
  }
}

// 4. every structure produces a full-range, finite field
for (const st of ['static','blobs','bands','rings']) {
  for (const sc of ['fine','medium','broad']) {
    for (let seed = 1; seed <= 12; seed++) {
      const s = H.generate({seed, structure:st, scale:sc, palette:'monet', longEdge:200});
      let lo = Infinity, hi = -Infinity;
      for (const v of s.data) { if(!Number.isFinite(v)) bad(st+' non-finite'); if(v<lo)lo=v; if(v>hi)hi=v; }
      if (hi - lo < 1e-6) bad(`${st}/${sc} seed ${seed} is flat`);
      if (s.pixels.length !== s.width * s.height * 4) bad(st + ' pixel buffer size wrong');
      for (let i = 3; i < s.pixels.length; i += 4) if (s.pixels[i] !== 255) { bad(st+' alpha not opaque'); break; }
    }
  }
}

// 5. discrete really is discrete, and N == stops returns the stop colors exactly
for (const n of names) {
  const stops = H.PALETTES[n].stops, N = stops.length;
  const s = H.generate({seed:9, palette:n, steps:N, structure:'blobs', longEdge:220});
  const seen = new Set();
  for (let i = 0; i < s.pixels.length; i += 4) seen.add(`${s.pixels[i]},${s.pixels[i+1]},${s.pixels[i+2]}`);
  if (seen.size > N) bad(`${n} discrete N=${N} produced ${seen.size} colors`);
  const want = new Set(stops.map(h => H.hexToRgb(h).join(',')));
  for (const got of seen) if (!want.has(got)) bad(`${n} discrete emitted ${got}, not one of its stops`);
}

// 6. continuous uses a lot of the ramp (the renormalisation is doing its job)
{
  const s = H.generate({seed:3, palette:'monet', structure:'blobs', steps:0, longEdge:300});
  const seen = new Set();
  for (let i = 0; i < s.pixels.length; i += 4) seen.add(`${s.pixels[i]},${s.pixels[i+1]},${s.pixels[i+2]}`);
  if (seen.size < 60) bad('continuous ramp barely used: ' + seen.size + ' colors');
}

// 7. aspect ratios
for (const [name, want] of Object.entries(H.ASPECTS)) {
  const s = H.generate({seed:1, aspect:name, longEdge:600});
  const got = s.width / s.height, exp = want[0] / want[1];
  if (Math.abs(got - exp) > 0.02) bad(`aspect ${name}: got ${got.toFixed(3)} want ${exp.toFixed(3)}`);
  if (Math.max(s.width, s.height) !== 600) bad(`aspect ${name}: long edge ${Math.max(s.width,s.height)}`);
}

// 8. bands vary far more down than across; rings do not (structures are distinguishable)
function anisotropy(st) {
  const s = H.generate({seed:5, structure:st, palette:names[0], aspect:'square', longEdge:200});
  const W = s.width, Hh = s.height;
  let dv = 0, dh = 0;
  for (let y = 1; y < Hh; y++) for (let x = 1; x < W; x++) {
    dv += Math.abs(s.data[y*W+x] - s.data[(y-1)*W+x]);
    dh += Math.abs(s.data[y*W+x] - s.data[y*W+x-1]);
  }
  return dv / (dh || 1e-9);
}
const bandAniso = anisotropy('bands'), ringAniso = anisotropy('rings');
if (bandAniso < 3) bad('bands are not band-like: vertical/horizontal variation ratio ' + bandAniso.toFixed(2));
if (ringAniso > 2.5) bad('rings look banded: ratio ' + ringAniso.toFixed(2));

// 8b. every palette renders at its own declared defaults
for (const n of names) {
  const s = H.generate({seed:17, palette:n, longEdge:180});
  if (s.pixels.length !== s.width * s.height * 4) bad(n + ' default render wrong size');
  let lo = Infinity, hi = -Infinity;
  for (const v of s.data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi - lo < 1e-6) bad(n + ' renders flat at its defaults');
}

// 9. unknown inputs fail loudly rather than rendering something wrong
try { H.generate({palette:'picasso'}); bad('unknown palette did not throw'); } catch(e){}
try { H.generate({structure:'swirl'}); bad('unknown structure did not throw'); } catch(e){}

console.log(fail ? `\n${fail} failure(s)` : '\nall checks passed');
console.log(`palettes: ${names.length} (${names.join(', ')})`);
console.log(`bands anisotropy ${bandAniso.toFixed(1)}x  |  rings ${ringAniso.toFixed(2)}x`);
process.exit(fail ? 1 : 0);
