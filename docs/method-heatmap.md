# Heatmap as Art — method notes

Working notes for `src/scripts/heatmap.js`. Not published.

The palette is only half the work. A color scheme laid over white noise reads as
static in that artist's colors, never as a painting. Structure is the other half.

## 1. Spatial coherence is the whole trick

Sample a coarse lattice of random values and interpolate up with smoothstep
easing. Three lines of arithmetic, and white noise becomes soft organic form.
Every structure on the page is a variation on that idea.

- **static** — raw white noise on a coarse grid, read back with no interpolation.
  The blocky original, and it genuinely does look like woven textile.
- **blobs** — a coarse lattice, interpolated up.
- **bands** — a one-dimensional profile down the canvas.
- **rings** — concentric waves, warped.

## 2. Each palette wants its own field

O'Keeffe's magnified flowers are radial, so rings suit her. Kahlo's color is flat
and saturated rather than blended, so she gets hard steps. Mondrian is
rectilinear, so curves are exactly wrong for him. Selecting a palette loads the
structure, step count and aspect ratio that belong with it.

## 3. Continuous and discrete are different instruments

Monet and af Klint need smooth interpolation. Kusama, Kahlo and Mondrian need hard
steps, because their work has no gradients at all.

Discrete mode builds a lookup table of exactly N entries rather than quantizing
into a 256-entry ramp. Going through the 256 ramp landed a step off the real
stops: Mondrian red came out `#C7102E` instead of `#C8102E`.

## 4. Aspect ratio is free resemblance

The Ten Largest are tall panels. O'Keeffe's flower canvases are tall. Setting the
shape correctly costs nothing.

## Bugs worth remembering

- **The float32 black pixel.** `lo`/`hi` were tracked from the float64 samples
  while `data` stores float32, so at the minimum pixel `data[i]` sat one rounding
  step below `lo`, `t` went negative, and the ramp index went negative with it.
  `ramp[-255]` is `undefined`, which a `Uint8ClampedArray` writes as 0 — one dead
  black pixel per canvas, in palettes containing no black. The range is now read
  back out of the stored array, and `t` is clamped.
- **Bands were barely banded.** Built on a two-column lattice, which interpolates
  horizontally. Measured vertical-to-horizontal variation was 2.7x; a true 1D
  profile brought it to 60.7x. The test asserts it stays above 3.
- **Rings were a dartboard.** Evenly spaced concentric circles read as Op art.
  Fixed with a noise-warped radius, a gamma on the radius so ring widths differ,
  and an off-center ellipse.

## Palettes

Picked from each painter's colors by eye. Eyedropping high-resolution museum scans
would improve all of them.
