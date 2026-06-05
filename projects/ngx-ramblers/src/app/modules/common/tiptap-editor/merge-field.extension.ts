import { Node, mergeAttributes } from "@tiptap/core";
import { exampleValueForToken, friendlyFieldLabel } from "../../../models/email-composer.model";

export const MERGE_FIELD_NODE_NAME = "mergeField";

export const MergeField = Node.create({
  name: MERGE_FIELD_NODE_NAME,
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  marks: "",
  addAttributes() {
    return {
      token: {
        default: "",
        parseHTML: element => element.getAttribute("data-token"),
        renderHTML: attributes => ({ "data-token": attributes["token"] })
      }
    };
  },
  parseHTML() {
    return [{ tag: "merge-field" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const token = node.attrs["token"];
    const example = exampleValueForToken(token) || friendlyFieldLabel(token);
    return ["merge-field", mergeAttributes(HTMLAttributes, { class: "merge-field-chip" }),
      ["span", { class: "chip-name" }, friendlyFieldLabel(token)],
      ["span", { class: "chip-example" }, example]];
  },
  markdownTokenName: MERGE_FIELD_NODE_NAME,
  markdownTokenizer: {
    name: MERGE_FIELD_NODE_NAME,
    level: "inline",
    start: (source: string) => source.indexOf("{{"),
    tokenize: (source: string) => {
      const match = /^\{\{\s*([^}]+?)\s*\}\}/.exec(source);
      if (!match) {
        return undefined;
      }
      return { type: MERGE_FIELD_NODE_NAME, raw: match[0], token: match[1].trim() };
    }
  },
  parseMarkdown: token => ({ type: MERGE_FIELD_NODE_NAME, attrs: { token: token["token"] } }),
  renderMarkdown: node => `{{${node.attrs?.["token"]}}}`
});
