import { defineConfig } from "vite";
import ts from "typescript";

const typescriptTransform = {
  name: "linguaflow-typescript-transform",
  enforce: "pre",
  transform(code, id) {
    if (!/\.[cm]?tsx?(?:\?|$)/.test(id) || id.includes("node_modules")) return null;
    const result = ts.transpileModule(code, {
      fileName: id,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        sourceMap: true,
      },
    });
    return { code: result.outputText, map: result.sourceMapText || null };
  },
};

export default defineConfig({
  plugins: [typescriptTransform],
  esbuild: false,
  base: "./",
  clearScreen: false,
  build: {
    target: "es2022",
    minify: false,
    cssMinify: false,
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
});
