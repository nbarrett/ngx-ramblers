import { Node, mergeAttributes } from "@tiptap/core";
import { exampleText, friendlyFieldLabel, friendlyText } from "../../../models/email-composer.model";

export const LINK_TOKEN_NODE_NAME = "linkToken";

export const LinkToken = Node.create({
  name: LINK_TOKEN_NODE_NAME,
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  marks: "",
  addAttributes() {
    return {
      href: {
        default: "",
        parseHTML: element => element.getAttribute("data-href"),
        renderHTML: attributes => ({ "data-href": attributes["href"] })
      },
      label: {
        default: "",
        parseHTML: element => element.getAttribute("data-label"),
        renderHTML: attributes => ({ "data-label": attributes["label"] })
      }
    };
  },
  parseHTML() {
    return [{ tag: "link-token" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs["label"];
    return ["link-token", mergeAttributes(HTMLAttributes, { class: "link-pill", title: `Links to ${friendlyFieldLabel(node.attrs["href"])}` }),
      ["span", { class: "link-pill-label" },
        ["span", { class: "chip-name" }, friendlyText(label)],
        ["span", { class: "chip-example" }, exampleText(label)]],
      ["span", { class: "link-pill-destination" }, `→ ${friendlyFieldLabel(node.attrs["href"])}`]];
  },
  markdownTokenName: LINK_TOKEN_NODE_NAME,
  markdownTokenizer: {
    name: LINK_TOKEN_NODE_NAME,
    level: "inline",
    start: (source: string) => source.indexOf("["),
    tokenize: (source: string) => {
      const match = /^\[([^\]]*)\]\(\s*(\{\{[^}]+?\}\}[^)\s]*)\s*\)/.exec(source);
      if (!match) {
        return undefined;
      }
      return { type: LINK_TOKEN_NODE_NAME, raw: match[0], label: match[1], href: match[2].trim() };
    }
  },
  parseMarkdown: token => ({ type: LINK_TOKEN_NODE_NAME, attrs: { href: token["href"], label: token["label"] } }),
  renderMarkdown: node => `[${node.attrs?.["label"]}](${node.attrs?.["href"]})`
});
