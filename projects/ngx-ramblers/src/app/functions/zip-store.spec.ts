import {storedZipArchive} from "./zip-store";

describe("storedZipArchive", () => {
  it("packs named files into a zip archive", () => {
    const bytes = storedZipArchive([
      {name: "notes.md", bytes: new TextEncoder().encode("# Hello")},
      {name: "readme.txt", bytes: new TextEncoder().encode("plain")}
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(text).toContain("notes.md");
    expect(text).toContain("readme.txt");
    expect(text).toContain("# Hello");
    expect(text).toContain("plain");
  });
});
