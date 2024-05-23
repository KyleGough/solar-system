export default {
  root: "src/",
  publicDir: "../static/",
  base: process.env.VITE_BASE_PATH || "/solar-system/",
  server: {
    host: true,
    open: false,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
  },
};
