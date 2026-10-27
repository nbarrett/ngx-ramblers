import expect from "expect";
import { describe, it } from "mocha";
import { generateMailClientSecret, normaliseMailClientSecret } from "./mail-client-credentials";

describe("mail client secrets", () => {
  it("generates four groups of four characters", () => {
    const secret = generateMailClientSecret();
    expect(secret).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("strips separators before comparing", () => {
    expect(normaliseMailClientSecret("ab12-cd34-ef56-gh78")).toEqual("AB12CD34EF56GH78");
  });
});
