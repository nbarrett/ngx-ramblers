import { readFileSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
import { sync as globSync } from "glob";
import { pluraliseWithCount } from "../server/lib/shared/string-utils";

const sassModule = require(require.resolve("sass", { paths: [require.resolve("@angular/build/package.json")] }));

const rootDir = resolve(__dirname, "..");
const requestedFiles = process.argv.slice(2);
const componentFiles = requestedFiles.length > 0
  ? requestedFiles.filter(file => file.endsWith(".ts"))
  : globSync("projects/ngx-ramblers/src/app/**/*.ts", { cwd: rootDir, ignore: ["**/*.spec.ts"] });

const failures = componentFiles.flatMap(file => {
  const content = readFileSync(resolve(rootDir, file), "utf8");
  const blocks = [...content.matchAll(/styles:\s*(\[[\s\S]*?\]|`[^`]*`)/g)];
  return blocks.flatMap(block => {
    const blockStart = block.index || 0;
    const literals = [...block[1].matchAll(/`([^`]*)`/g)];
    return literals.flatMap(literal => {
      const literalStart = blockStart + block[0].indexOf(block[1]) + (literal.index || 0) + 1;
      const lineOffset = content.slice(0, literalStart).split("\n").length - 1;
      const source = literal[1].replace(/^[ \t]*\$\{[^}]*\}[ \t]*$/gm, "");
      try {
        sassModule.compileString(source, { syntax: "indented", url: pathToFileURL(resolve(rootDir, file)) });
        return [];
      } catch (error) {
        const line = lineOffset + (error?.span?.start?.line ?? 0) + 1;
        return [`${file}:${line}: ${error?.sassMessage || error?.message || error}`];
      }
    });
  });
});

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\nInline Sass check failed: ${pluraliseWithCount(failures.length, "error")} in ${pluraliseWithCount(componentFiles.length, "file")}\n`);
  process.exit(1);
} else {
  process.stdout.write(`Inline Sass check passed: ${pluraliseWithCount(componentFiles.length, "file")}\n`);
}
