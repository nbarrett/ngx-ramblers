import { explicitIconColour, iconColourAsHex, iconColourChoices, namedIconColourClass, resolvedIconColour } from "./icon-colour";

describe("icon colour helpers", () => {
  it("resolves legacy class names to their colour values", () => {
    expect(resolvedIconColour("ramblers")).toEqual("rgb(155, 200, 171)");
    expect(resolvedIconColour("calendar")).toEqual("#0097a4");
    expect(resolvedIconColour(null)).toEqual("rgb(155, 200, 171)");
  });

  it("passes hex colours through", () => {
    expect(resolvedIconColour("#cc0000")).toEqual("#cc0000");
    expect(iconColourAsHex("#CC0000")).toEqual("#cc0000");
  });

  it("converts rgb swatches to hex for the colour input", () => {
    expect(iconColourAsHex("ramblers")).toEqual("#9bc8ab");
  });

  it("offers more than the five named icon colours", () => {
    expect(iconColourChoices().length).toBeGreaterThan(5);
  });

  it("leaves unset colours to the fa-icon class", () => {
    expect(namedIconColourClass(null)).toBeNull();
    expect(explicitIconColour(null)).toBeNull();
    expect(namedIconColourClass("ramblers")).toEqual("ramblers");
    expect(explicitIconColour("ramblers")).toBeNull();
    expect(namedIconColourClass("#e0393e")).toBeNull();
    expect(explicitIconColour("#e0393e")).toEqual("#e0393e");
    expect(namedIconColourClass("colour-granite")).toEqual("colour-granite");
    expect(iconColourAsHex("colour-granite")).toEqual("#404141");
  });
});
