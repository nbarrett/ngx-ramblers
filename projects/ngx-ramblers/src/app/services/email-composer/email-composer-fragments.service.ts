import { inject } from "@angular/core";
import { kebabCase } from "es-toolkit/compat";
import { ArticleBlock, ArticleBlockPosition, BrandingMode, ComposerFragment, ComposerFragmentKind, DragHoverPosition, EmailComposerState, SectionDividerStyle } from "../../models/email-composer.model";
import { buildDefaultFragmentOrder, newDividerFragment, newMultiColumnFragment } from "../../functions/email-composer";
import { StringUtilsService } from "../string-utils.service";
import { DateUtilsService } from "../date-utils.service";
import { Injectable } from "@angular/core";
@Injectable()
export class EmailComposerFragmentsService {
    private stringUtils = inject(StringUtilsService);
    private dateUtils = inject(DateUtilsService);
    expandedFragmentIds: Set<string> = new Set();
    draggedFragmentPath: number[] | null = null;
    dragHoverPath: number[] | null = null;
    dragHoverPosition: DragHoverPosition | null = null;
    dragHoverColumnPath: number[] | null = null;
    toggleFragmentExpanded(state: EmailComposerState, fragmentId: string): void {
        if (this.expandedFragmentIds.has(fragmentId)) {
            this.expandedFragmentIds.delete(fragmentId);
        }
        else {
            this.expandedFragmentIds.add(fragmentId);
        }
    }
    isFragmentExpanded(state: EmailComposerState, fragmentId: string): boolean {
        return this.expandedFragmentIds.has(fragmentId);
    }
    fragmentList(state: EmailComposerState, parentPath: number[]): ComposerFragment[] | null {
        if (parentPath.length === 0) {
            return state.fragmentOrder;
        }
        else {
            if (parentPath.length === 2) {
                const top = state.fragmentOrder?.[parentPath[0]];
                if (!top || top.kind !== ComposerFragmentKind.MULTI_COLUMN) {
                    return null;
                }
                else {
                    return top.columns?.[parentPath[1]] ?? null;
                }
            }
            return null;
        }
    }
    columnFragments(state: EmailComposerState, topIndex: number, columnIndex: number): ComposerFragment[] {
        const top = state.fragmentOrder?.[topIndex];
        if (!top || top.kind !== ComposerFragmentKind.MULTI_COLUMN) {
            return [];
        }
        else {
            return top.columns?.[columnIndex] ?? [];
        }
    }
    fragmentAt(state: EmailComposerState, path: number[]): ComposerFragment | null {
        if (path.length === 0) {
            return null;
        }
        else {
            const parent = this.fragmentList(state, path.slice(0, -1));
            if (!parent) {
                return null;
            }
            else {
                return parent[path[path.length - 1]] ?? null;
            }
        }
    }
    removeFragmentAt(state: EmailComposerState, path: number[]): ComposerFragment | null {
        const parent = this.fragmentList(state, path.slice(0, -1));
        if (!parent) {
            return null;
        }
        else {
            const idx = path[path.length - 1];
            const removed = parent.splice(idx, 1)[0] ?? null;
            return removed;
        }
    }
    removeFragment(state: EmailComposerState, path: number[]): void {
        this.removeFragmentAt(state, path);
        state.fragmentOrder = [...(state.fragmentOrder ?? [])];
    }
    hasFragmentKindAtTopLevel(state: EmailComposerState, kind: ComposerFragmentKind): boolean {
        return (state.fragmentOrder ?? []).some(f => f.kind === kind);
    }
    addIntroFragment(state: EmailComposerState): void {
        if (!(this.hasFragmentKindAtTopLevel(state, ComposerFragmentKind.INTRO))) {
            state.fragmentOrder = [
                { kind: ComposerFragmentKind.INTRO, id: "intro", dividerAfter: state.introDividerAfter ?? SectionDividerStyle.THIN_YELLOW },
                ...(state.fragmentOrder ?? [])
            ];
        }
    }
    addSignoffFragment(state: EmailComposerState): void {
        if (!(this.hasFragmentKindAtTopLevel(state, ComposerFragmentKind.SIGNOFF))) {
            state.fragmentOrder = [
                ...(state.fragmentOrder ?? []),
                { kind: ComposerFragmentKind.SIGNOFF, id: "signoff", dividerAfter: state.signoffDividerAfter ?? SectionDividerStyle.THIN_YELLOW }
            ];
        }
    }
    insertAboveSignoffAtTopLevel(state: EmailComposerState, fragment: ComposerFragment): void {
        const list = state.fragmentOrder ?? [];
        const signoffIdx = list.findIndex(f => f.kind === ComposerFragmentKind.SIGNOFF);
        const insertAt = signoffIdx >= 0 ? signoffIdx : list.length;
        state.fragmentOrder = [...list.slice(0, insertAt), fragment, ...list.slice(insertAt)];
    }
    addArticleFragment(state: EmailComposerState, parentPath: number[] = []): void {
        const blocks = state.articleBlocks ?? [];
        const newId = this.stringUtils.kebabCase(`block-${this.dateUtils.dateTimeNow().toMillis()}-${blocks.length}`);
        const newBlock: ArticleBlock = {
            id: newId,
            position: ArticleBlockPosition.ABOVE_EVENTS,
            order: blocks.length,
            title: "",
            markdown: "",
            image: null
        };
        state.articleBlocks = [...blocks, newBlock];
        const newFragment: ComposerFragment = {
            kind: ComposerFragmentKind.ARTICLE,
            id: newId,
            dividerAfter: state.betweenArticlesDivider ?? SectionDividerStyle.THIN_YELLOW
        };
        if (parentPath.length === 0) {
            this.insertAboveSignoffAtTopLevel(state, newFragment);
        }
        else {
            const parent = this.fragmentList(state, parentPath);
            if (!(!parent)) {
                parent.push(newFragment);
                state.fragmentOrder = [...(state.fragmentOrder ?? [])];
            }
        }
        this.expandedFragmentIds.add(newId);
    }
    addMultiColumnFragment(state: EmailComposerState, numColumns: number): void {
        const fragment = newMultiColumnFragment(numColumns, SectionDividerStyle.THIN_YELLOW);
        this.insertAboveSignoffAtTopLevel(state, fragment);
        this.expandedFragmentIds.add(fragment.id);
    }
    addDividerFragment(state: EmailComposerState, parentPath: number[] = []): void {
        const fragment = newDividerFragment();
        if (parentPath.length === 0) {
            this.insertAboveSignoffAtTopLevel(state, fragment);
        }
        else {
            const parent = this.fragmentAt(state, parentPath.slice(0, -1));
            const columnIndex = parentPath[parentPath.length - 1];
            if (parent?.columns?.[columnIndex]) {
                parent.columns[columnIndex] = [...parent.columns[columnIndex], fragment];
            }
        }
    }
    onFragmentDividerChange(state: EmailComposerState, path: number[], style: SectionDividerStyle): void {
        const fragment = this.fragmentAt(state, path);
        if (!(!fragment)) {
            fragment.dividerAfter = style;
            state.fragmentOrder = [...(state.fragmentOrder ?? [])];
        }
    }
    onFragmentDragStart(state: EmailComposerState, path: number[], event: DragEvent): void {
        this.draggedFragmentPath = [...path];
        if (event?.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            const dragEl = (event.target as HTMLElement) || (event.currentTarget as HTMLElement);
            if (dragEl && event.dataTransfer.setDragImage) {
                event.dataTransfer.setDragImage(dragEl, 10, 10);
            }
        }
    }
    onFragmentDragOver(state: EmailComposerState, path: number[], event: DragEvent): void {
        if (!(!this.draggedFragmentPath)) {
            if (this.isPathPrefixOf(state, this.draggedFragmentPath, path)) {
            }
            else {
                event.preventDefault();
                const target = event.currentTarget as HTMLElement | null;
                if (target) {
                    const rect = target.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    this.dragHoverPosition = (event.clientY ?? midpoint) < midpoint ? DragHoverPosition.Before : DragHoverPosition.After;
                }
                else {
                    this.dragHoverPosition = DragHoverPosition.Before;
                }
                this.dragHoverPath = [...path];
                this.dragHoverColumnPath = null;
            }
        }
    }
    onFragmentDrop(state: EmailComposerState, path: number[]): void {
        if (!(!this.draggedFragmentPath)) {
            if (this.isPathPrefixOf(state, this.draggedFragmentPath, path)) {
                this.resetDragState(state);
            }
            else {
                const targetIndex = this.dragHoverPosition === DragHoverPosition.After
                    ? path[path.length - 1] + 1
                    : path[path.length - 1];
                const targetPath = [...path.slice(0, -1), targetIndex];
                this.movePath(state, this.draggedFragmentPath, targetPath);
                this.resetDragState(state);
            }
        }
    }
    onColumnDragOver(state: EmailComposerState, parentPath: number[], event: DragEvent): void {
        if (!(!this.draggedFragmentPath)) {
            if (this.isPathPrefixOf(state, this.draggedFragmentPath, parentPath)) {
            }
            else {
                event.preventDefault();
                this.dragHoverColumnPath = [...parentPath];
                this.dragHoverPath = null;
            }
        }
    }
    onColumnDrop(state: EmailComposerState, parentPath: number[]): void {
        if (!(!this.draggedFragmentPath)) {
            if (this.isPathPrefixOf(state, this.draggedFragmentPath, parentPath)) {
                this.resetDragState(state);
            }
            else {
                const targetList = this.fragmentList(state, parentPath);
                if (!targetList) {
                    this.resetDragState(state);
                }
                else {
                    this.movePath(state, this.draggedFragmentPath, [...parentPath, targetList.length]);
                    this.resetDragState(state);
                }
            }
        }
    }
    onFragmentDragEnd(state: EmailComposerState): void {
        this.resetDragState(state);
    }
    resetDragState(state: EmailComposerState): void {
        this.draggedFragmentPath = null;
        this.dragHoverPath = null;
        this.dragHoverColumnPath = null;
    }
    isPathPrefixOf(state: EmailComposerState, prefix: number[], full: number[]): boolean {
        if (prefix.length > full.length) {
            return false;
        }
        else {
            return prefix.every((value, idx) => value === full[idx]);
        }
    }
    movePath(state: EmailComposerState, srcPath: number[], tgtPath: number[]): void {
        const srcParent = this.fragmentList(state, srcPath.slice(0, -1));
        const tgtParent = this.fragmentList(state, tgtPath.slice(0, -1));
        if (!(!srcParent || !tgtParent)) {
            const srcIndex = srcPath[srcPath.length - 1];
            const initialTgtIndex = tgtPath[tgtPath.length - 1];
            const fragment = srcParent.splice(srcIndex, 1)[0];
            if (!fragment) {
            }
            else {
                const tgtIndex = srcParent === tgtParent && srcIndex < initialTgtIndex ? initialTgtIndex - 1 : initialTgtIndex;
                tgtParent.splice(tgtIndex, 0, fragment);
                state.fragmentOrder = [...(state.fragmentOrder ?? [])];
            }
        }
    }
    pathsEqual(state: EmailComposerState, a: number[] | null, b: number[] | null): boolean {
        if (!a || !b) {
            return false;
        }
        else {
            if (a.length !== b.length) {
                return false;
            }
            else {
                return a.every((value, idx) => value === b[idx]);
            }
        }
    }
    isDragHover(state: EmailComposerState, path: number[]): boolean {
        return this.pathsEqual(state, this.dragHoverPath, path);
    }
    isColumnDragHover(state: EmailComposerState, parentPath: number[]): boolean {
        return this.pathsEqual(state, this.dragHoverColumnPath, parentPath);
    }
    fragmentsForRender(state: EmailComposerState): ComposerFragment[] {
        if (state.fragmentOrder && state.fragmentOrder.length > 0) {
            return state.fragmentOrder;
        } else {
            const isUnbranded = state.brandingMode === BrandingMode.UNBRANDED;
            return buildDefaultFragmentOrder(state, { includeTemplateContent: !isUnbranded, unbranded: isUnbranded });
        }
    }

    ensureFragmentOrder(state: EmailComposerState): void {
        const isUnbranded = state.brandingMode === BrandingMode.UNBRANDED;
        if (!state.fragmentOrder || state.fragmentOrder.length === 0) {
            state.fragmentOrder = this.fragmentsForRender(state);
            if (isUnbranded) {
                this.expandedFragmentIds.add("intro");
            }
        }
        else {
            const articleIds = new Set((state.articleBlocks ?? []).map(b => b.id));
            const collectArticleFragmentIds = (list: ComposerFragment[]): string[] => list.flatMap(fragment => {
                if (fragment.kind === ComposerFragmentKind.ARTICLE) {
                    return [fragment.id];
                }
                else {
                    if (fragment.kind === ComposerFragmentKind.MULTI_COLUMN) {
                        return (fragment.columns ?? []).flatMap(column => collectArticleFragmentIds(column));
                    }
                    else {
                        return [];
                    }
                }
            });
            const knownFragmentArticleIds = new Set(collectArticleFragmentIds(state.fragmentOrder));
            const missingArticles = (state.articleBlocks ?? []).filter(b => !knownFragmentArticleIds.has(b.id));
            if (missingArticles.length > 0) {
                const eventsIdx = state.fragmentOrder.findIndex(f => f.kind === ComposerFragmentKind.EVENTS);
                const insertAt = eventsIdx >= 0 ? eventsIdx : state.fragmentOrder.length;
                const newFragments: ComposerFragment[] = missingArticles.map(b => ({
                    kind: ComposerFragmentKind.ARTICLE,
                    id: b.id,
                    dividerAfter: b.dividerAfter ?? state.betweenArticlesDivider ?? SectionDividerStyle.THIN_YELLOW
                }));
                state.fragmentOrder = [
                    ...state.fragmentOrder.slice(0, insertAt),
                    ...newFragments,
                    ...state.fragmentOrder.slice(insertAt)
                ];
            }
            const pruneOrphanArticles = (list: ComposerFragment[]): ComposerFragment[] => list
                .filter(f => f.kind !== ComposerFragmentKind.ARTICLE || articleIds.has(f.id))
                .map(f => f.kind === ComposerFragmentKind.MULTI_COLUMN
                ? { ...f, columns: (f.columns ?? []).map(column => pruneOrphanArticles(column)) }
                : f);
            state.fragmentOrder = pruneOrphanArticles(state.fragmentOrder);
        }
    }
}
