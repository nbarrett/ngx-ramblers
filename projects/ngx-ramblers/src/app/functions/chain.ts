import { filter } from "es-toolkit/compat";
import { find } from "es-toolkit/compat";
import { groupBy } from "es-toolkit/compat";
import { last } from "es-toolkit/compat";
import { map } from "es-toolkit/compat";
import { mapValues } from "es-toolkit/compat";
import { orderBy } from "es-toolkit/compat";
import { reduce } from "es-toolkit/compat";
import { sortBy } from "es-toolkit/compat";
import { toPairs } from "es-toolkit/compat";
import { uniq as unique } from "es-toolkit/compat";

const supportedFunctions = {
  map,
  unique,
  find,
  filter,
  last,
  toPairs,
  reduce,
  orderBy,
  groupBy,
  sortBy,
};

export const chain = <T>(input: T) => {
  let value: any = input;
  const wrapper = {
    ...mapValues(
      supportedFunctions,
      (f: any) => (...args) => {
        value = f(value, ...args);
        return wrapper;
      },
    ),
    value: () => value,
  };
  return wrapper;
};
