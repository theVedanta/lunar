import esbuild from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  sourcemap: false,
  minify: true,
  logLevel: "info",
};

await esbuild.build({
  ...common,
  entryPoints: ["client/src/extension.ts"],
  outfile: "client/out/extension.js",
  external: ["vscode"],
});

await esbuild.build({
  ...common,
  entryPoints: ["server/src/server.ts"],
  outfile: "server/out/server.js",
});
