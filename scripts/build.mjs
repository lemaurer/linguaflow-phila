import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import ts from "typescript";

const cssFiles = new Map();
const cssPlugin = {
  name: "linguaflow-css",
  async load(id) {
    if (!id.endsWith(".css")) return null;
    cssFiles.set(id, await readFile(id, "utf8"));
    return "export default undefined;";
  },
};

const productionEnvPlugin = {
  name: "linguaflow-production-env",
  transform(code) {
    if (!code.includes("process.env.NODE_ENV")) return null;
    return { code: code.replaceAll("process.env.NODE_ENV", JSON.stringify("production")), map: null };
  },
};

const typescriptPlugin = {
  name: "linguaflow-typescript",
  transform(code, id) {
    if (!/\.[cm]?tsx?$/.test(id) || id.includes("node_modules")) return null;
    const result = ts.transpileModule(code, {
      fileName: id,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        sourceMap: false,
      },
    });
    return { code: result.outputText, map: null };
  },
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });

const bundle = await rollup({
  input: "src/main.tsx",
  plugins: [
    nodeResolve({ browser: true, extensions: [".mjs", ".js", ".json", ".ts", ".tsx"] }),
    productionEnvPlugin,
    cssPlugin,
    typescriptPlugin,
    commonjs(),
  ],
});
await bundle.write({ file: "dist/assets/index.js", format: "es", sourcemap: false });
await bundle.close();

await writeFile("dist/assets/index.css", [...cssFiles.values()].join("\n"));
await writeFile("dist/index.html", `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f8f9fc" />
    <title>LinguaFlow</title>
    <link rel="stylesheet" href="./assets/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/index.js"></script>
  </body>
</html>
`);

console.log("LinguaFlow production bundle created.");
