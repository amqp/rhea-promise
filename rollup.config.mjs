import nodeResolve from "@rollup/plugin-node-resolve";
import cjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

import nodeBuiltins from "builtin-modules";
import pkg from "./package.json" assert { type: "json"};
import * as path from "path";
import { readFile } from "node:fs/promises";

function sourcemaps() {
  return {
    name: "load-source-maps",
    async load(id) {
      if (!id.endsWith(".js")) {
        return null;
      }
      try {
        const code = await readFile(id, "utf8");
        if (code.includes("sourceMappingURL")) {
          const basePath = path.dirname(id);
          const mapPath = code.match(/sourceMappingURL=(.*)/)?.[1];
          if (!mapPath) {
            this.warn({ message: "Could not find map path in file " + id, id });
            return null;
          }
          const absoluteMapPath = path.join(basePath, mapPath);
          const map = JSON.parse(await readFile(absoluteMapPath, "utf8"));
          this.debug({ message: "got map for file " + id, id });
          return { code, map };
        }
        this.debug({ message: "no map for file " + id, id });
        return { code, map: null };
      } catch (e) {
        function toString(error) {
          return error instanceof Error ? error.stack ?? error.toString() : JSON.stringify(error);
        }
        this.warn({ message: toString(e), id });
        return null;
      }
    },
  };
}


export default {
	input: 'dist-esm/lib/index.js',
  external: [
    ...nodeBuiltins,
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.devDependencies),
  ],
  output: { file: "dist/index.js", format: "cjs", sourcemap: true },
  preserveSymlinks: false,
  plugins: [sourcemaps(), nodeResolve(), cjs(), json()],
};
