export default {
  root: "src/",
  publicDir: "../static/",
  base: "/solar-system/",
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
