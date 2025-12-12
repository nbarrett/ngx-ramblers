import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT_PROXY = `
require("ts-node").register({ transpileOnly: true });
module.exports = require("../eslint.config.ts").default;
`;

const PROJECT_PROXY = `
module.exports = require("../../eslint.config.js");
`;

const rootOutput = ".eslint-config/eslint.config.js";
const projectOutput = ".eslint-config/projects/ngx-ramblers/eslint.config.js";

const ensureDir = (filePath: string) => {
  mkdirSync(dirname(filePath), { recursive: true });
};

const writeFile = (filePath: string, contents: string) => {
  ensureDir(filePath);
  writeFileSync(filePath, `${contents.trim()}\n`);
};

writeFile(rootOutput, ROOT_PROXY);
writeFile(projectOutput, PROJECT_PROXY);
