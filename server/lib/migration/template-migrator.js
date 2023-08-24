
const {clone} = require("lodash");
const mkdirpsync = require('mkdirpsync');
const {envConfig} = require("../env-config/env-config");
const stringUtils = require("../shared/string-utils");
const debug = require("debug")(envConfig.logNamespace("template-migrator"));
let fs = require("fs");
const path = require("path");
const {resolve} = path;
const {readdir, stat} = fs.promises;

exports.migrateTemplate = (req, res) => {

  async function walkDir(dir, filter) {
    filter = filter || (() => true);
    let list = await readdir(dir);
    let results = await Promise.all(list.map(file => {
      file = resolve(dir, file);
      return stat(file).then(stat => {
        if (stat.isDirectory()) {
          return walkDir(file, filter);
        } else {
          return filter(file) ? file : "";
        }
      });
    }));
    return (await results.filter(f => !!f)).flat(2);
  }

  const tokenPairs = [
    ["ng-if", "*ngIf"],
    ["ng-disabled", "[disabled]"],
    ["ng-click", "(click)"],
    ["ng-show", "*ngIf"],
    ["ng-hide=\"", "*ngIf=!\""],
    ["ng-model", "[(ngModel)]"],
    ["ng-class", "[ngClass]"],
    ["ng-bind", "[textContent]"],
    ["ng-repeat=\"", "*ngFor=\"let "],
    ["ng-change", "(ngModelChange)"],
    ["ng-style", "[ngStyle]"],
    ["ng-mouseover", "(mouseover)"],
    ["ng-required", "[required]"],
    ["ng-src", "[src]"],
    ["ng-href", "[href]"],
    ["ng-options", "<option *ngFor"],
    ["uib-", ""],
    [" in ", " of "]
  ];

  try {
    const requestPath = req.path;
    const sourceDir = path.normalize(`../${req.query.in}`);
    const response = {response: requestPath, in: sourceDir, out: req.query.out};
    if (req.query.in) {
      walkDir(sourceDir, (file) => file.endsWith(".html")).then(files => {
        debug("processing input files", files);
        response.output = files.map(inputFile => {
          const parsedPath = path.parse(inputFile);
          const inputDirectory = parsedPath.dir;
          const outputDirectory = path.resolve(path.join("../", req.query.out, inputDirectory.split(req.query.in)[1]))
          const output = path.join(outputDirectory, parsedPath.name + ".component" + parsedPath.ext);
          const outputFile = path.resolve(output);
          if (!fs.existsSync(outputDirectory)) {
            debug("creating outputDirectory:", outputDirectory)
            mkdirpsync(outputDirectory);
          } else {
            debug("outputDirectory already exists:", outputDirectory)
          }
          convert(inputFile, outputFile);
          return {
            inputFile,
            inExists: fs.existsSync(inputFile),
            output,
            outputFile,
            outputDirectory,
            outExists: fs.existsSync(output)
          }
        })
        res.json(response)
      })
    } else {
      res.json({error: "no input parameter specified"})
    }
  } catch (error) {
    debug("ERROR: ", error.stack);
    res.json(error);
  }

  function convert(inputFile, outputFile) {
    debug("converting", inputFile, "->", outputFile)
    if (fs.existsSync(inputFile)) {
      const outputDir = path.dirname(outputFile);
      const fileContents = fs.readFileSync(inputFile).toString();
      let outputContents = clone(fileContents);
      tokenPairs.forEach(pair => {
        debug("replacing tokens:", pair);
        outputContents = stringUtils.replaceAll(pair[0], pair[1], outputContents);
      })
      debug("output:dir", outputDir, "outputContents:", outputContents);
      fs.writeFileSync(outputFile, outputContents);
      debug("outputContents", outputFile, "created")
    } else {
      debug("ERROR input", inputFile, "does not exist")
    }
  }

}
