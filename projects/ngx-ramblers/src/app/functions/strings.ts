import kebabCase from "lodash-es/kebabCase";

export function toKebabCase(...strings: any[]) {
  return strings
    .filter(item => item)
    .map(item => kebabCase(item))
    .join("-");
}
