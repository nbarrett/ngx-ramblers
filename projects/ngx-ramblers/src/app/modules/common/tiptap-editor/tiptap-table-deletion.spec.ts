import {Editor} from "@tiptap/core";
import {Table} from "@tiptap/extension-table";
import {TableRow} from "@tiptap/extension-table-row";
import {TableCell} from "@tiptap/extension-table-cell";
import {TableHeader} from "@tiptap/extension-table-header";
import StarterKit from "@tiptap/starter-kit";
import {NodeSelection} from "@tiptap/pm/state";
import {TiptapMarkdownEditor} from "./tiptap-markdown-editor";

describe("deleting an email layout table from outside", () => {
  function context() {
    const editor = new Editor({extensions: [StarterKit, Table.configure({allowTableNodeSelection: true}), TableRow, TableCell, TableHeader], content: "<table><tr><td><p>Keep until deleted</p></td></tr></table><p></p>"});
    const instance = Object.assign(Object.create(TiptapMarkdownEditor.prototype), {editor});
    return {editor, instance};
  }

  it("selects the whole preceding table before deleting it with a second Backspace", () => {
    const {editor, instance} = context();
    try {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      expect(instance.handleTableBoundaryDelete(new KeyboardEvent("keydown", {key: "Backspace", cancelable: true}))).toBe(true);
      expect(editor.state.selection instanceof NodeSelection).toBe(true);
      expect(editor.state.doc.firstChild.type.name).toBe("table");
      expect(instance.handleTableBoundaryDelete(new KeyboardEvent("keydown", {key: "Backspace", cancelable: true}))).toBe(true);
      expect(editor.getText()).toBe("");
      expect(editor.state.doc.firstChild.type.name).toBe("paragraph");
    } finally {
      editor.destroy();
    }
  });

  it("leaves editing inside cells and modified shortcuts to the editor", () => {
    const {editor, instance} = context();
    try {
      editor.commands.setTextSelection(4);
      expect(instance.handleTableBoundaryDelete(new KeyboardEvent("keydown", {key: "Backspace"}))).toBe(false);
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      expect(instance.handleTableBoundaryDelete(new KeyboardEvent("keydown", {key: "Backspace", metaKey: true}))).toBe(false);
      expect(editor.getText()).toContain("Keep until deleted");
    } finally {
      editor.destroy();
    }
  });
});
