import expect from "expect";
import {describe, it} from "mocha";
import {validatedDatabaseForDestroy} from "./destroy";

describe("environment destruction", () => {
  it("allows only the exact database named by the environment connection", () => {
    expect(validatedDatabaseForDestroy("mongodb+srv://user:pass@example.mongodb.net/ngx-ramblers-new-forest?retryWrites=true", "ngx-ramblers-new-forest"))
      .toBe("ngx-ramblers-new-forest");
    expect(() => validatedDatabaseForDestroy("mongodb+srv://user:pass@example.mongodb.net/another-site", "ngx-ramblers-new-forest"))
      .toThrow(/not ngx-ramblers-new-forest/);
  });

  it("refuses to delete MongoDB system databases", () => {
    expect(() => validatedDatabaseForDestroy("mongodb://localhost/admin", "admin")).toThrow(/system database/);
    expect(() => validatedDatabaseForDestroy("mongodb://localhost/", "ngx-ramblers-new-forest")).toThrow(/no database/);
  });
});
