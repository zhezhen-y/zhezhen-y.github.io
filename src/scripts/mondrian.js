/* Mondrian generator.
   Pure logic: takes options, returns a scene description. No DOM, no rendering.
   Kept separate so the same functions can be unit-tested in node, rendered to
   SVG in the browser, and quoted piece by piece in the tutorial. */

/* ---------------------------------------------------------------- random */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Rng(seed) {
  const u = mulberry32(seed);
  return {
    u: u,
    range: function (a, b) { return a + u() * (b - a); },
    int: function (a, b) { return Math.floor(a + u() * (b - a + 1)); },
    chance: function (p) { return u() < p; },
    pick: function (arr) { return arr[Math.floor(u() * arr.length)]; },
    /* The median of three uniforms is exactly Beta(2,2): center-weighted,
       so splits cluster near the middle without ever being flat. */
    beta22: function () {
      const s = [u(), u(), u()].sort(function (x, y) { return x - y; });
      return s[1];
    },
    weighted: function (items, weights) {
      let r = u() * weights.reduce(function (a, b) { return a + b; }, 0);
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    }
  };
}

/* ---------------------------------------------------------------- paint */

/* Warm canvas and soft black. Pure #FFFFFF and #000000 are the fastest way
   to make a generated Mondrian look like a screenshot instead of a painting. */
export const PAINT = {
  ground: '#F4F1E8',
  ink:    '#1A1919',
  red:    '#C8102E',
  blue:   '#00539B',
  yellow: '#F2C200',
  gray:   '#D8D5CB',
  white:  '#FBF9F1'
};

/* The deliberately wrong palette, for the side-by-side counterexample. */
export const NAIVE_PAINT = {
  ground: '#FFFFFF',
  ink:    '#000000',
  red:    '#FF0000',
  blue:   '#0000FF',
  yellow: '#FFFF00',
  gray:   '#CCCCCC',
  white:  '#FFFFFF'
};

/* Red leads, then blue, then yellow. Gray is rare. Measured by eye across
   the 1921-1933 canvases; the exact ratio matters less than the ordering. */
const HUES   = ['red', 'blue', 'yellow', 'gray'];
const HUE_W  = [0.40, 0.30, 0.25, 0.05];

export const DENSITY = {
  sparse:   { maxDepth: 4, minSide: 120, restProb: 0.22 },
  balanced: { maxDepth: 5, minSide: 95,  restProb: 0.15 },
  dense:    { maxDepth: 6, minSide: 58,  restProb: 0.10 }
};

/* Discrete weights, not a continuous distribution. Mondrian's lines vary,
   but they vary between a handful of chosen widths. */
export const WEIGHTS = {
  thin:  { widths: [3, 4, 6],      weights: [4, 3, 2] },
  mixed: { widths: [4, 6, 10, 16], weights: [5, 4, 2, 1] },
  bold:  { widths: [8, 12, 18],    weights: [3, 3, 2] }
};

export const FILL_RATE = { restrained: 0.10, balanced: 0.16, vivid: 0.26 };

/* ---------------------------------------------------------- subdivision */

/* Recursively split the canvas. This single change does more for the
   resemblance than everything else combined: it produces nested, unequal,
   aligned rectangles instead of a uniform lattice. */
export function subdivide(rect, rng, opts, depth, cuts, leaves) {
  const x = rect[0], y = rect[1], w = rect[2], h = rect[3];

  if (depth >= opts.maxDepth || Math.min(w, h) < opts.minSide * 2) {
    leaves.push({ x: x, y: y, w: w, h: h });
    return;
  }

  /* Prefer splitting the longer side, but not always: always doing so
     produces suspiciously square cells. */
  const vertical = rng.chance(w > h ? 0.70 : 0.30);
  const span = vertical ? w : h;

  let t = rng.beta22();
  if (t > 0.45 && t < 0.55) t += 0.12 * (t > 0.5 ? 1 : -1);  // never an exact half

  /* Snap to a grid so cuts made in different branches line up. Without this
     you get near-miss T-junctions that read as sloppy, not as hand-drawn. */
  const grid = opts.grid;
  let cut = Math.round((span * t) / grid) * grid;

  if (Math.min(cut, span - cut) < opts.minSide) {
    leaves.push({ x: x, y: y, w: w, h: h });
    return;
  }

  /* Major divisions carry more weight than minor ones. */
  const wspec = opts.weightSpec;
  const bias = Math.max(0, wspec.widths.length - 1 - depth);
  const widths = wspec.widths.slice(bias > 0 ? 0 : 0);
  const width = rng.weighted(widths, wspec.weights.map(function (v, i) {
    return depth <= 1 ? v * (i + 1) : v;   // early cuts skew heavier
  }));

  let a, b;
  if (vertical) {
    cuts.push({ vertical: true, pos: x + cut, from: y, to: y + h, width: width, depth: depth });
    a = [x, y, cut, h];
    b = [x + cut, y, w - cut, h];
  } else {
    cuts.push({ vertical: false, pos: y + cut, from: x, to: x + w, width: width, depth: depth });
    a = [x, y, w, cut];
    b = [x, y + cut, w, h - cut];
  }

  [a, b].forEach(function (r) {
    if (rng.chance(opts.restProb)) leaves.push({ x: r[0], y: r[1], w: r[2], h: r[3] });
    else subdivide(r, rng, opts, depth + 1, cuts, leaves);
  });
}

/* ---------------------------------------------------------- composition */

function touching(a, b) {
  const gap = 24;  // cells separated only by a line still count as adjacent
  const hOverlap = a.x < b.x + b.w + gap && b.x < a.x + a.w + gap;
  const vOverlap = a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
  return hOverlap && vOverlap;
}

/* Area-weighted centroid of the colored cells, in canvas-relative units
     0   = dead center (too symmetric, reads as a chessboard)
     0.5 = jammed into a corner (reads as a mistake, not a choice)
   Mondrian's balance lives in between. */
export function colorCentroid(filled, W, H) {
  let ax = 0, ay = 0, area = 0;
  filled.forEach(function (c) {
    const a = c.w * c.h;
    ax += (c.x + c.w / 2) * a;
    ay += (c.y + c.h / 2) * a;
    area += a;
  });
  if (!area) return -1;   // must LOSE the scoring, not win it
  const dx = ax / area / W - 0.5;
  const dy = ay / area / H - 0.5;
  return Math.sqrt(dx * dx + dy * dy);
}

function assignFills(leaves, rng, rate, naive) {
  const filled = [];
  leaves.forEach(function (c) { c.fill = null; });

  leaves.forEach(function (c) {
    if (!rng.chance(rate)) return;
    const hue = naive ? rng.pick(HUES) : rng.weighted(HUES, HUE_W);
    /* Never let two cells of the same hue share an edge. */
    if (!naive) {
      for (let i = 0; i < filled.length; i++) {
        if (filled[i].fill === hue && touching(filled[i], c)) return;
      }
    }
    c.fill = hue;
    filled.push(c);
  });
  return filled;
}

/* ------------------------------------------------------------- classic */

function classic(seed, o) {
  const W = o.width, H = o.height;
  const dens = DENSITY[o.density];

  /* Every tuned length below is written against a 1000-unit short edge; k
     rescales them so the same seed draws the same composition whether it
     renders as a 250px card thumbnail or a full-size canvas. */
  const k = Math.min(W, H) / 1000;
  const wspec0 = WEIGHTS[o.weight];
  const opts = {
    maxDepth: dens.maxDepth,
    minSide: Math.max(10, dens.minSide * k),
    restProb: o.naive ? 0 : dens.restProb,
    grid: Math.max(2, Math.round(10 * k)),
    weightSpec: {
      widths: wspec0.widths.map(function (w) { return Math.max(1, Math.round(w * k)); }),
      weights: wspec0.weights
    }
  };

  let best = null, bestScore = -1;
  const tries = o.naive ? 1 : 40;

  for (let attempt = 0; attempt < tries; attempt++) {
    const rng = Rng(seed + attempt * 7919);
    const cuts = [], leaves = [];

    if (o.naive) {
      /* The counterexample: independent random offsets, one line width,
         no hierarchy. This is the uniform lattice the tutorial argues against. */
      const nv = 4, nh = 4, wdt = Math.max(1, Math.round(8 * k));
      const xs = [], ys = [];
      for (let i = 0; i < nv; i++) xs.push(Math.round(rng.range(0.08, 0.92) * W));
      for (let i = 0; i < nh; i++) ys.push(Math.round(rng.range(0.08, 0.92) * H));
      xs.sort(function (a, b) { return a - b; });
      ys.sort(function (a, b) { return a - b; });
      xs.forEach(function (x) { cuts.push({ vertical: true,  pos: x, from: 0, to: H, width: wdt, depth: 0 }); });
      ys.forEach(function (y) { cuts.push({ vertical: false, pos: y, from: 0, to: W, width: wdt, depth: 0 }); });
      const xb = [0].concat(xs, [W]), yb = [0].concat(ys, [H]);
      for (let i = 0; i < xb.length - 1; i++)
        for (let j = 0; j < yb.length - 1; j++)
          leaves.push({ x: xb[i], y: yb[j], w: xb[i + 1] - xb[i], h: yb[j + 1] - yb[j] });
    } else {
      /* Many canvases carry a line running close to one edge, leaving a narrow
         band. It is an ordinary cut, so make it one and subdivide both sides. */
      if (rng.chance(0.45)) {
        const vert = rng.chance(0.5);
        const span = vert ? W : H;
        const band = Math.round(rng.range(0.05, 0.13) * span / opts.grid) * opts.grid;
        const near = rng.chance(0.5);
        const pos  = near ? band : span - band;
        const wid  = rng.weighted(opts.weightSpec.widths, opts.weightSpec.weights);
        cuts.push({ vertical: vert, pos: pos, from: 0, to: vert ? H : W, width: wid, depth: 0 });
        const a = vert ? [0, 0, pos, H] : [0, 0, W, pos];
        const b = vert ? [pos, 0, W - pos, H] : [0, pos, W, H - pos];
        const big = (a[2] * a[3] > b[2] * b[3]) ? a : b;
        const small = big === a ? b : a;
        subdivide(big, rng, opts, 1, cuts, leaves);
        if (rng.chance(0.5)) subdivide(small, rng, opts, 2, cuts, leaves);
        else leaves.push({ x: small[0], y: small[1], w: small[2], h: small[3] });
      } else {
        subdivide([0, 0, W, H], rng, opts, 0, cuts, leaves);
      }
    }

    const rate = o.naive ? 0.30 : FILL_RATE[o.color];
    const filled = assignFills(leaves, rng, rate, o.naive);

    if (o.naive) { best = { cuts: cuts, leaves: leaves }; break; }

    /* Reject compositions dominated by one huge resting field: Mondrian leaves
       large empty areas, but never half the canvas in a single untouched block. */
    let maxLeaf = 0;
    leaves.forEach(function (c) { maxLeaf = Math.max(maxLeaf, c.w * c.h); });
    /* Graded, not a veto: a hard second constraint made the search fail both
       and fall back out of band. Balance must always outrank tidiness. */
    const hogPen = Math.max(0, maxLeaf / (W * H) - 0.34) * 3;

    /* Reject compositions that are too centered or too lopsided, then prefer the
       one sitting nearest the middle of the accepted band. Note the tie-break
       runs toward FEWER colored cells: restraint is the whole point, so the
       search must never be able to buy a better score with more paint. */
    const d = colorCentroid(filled, W, H);
    const inBand = filled.length >= 3 && d > 0.08 && d < 0.35;
    const score = inBand
      ? 1 + (1 - Math.abs(d - 0.20) / 0.15) - filled.length * 0.01 - hogPen
      : d * 0.001;
    if (score > bestScore) { bestScore = score; best = { cuts: cuts, leaves: leaves }; }
    if (score > 1.4 && hogPen === 0) break;
  }

  return {
    mode: 'classic', width: W, height: H,
    paint: o.naive ? NAIVE_PAINT : PAINT,
    cells: best.leaves, lines: best.cuts,
    lineColour: 'ink', border: 0
  };
}

/* -------------------------------------------- new york city / boogie woogie */

/* From 1941 the black disappears: the lines themselves carry the color and
   cross over and under each other like woven tape. Full-span lines are
   correct here, which is why subdivision is used only for the classic mode. */
function woven(seed, o) {
  const W = o.width, H = o.height;
  const rng = Rng(seed);
  const k = Math.min(W, H) / 1000;
  const wspec = WEIGHTS[o.weight];
  const boogie = o.style === 'boogie';

  const counts = { sparse: [2, 4], balanced: [4, 6], dense: [6, 8] }[o.density];
  const nv = rng.int(counts[0], counts[1]);
  const nh = rng.int(counts[0], counts[1]);

  /* No gray and no black: from 1941 the line colors are the primaries alone. */
  const hues = boogie ? ['yellow', 'yellow', 'yellow', 'red', 'blue']
                      : ['yellow', 'yellow', 'red', 'blue'];

  const lines = [];
  function lay(vertical, n) {
    const used = [];
    for (let i = 0; i < n; i++) {
      let pos, guard = 0;
      do {
        var snap = Math.max(2, Math.round(10 * k));
        pos = Math.round(rng.range(0.05, 0.95) * (vertical ? W : H) / snap) * snap;
        guard++;
      } while (guard < 20 && used.some(function (p) { return Math.abs(p - pos) < 70 * k; }));
      used.push(pos);
      lines.push({
        vertical: vertical, pos: pos,
        from: 0, to: vertical ? H : W,
        width: Math.max(1, Math.round(rng.weighted(wspec.widths, wspec.weights) * 1.9 * k)),
        hue: rng.pick(hues),
        layer: rng.u()
      });
    }
  }
  lay(true, nv);
  lay(false, nh);

  /* Broadway Boogie Woogie's dashes: squares laid along the lines in the
     line's own width, at irregular intervals, in a contrasting hue.
     They are squares, never circles. */
  const blocks = [];
  if (boogie) {
    lines.forEach(function (L) {
      const span = L.vertical ? H : W;
      let at = rng.range(0.05, 0.2) * span;
      while (at < span * 0.95) {
        if (rng.chance(0.4)) {
          const size = L.width * rng.weighted([1.5, 2.2, 3.2], [3, 3, 2]);
          blocks.push({
            x: (L.vertical ? L.pos : at) - size / 2,
            y: (L.vertical ? at : L.pos) - size / 2,
            w: size, h: size,
            hue: rng.weighted(['red', 'blue', 'white'], [3, 3, 2]),
            layer: L.layer + 0.001
          });
        }
        at += rng.range(0.10, 0.26) * span;
      }
    });
    /* A few larger blocks resting in the open fields. */
    const free = rng.int(2, 5);
    for (let i = 0; i < free; i++) {
      const size = rng.range(0.04, 0.10) * Math.min(W, H);
      blocks.push({
        x: rng.range(0.05, 0.9) * W, y: rng.range(0.05, 0.9) * H,
        w: size, h: size * rng.range(0.7, 1.4),
        hue: rng.weighted(['red', 'blue', 'gray'], [3, 3, 1]),
        layer: -1
      });
    }
  }

  /* True weaving, decided per crossing rather than by a global stacking order:
     one line passes over its neighbor here and under it there, the way the
     painted tape actually reads on the 1942 canvas. */
  const crossings = [];
  lines.forEach(function (V, vi) {
    if (!V.vertical) return;
    lines.forEach(function (Hl, hi) {
      if (Hl.vertical) return;
      crossings.push({
        v: vi, h: hi, x: V.pos, y: Hl.pos,
        vOnTop: rng.chance(V.hue === 'yellow' && Hl.hue !== 'yellow' ? 0.75 : 0.5)
      });
    });
  });

  return {
    mode: boogie ? 'boogie' : 'nyc',
    width: W, height: H,
    paint: PAINT,
    ground: boogie ? 'white' : 'ground',
    lines: lines, blocks: blocks, crossings: crossings, cells: [], border: 0
  };
}

/* ---------------------------------------------------------------- entry */

export function generate(options) {
  const o = Object.assign({
    seed: 1, style: 'classic', density: 'balanced', weight: 'mixed',
    color: 'balanced', naive: false, width: 1000, height: 1240
  }, options || {});
  return o.style === 'classic' ? classic(o.seed >>> 0, o) : woven(o.seed >>> 0, o);
}
