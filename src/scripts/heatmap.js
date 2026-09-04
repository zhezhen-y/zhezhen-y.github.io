/* Heatmap generator: artist palettes over structured fields.
   Pure logic, no DOM. The whole argument of this page is that the palette is
   only half the work: a color scheme laid over white noise reads as static in
   that artist's colors, not as a painting. Structure is the other half. */

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

/* --------------------------------------------------------------- palettes */

/* Read from the paintings by eye, not sampled from scans. Eyedropping a
   high-resolution museum image will beat any of these.
   `structure`, `steps` and `aspect` are the defaults that suit each artist:
   O'Keeffe wants radial form on a tall panel, Kusama and Kahlo want hard
   edges, Mondrian wants rectangles. */
export const PALETTES = {
  hilma: {
    label: 'Hilma af Klint',
    work: 'The Ten Largest, 1907',
    stops: ['#EFE6D3', '#E9B7A8', '#D97E6A', '#F0C05A', '#8FA98C', '#7E9FBF', '#3B4E7E'],
    structure: 'rings', steps: 0, aspect: 'portrait',
    note: 'Chalky pastels on cream. The Ten Largest are tall panels, so the portrait canvas does real work here.'
  },
  vangogh: {
    label: 'Van Gogh',
    work: 'The Starry Night, 1889',
    stops: ['#0B1C48', '#173F7A', '#2E6DA4', '#3F8A72', '#E07B39', '#E8C547', '#F5E7A0'],
    structure: 'blobs', steps: 0, aspect: 'landscape',
    note: 'The ramp walks the painting from night to lamplight: deep blue, cobalt, the cypress green, then the orange of the village windows into chrome yellow and star white.'
  },
  monet: {
    label: 'Monet',
    work: 'Nymphéas',
    stops: ['#2E5E4E', '#4E8C7C', '#8FBFAE', '#C8CBE8', '#E3C4D8', '#F2E9D8'],
    structure: 'blobs', steps: 0, aspect: 'landscape',
    note: 'Adjacent hues, low contrast, no black anywhere. The shadows are violet, which is what makes it read as Impressionist.'
  },
  kusama: {
    label: 'Kusama',
    work: 'Pumpkin',
    stops: ['#F2B705', '#111111', '#FFFFFF', '#D6001C'],
    structure: 'blobs', steps: 4, aspect: 'square',
    note: 'Few colors, hard edges, no gradients. This one needs the discrete ramp; smooth interpolation destroys it.'
  },
  okeeffe: {
    label: "Georgia O'Keeffe",
    work: 'Red Canna, 1924',
    stops: ['#FBF1E4', '#F6D2A9', '#F0A15E', '#E1613F', '#C0334D', '#8A2352', '#4A1436'],
    structure: 'rings', steps: 0, aspect: 'portrait',
    note: 'Petals opening from a dark center, which is why rings suit her: the magnified flowers are radial, and the canvases are tall.'
  },
  kahlo: {
    label: 'Frida Kahlo',
    work: 'Self-Portrait with Thorn Necklace, 1940',
    stops: ['#1F2E22', '#2E5FA3', '#3E7A3C', '#A81C2E', '#D9662B', '#E8B22C', '#F2E4C9'],
    structure: 'blobs', steps: 7, aspect: 'portrait',
    note: 'Flat saturated color, not blended: dark foliage, the cobalt of the Casa Azul, leaf green, carmine, orange and marigold. Discrete by default, because the folk-art flatness is the point.'
  },

  klimt: {
    label: 'Klimt',
    work: 'The Kiss, 1908',
    stops: ['#0F0E0C', '#6E5A22', '#B08A2E', '#D8B04A', '#EFD98A'],
    structure: 'blobs', steps: 0, aspect: 'square',
    note: 'Gold leaf against near-black, with olive holding the two together.'
  },
  mondrian: {
    label: 'Mondrian',
    work: 'Neoplasticism',
    stops: ['#F4F1E8', '#C8102E', '#00539B', '#F2C200', '#1A1919'],
    structure: 'static', steps: 5, aspect: 'square',
    note: 'Included so the two generators rhyme. Rectilinear and discrete by necessity: Mondrian has neither curves nor gradients, so blobs are exactly wrong for it.'
  }
};

export const ASPECTS = { square: [1, 1], portrait: [1, 1.44], landscape: [1.5, 1] };

/* ------------------------------------------------------------- color ramp */

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Linear interpolation in sRGB, matching what
   matplotlib's LinearSegmentedColormap.from_list does, so the browser and the
   notebook produce the same colors from the same stops. */
export function buildRamp(stops, size) {
  const rgb = stops.map(hexToRgb);
  const ramp = new Uint8ClampedArray(size * 3);
  const segs = rgb.length - 1;
  for (let i = 0; i < size; i++) {
    const t = segs * (i / (size - 1));
    const j = Math.min(segs - 1, Math.floor(t));
    const f = t - j;
    for (let c = 0; c < 3; c++) {
      ramp[i * 3 + c] = rgb[j][c] + (rgb[j + 1][c] - rgb[j][c]) * f;
    }
  }
  return ramp;
}

/* --------------------------------------------------------------- fields */

/* Smoothstep easing on a coarse lattice. This is the whole trick: sample a
   small grid of random values and interpolate up, and white noise becomes
   soft organic form. Three lines of maths, and it is the difference between
   television static and something that looks composed. */
function ease(t) { return t * t * (3 - 2 * t); }

function lattice(rand, nx, ny) {
  const g = new Float32Array(nx * ny);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return g;
}

/* A one-dimensional profile: varies down the canvas, constant across it.
   Bands used a two-column lattice, which interpolated horizontally and left
   the strata only 2.7x more vertical than horizontal. */
function sample1D(g, n, v) {
  const y = v * (n - 1);
  const y0 = Math.min(n - 2, Math.floor(y));
  const f = ease(y - y0);
  return g[y0] + (g[y0 + 1] - g[y0]) * f;
}

function sampleLattice(g, nx, ny, u, v) {
  const x = u * (nx - 1), y = v * (ny - 1);
  const x0 = Math.min(nx - 2, Math.floor(x)), y0 = Math.min(ny - 2, Math.floor(y));
  const fx = ease(x - x0), fy = ease(y - y0);
  const a = g[y0 * nx + x0],       b = g[y0 * nx + x0 + 1];
  const c = g[(y0 + 1) * nx + x0], d = g[(y0 + 1) * nx + x0 + 1];
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

export const SCALES = { fine: 14, medium: 7, broad: 4 };

/* Each structure returns a sampler over normalized (u, v) in [0,1]. */
export function makeField(kind, rand, scale) {
  const n = SCALES[scale] || SCALES.medium;

  if (kind === 'static') {
    /* Raw white noise on a coarse grid, read back with no interpolation:
       the blocky original, which does genuinely look like woven textile. */
    const cells = Math.round(n * 3.2);
    const g = lattice(rand, cells, cells);
    return function (u, v) {
      const x = Math.min(cells - 1, Math.floor(u * cells));
      const y = Math.min(cells - 1, Math.floor(v * cells));
      return g[y * cells + x];
    };
  }

  if (kind === 'blobs') {
    const g = lattice(rand, n, n);
    return function (u, v) { return sampleLattice(g, n, n, u, v); };
  }

  if (kind === 'bands') {
    /* Strata: coarse variation down the canvas, almost none across it.
       The slight horizontal wobble stops it looking like a CSS gradient. */
    const rows = Math.max(4, Math.round(n * 0.9));
    const g = lattice(rand, 1, rows);
    const wob = lattice(rand, 3, 3);
    return function (u, v) {
      return sample1D(g, rows, v) * 0.94 +
             sampleLattice(wob, 3, 3, u, v) * 0.06;
    };
  }

  if (kind === 'rings') {
    /* The af Klint mode. Three things stop this being a dartboard, which is
       what evenly spaced concentric circles actually look like:
         - the radius is warped by a slow noise field, so no ring is a true
           circle and the whole system drifts,
         - a gamma on the radius makes inner and outer rings differ in width,
         - the form is elliptical and off-center.
       Ring count is also far lower than it first was; few wide bands read as
       painted, many thin ones read as Op art. */
    const cx = 0.5 + (rand() - 0.5) * 0.44;
    const cy = 0.5 + (rand() - 0.5) * 0.44;
    const freq  = 1.5 + rand() * 1.9;
    const phase = rand() * Math.PI * 2;
    const sx    = 0.78 + rand() * 0.55;
    const gamma = 0.62 + rand() * 0.85;
    const warp  = lattice(rand, 4, 4);
    return function (u, v) {
      const dx = (u - cx) / sx, dy = v - cy;
      let r = Math.sqrt(dx * dx + dy * dy);
      r += (sampleLattice(warp, 4, 4, u, v) - 0.5) * 0.30;
      const rr = Math.pow(r < 0 ? 0 : r, gamma);
      return 0.5 + 0.5 * Math.sin(rr * freq * Math.PI * 2 + phase);
    };
  }

  throw new Error('unknown structure: ' + kind);
}

/* ---------------------------------------------------------------- entry */

export function generate(options) {
  const o = Object.assign({
    seed: 1, palette: 'hilma', structure: null, steps: null,
    aspect: null, scale: 'medium', longEdge: 760
  }, options || {});

  const pal = PALETTES[o.palette];
  if (!pal) throw new Error('unknown palette: ' + o.palette);

  const structure = o.structure || pal.structure;
  const steps = o.steps === null ? pal.steps : o.steps;
  const aspect = o.aspect || pal.aspect;

  const ar = ASPECTS[aspect] || ASPECTS.square;
  const W = Math.round(o.longEdge * ar[0] / Math.max(ar[0], ar[1]));
  const H = Math.round(o.longEdge * ar[1] / Math.max(ar[0], ar[1]));

  const rand = mulberry32(o.seed >>> 0);
  const field = makeField(structure, rand, o.scale);

  /* Sample, tracking the range so the palette always spans the full field.
     Without the renormalisation a quiet field uses a sliver of the ramp and
     the artist's colors never actually appear. */
  const data = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) data[y * W + x] = field(x / (W - 1), y / (H - 1));
  }

  /* Read the range back OUT of the array. Tracking it from the float64
     samples while storing float32 leaves the minimum pixel a rounding step
     below `lo`, which drives the ramp index negative; the resulting
     `undefined` lands in a Uint8ClampedArray as a single stray black pixel. */
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = (hi - lo) || 1;

  /* One lookup table either way. Discrete builds a ramp of exactly `steps`
     entries, so when steps equals the number of stops the table IS the stops,
     with no interpolation error; continuous builds the usual 256. */
  const levels = steps > 1 ? steps : 256;
  const lut = buildRamp(pal.stops, levels);
  const pixels = new Uint8ClampedArray(W * H * 4);

  for (let i = 0; i < data.length; i++) {
    let t = (data[i] - lo) / span;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const k = Math.min(levels - 1, Math.floor(t * levels)) * 3;
    const p = i * 4;
    pixels[p]     = lut[k];
    pixels[p + 1] = lut[k + 1];
    pixels[p + 2] = lut[k + 2];
    pixels[p + 3] = 255;
  }

  return {
    width: W, height: H, pixels: pixels, data: data,
    palette: o.palette, paletteLabel: pal.label, work: pal.work, note: pal.note,
    structure: structure, steps: steps, aspect: aspect, scale: o.scale, seed: o.seed >>> 0
  };
}
