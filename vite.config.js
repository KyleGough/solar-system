export default {
  root: "src/",
  publicDir: "../static/",
  base: "./",  // <-- Use relative paths for local serving
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