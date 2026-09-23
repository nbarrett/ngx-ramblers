import { describe, expect, it } from "vitest";
import { separateEditingBlocks } from "./markdown-editing-blocks";

describe("separateEditingBlocks", () => {
  it("keeps consecutive quoted reply lines together", () => {
    const quoted = "> Hello\n> From the original message\n> Third line";
    expect(separateEditingBlocks(quoted)).toEqual(quoted);
  });

  it("still splits imported prose lines so each can be edited", () => {
    expect(separateEditingBlocks("First line\nSecond line")).toEqual("First line\n\nSecond line");
  });
});
