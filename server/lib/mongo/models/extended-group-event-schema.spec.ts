import expect from "expect";
import { describe, it } from "mocha";
import * as ts from "typescript";
import * as path from "path";
import { keys } from "es-toolkit/compat";
import { extendedGroupEvent } from "./extended-group-event";
import { AUDITED_FIELDS, UNAUDITED_FIELDS } from "../../../../projects/ngx-ramblers/src/app/models/walk-event.model";

const MIXED = "Mixed";
const IGNORED_PATHS = new Set(["id", "_id", "__v"]);

function schemaPaths(schema: any, prefix: string, out: Map<string, string>): void {
  keys(schema.paths).forEach(key => {
    const schemaType = schema.paths[key];
    const full = prefix ? `${prefix}.${key}` : key;
    const instance = schemaType.instance;
    if (schemaType.schema) {
      out.set(full, instance === "Array" ? "Array<Subdocument>" : "Subdocument");
      schemaPaths(schemaType.schema, full, out);
    } else if (instance === "Array") {
      const caster = schemaType.caster;
      out.set(full, `Array<${caster?.instance || MIXED}>`);
      if (!caster || caster.instance === MIXED) {
        out.set(`${full}.*`, MIXED);
      }
    } else {
      out.set(full, instance);
      if (instance === MIXED) {
        out.set(`${full}.*`, MIXED);
      }
    }
  });
}

function coveredBySchema(tsPath: string, schema: Map<string, string>): boolean {
  const parts = tsPath.split(".");
  const underMixed = parts.some((_, index) => schema.get(`${parts.slice(0, index + 1).join(".")}.*`) === MIXED);
  const hasDeclaredChildren = [...schema.keys()].some(key => key.startsWith(`${tsPath}.`));
  return schema.has(tsPath) || underMixed || hasDeclaredChildren;
}

function typeProperties(checker: ts.TypeChecker, type: ts.Type, prefix: string, depth: number, out: Set<string>, seen: Set<ts.Type>): void {
  if (depth <= 4 && !seen.has(type)) {
    seen.add(type);
    const objectType = type.getNonNullableType();
    const arrayElement = checker.isArrayType(objectType) ? checker.getTypeArguments(objectType as ts.TypeReference)[0] : null;
    const target = arrayElement || objectType;
    if (target.isUnion()) {
      target.types.forEach(member => typeProperties(checker, member, prefix, depth, out, seen));
    } else if (target.flags & ts.TypeFlags.Object) {
      checker.getPropertiesOfType(target).forEach(property => {
        const declaration = property.valueDeclaration || property.declarations?.[0];
        if (declaration) {
          const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration);
          const full = prefix ? `${prefix}.${property.getName()}` : property.getName();
          out.add(full);
          const nonNull = propertyType.getNonNullableType();
          const element = checker.isArrayType(nonNull) ? checker.getTypeArguments(nonNull as ts.TypeReference)[0] : nonNull;
          const isPlainObject = (element.flags & ts.TypeFlags.Object) && !(element.flags & ts.TypeFlags.EnumLike) && checker.typeToString(element) !== "Date";
          if (isPlainObject) {
            typeProperties(checker, propertyType, full, depth + 1, out, new Set(seen));
          }
        }
      });
    }
  }
}

function clientModelPaths(): Set<string> {
  const modelFile = path.resolve(__dirname, "../../../../projects/ngx-ramblers/src/app/models/group-event.model.ts");
  const program = ts.createProgram([modelFile], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: false,
    skipLibCheck: true,
    baseUrl: path.resolve(__dirname, "../../../..")
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(modelFile);
  const declaration = source.statements.filter(ts.isInterfaceDeclaration).find(statement => statement.name.text === "ExtendedGroupEvent");
  const type = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(declaration.name));
  const paths = new Set<string>();
  typeProperties(checker, type, "", 0, paths, new Set());
  return paths;
}

describe("extended group event schema", () => {
  it("declares every property of the client ExtendedGroupEvent model, so nothing is silently dropped on save", () => {
    const schema = new Map<string, string>();
    schemaPaths(extendedGroupEvent.schema, "", schema);
    const undeclared = [...clientModelPaths()]
      .filter(tsPath => !IGNORED_PATHS.has(tsPath) && !coveredBySchema(tsPath, schema))
      .sort();
    expect(undeclared).toEqual([]);
  });

  it("audits every walk field for change detection unless it is deliberately listed as unaudited", () => {
    const topLevel = [...clientModelPaths()]
      .filter(tsPath => /^(groupEvent|fields)\.[^.]+$/.test(tsPath))
      .sort();
    const unaccounted = topLevel.filter(field => !AUDITED_FIELDS.includes(field) && !UNAUDITED_FIELDS.includes(field));
    expect(unaccounted).toEqual([]);
    const auditedAndUnaudited = AUDITED_FIELDS.filter(field => UNAUDITED_FIELDS.includes(field));
    expect(auditedAndUnaudited).toEqual([]);
  });
});
