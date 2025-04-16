import kebabCase from "lodash/kebabCase";

export function toKebabCase(...strings: any[]) {
  return strings
    .flat()
    .filter(item => item)
    .map(item => kebabCase(item))
    .join("-");
}
