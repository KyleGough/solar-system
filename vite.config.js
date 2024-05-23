export default {
  root: "src/",
  publicDir: "../static/",
  base: "/",
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
