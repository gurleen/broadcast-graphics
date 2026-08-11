/** @type {import('../../packages/gfx-sdk/src/config').HydraConfig} */
const config = {
  entry: 'src/index.ts',
  outDir: 'dist',
  // motion + zod + gurleen-ui shared with host; gsap is NOT listed → bundled
  shared: [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@hydra-tv/hydra-gfx-runtime',
    'motion/react',
    'zod',
    '@hydra-tv/ui',
  ],
  runtime: '^0.1.0',
}

export default config
