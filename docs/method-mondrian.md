# Composition Machine — method notes

Working notes for `src/scripts/mondrian.js`. Not published; the site page keeps
only what a reader needs.

Six things separate a generated Mondrian from a random grid, roughly in the order
they matter.

## 1. Recursive subdivision, not independent offsets

The canvas is split, then its parts are split again, then theirs. That produces
nested, unequal, aligned rectangles instead of a uniform lattice. This single
change does more for the resemblance than the other five combined. The naive
lattice mode on the page renders the alternative for comparison.

## 2. Splits are center-weighted, but never halves

Each cut is drawn from Beta(2,2), sampled as the median of three uniforms, then
nudged out of the band between 0.45 and 0.55. A flat uniform draw scatters cuts
too evenly; an exact half reads as mechanical.

```python
# the median of three uniforms is exactly Beta(2,2)
def split_ratio(rng):
    t = sorted(rng.random() for _ in range(3))[1]
    if 0.45 < t < 0.55:
        t += 0.12 * (1 if t > 0.5 else -1)
    return t
```

## 3. Cuts snap to a grid

Without the snap, cuts made in different branches of the recursion miss each other
by a pixel or two where they meet. The result reads as sloppy rather than as
hand-drawn.

The grid, the minimum cell size and the line widths are all scaled by
`k = min(W, H) / 1000`, so one seed draws the same composition at any canvas size.
Before that scaling existed, a 250px card thumbnail failed the minimum-size check
on its first split and rendered a single blank rectangle. `test/mondrian.test.js`
locks this: four seeds across four sizes must produce identical geometry.

## 4. Line weights come from a discrete set

Mondrian's lines vary, but between a handful of chosen widths rather than along a
continuum. Major divisions skew heavier than the cuts nested inside them, so the
structure of the recursion stays visible in the drawing.

## 5. Far less color than feels right

Roughly one cell in six, weighted red 0.40, blue 0.30, yellow 0.25, gray 0.05.
Two cells of the same hue may never share an edge. Ground is a warm off-white
(`#F4F1E8`) and lines a soft near-black (`#1A1919`); pure white and pure black are
the fastest way to make a painting look like a screenshot.

## 6. The composition is judged, not just rolled

Forty candidates are generated and scored on where the color's center of mass
falls. Dead center is rejected as too symmetric, a corner as unbalanced, and one
resting field swallowing more than a third of the canvas is penalized.

Two bugs worth remembering here:

- The tie-break must run toward **fewer** colored cells. An earlier version added
  `filled.length * 0.01` to the score, so among accepted compositions the search
  preferred the one with the most paint, working directly against rule 5.
- `colorCentroid` returns `-1` when nothing is filled. It used to return `1`, which
  is larger than any real centroid distance, so in the out-of-band branch a blank
  canvas outscored every real composition. At thumbnail sizes, where few cells get
  filled, that made blank the winner.

## Style modes

- **Classic (1930)** — black lines on warm white, a few filled cells. Subdivision.
- **New York City (1942)** — no black. Full-span colored lines that weave over and
  under each other, decided per crossing rather than by a global stacking order.
- **Boogie Woogie (1943)** — the same lines plus square blocks laid along them.
  Squares, never circles.

Grays and blacks are absent from both 1941+ modes: the line colors are the
primaries alone.
