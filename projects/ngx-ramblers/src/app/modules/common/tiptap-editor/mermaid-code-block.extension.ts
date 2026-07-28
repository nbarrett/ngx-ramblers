import CodeBlock from "@tiptap/extension-code-block";
import { isUndefined } from "es-toolkit/compat";

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{svg: string}>;
};

let mermaidReady = false;
const inFlightSources = new Set<string>();

function mermaidApi(): MermaidApi | null {
  const candidate = (globalThis as {mermaid?: MermaidApi}).mermaid;
  let api: MermaidApi | null = null;
  if (candidate?.render && candidate?.initialize) {
    api = candidate;
  }
  return api;
}

function ensureMermaidInitialised(): MermaidApi | null {
  const api = mermaidApi();
  if (api && !mermaidReady) {
    api.initialize({startOnLoad: false, securityLevel: "loose"});
    mermaidReady = true;
  }
  return api;
}

function isMermaidLanguage(language: string | null | undefined): boolean {
  return (language || "").toLowerCase() === "mermaid";
}

function userWantsSourceOpen(block: Element): boolean {
  return block.getAttribute("data-user-source") === "1";
}

function setMermaidSourceVisible(block: Element, visible: boolean, fromUser = false): void {
  const pre = block.querySelector("pre") as HTMLElement | null;
  const toggle = block.querySelector(".tiptap-mermaid-source-toggle") as HTMLButtonElement | null;
  if (pre) {
    pre.hidden = !visible;
  }
  block.classList.toggle("tiptap-code-block-mermaid-source-open", visible);
  if (fromUser) {
    if (visible) {
      block.setAttribute("data-user-source", "1");
    } else {
      block.removeAttribute("data-user-source");
    }
  }
  if (toggle) {
    toggle.textContent = visible ? "Hide source" : "Edit source";
    toggle.setAttribute("aria-expanded", visible ? "true" : "false");
  }
}

function paintMermaidBlock(block: Element, index: number): void {
  const code = block.querySelector("code");
  const preview = block.querySelector(".tiptap-mermaid-preview") as HTMLElement | null;
  if (code && preview) {
    const source = (code.textContent || "").trim();
    if (!source) {
      preview.replaceChildren();
      delete preview.dataset.renderedSource;
    } else if (preview.dataset.renderedSource === source && preview.querySelector("svg")) {
      if (!userWantsSourceOpen(block)) {
        setMermaidSourceVisible(block, false);
      }
    } else if (!inFlightSources.has(source)) {
      const api = ensureMermaidInitialised();
      if (!api) {
        preview.className = "tiptap-mermaid-preview tiptap-mermaid-preview-error";
        preview.textContent = "Mermaid is not available in this session.";
        setMermaidSourceVisible(block, true);
      } else {
        inFlightSources.add(source);
        const renderId = `tiptap-mermaid-${index}-${Math.random().toString(36).slice(2, 8)}`;
        void api.render(renderId, source).then(({svg}) => {
          inFlightSources.delete(source);
          if ((code.textContent || "").trim() === source) {
            preview.className = "tiptap-mermaid-preview";
            preview.dataset.renderedSource = source;
            preview.innerHTML = svg;
            if (!userWantsSourceOpen(block)) {
              setMermaidSourceVisible(block, false);
            }
          }
        }).catch(() => {
          inFlightSources.delete(source);
          if ((code.textContent || "").trim() === source) {
            preview.className = "tiptap-mermaid-preview tiptap-mermaid-preview-error";
            preview.textContent = "Mermaid diagram could not be rendered. Use Edit source to fix it.";
            setMermaidSourceVisible(block, true);
          }
        });
      }
    }
  }
}

export function refreshMermaidCodeBlockPreviews(root: HTMLElement | null | undefined): void {
  if (root && !isUndefined(document)) {
    const blocks = root.querySelectorAll(".tiptap-code-block-mermaid");
    if (blocks.length) {
      blocks.forEach((block, index) => {
        paintMermaidBlock(block, index);
      });
    }
  }
}

export const MermaidCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ({node, editor}) => {
      const dom = document.createElement("div");
      dom.classList.add("tiptap-code-block");

      const preview = document.createElement("div");
      preview.classList.add("tiptap-mermaid-preview");
      preview.contentEditable = "false";
      preview.hidden = true;

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      pre.appendChild(code);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "tiptap-mermaid-source-toggle";
      toggle.textContent = "Edit source";
      toggle.setAttribute("aria-expanded", "false");
      toggle.contentEditable = "false";
      toggle.hidden = true;
      toggle.addEventListener("mousedown", event => {
        event.preventDefault();
        event.stopPropagation();
      });
      toggle.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const open = !dom.classList.contains("tiptap-code-block-mermaid-source-open");
        setMermaidSourceVisible(dom, open, true);
        if (open) {
          code.focus();
        } else {
          paintMermaidBlock(dom, 0);
        }
      });

      dom.appendChild(preview);
      dom.appendChild(toggle);
      dom.appendChild(pre);

      const languageClassPrefix = this.options.languageClassPrefix || "language-";
      const retryState = {attempts: 0, timer: null as ReturnType<typeof setTimeout> | null};

      const syncLanguageClass = (language: string | null | undefined) => {
        code.className = language ? `${languageClassPrefix}${language}` : "";
        if (language) {
          dom.dataset.language = language;
        } else {
          delete dom.dataset.language;
        }
        const mermaidBlock = isMermaidLanguage(language);
        dom.classList.toggle("tiptap-code-block-mermaid", mermaidBlock);
        preview.hidden = !mermaidBlock;
        toggle.hidden = !mermaidBlock;
        if (!mermaidBlock) {
          pre.hidden = false;
          dom.classList.remove("tiptap-code-block-mermaid-source-open");
          dom.removeAttribute("data-user-source");
        }
      };

      const schedulePaint = () => {
        if (dom.classList.contains("tiptap-code-block-mermaid")) {
          paintMermaidBlock(dom, 0);
          if (!preview.querySelector("svg") && retryState.attempts < 15) {
            retryState.attempts += 1;
            retryState.timer = setTimeout(schedulePaint, 120);
          }
        }
      };

      syncLanguageClass(node.attrs.language);

      const mutationObserver = new MutationObserver(() => {
        retryState.attempts = 0;
        delete preview.dataset.renderedSource;
        schedulePaint();
      });
      mutationObserver.observe(code, {characterData: true, childList: true, subtree: true});

      setTimeout(schedulePaint, 0);
      setTimeout(() => {
        const root = editor?.view?.dom as HTMLElement | undefined;
        if (root) {
          refreshMermaidCodeBlockPreviews(root);
        }
      }, 300);

      return {
        dom,
        contentDOM: code,
        ignoreMutation: (mutation) => {
          return !code.contains(mutation.target as Node);
        },
        update: (updatedNode) => {
          const canUpdate = updatedNode.type.name === "codeBlock";
          if (canUpdate) {
            syncLanguageClass(updatedNode.attrs.language);
            retryState.attempts = 0;
            schedulePaint();
          }
          return canUpdate;
        },
        destroy: () => {
          mutationObserver.disconnect();
          if (retryState.timer) {
            clearTimeout(retryState.timer);
          }
        }
      };
    };
  }
});
