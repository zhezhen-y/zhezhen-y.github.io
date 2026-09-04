# zhezhen-y.github.io

Generative sciart, and write-ups of how each piece works.
Live at <https://zhezhen-y.github.io>.

Two generators, both seeded, both running in the browser:

- **Composition Machine** (`/mondrian`) builds Mondrian compositions by recursive
  subdivision rather than by scattering independent line offsets, and can render the naive
  version beside it for comparison.
- **Heatmap as Art** (`/heatmap-as-art`) renders heatmaps in eight painters' palettes over
  four kinds of structured field, which is the part that makes a palette read as a painting
  instead of as static.

Every image comes from a seed you can copy, so any result is reproducible.

## Running it

```
npm install
npm run dev      # local server
npm test         # the generator test suites
npm run build    # static build into dist/
```

## Layout

```
src/scripts/     the two generators, plain ES modules with no dependencies
src/pages/       one file per route
src/styles/      design tokens and the shared generator chrome
src/assets/      images that go through Astro's optimizer
test/            node test suites run in CI before any deploy
```

The generators are dependency-free modules and are tested directly, so they can be dropped
into a notebook or another page without the site around them.

## Deploying

Pushing to `main` runs the tests, builds, and publishes via GitHub Actions.
Repository **Settings → Pages → Source** must be set to **GitHub Actions**.
