import { defineConfig } from 'astro/config';

export default defineConfig({
  // A user page is served from the domain root, so no `base` is needed.
  site: 'https://zhezhen-y.github.io',
  build: { format: 'directory' },
  image: {
    // Astro's sharp pipeline: the reason for leaving Jekyll.
    responsiveStyles: true,
  },
});
