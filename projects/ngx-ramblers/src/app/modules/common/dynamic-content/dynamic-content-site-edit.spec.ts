import {
  BreakStopCondition,
  NestedRowContentSource,
  NestedRowMappingConfig,
  NestedRowPackingBehavior
} from "../../../models/content-text.model";
import { assignDeep } from "../../../functions/object-utils";

describe("updateColumnNestedRowMapping", () => {
  let mockComponent: any;
  let mockEnsureColumnMapping: jasmine.Spy;

  beforeEach(() => {
    mockEnsureColumnMapping = jasmine.createSpy("ensureColumnMapping");

    mockComponent = {
      isMigrationTemplateSelected: jasmine.createSpy("isMigrationTemplateSelected").and.returnValue(true),
      ensureColumnMapping: mockEnsureColumnMapping
    };
  });

  function updateColumnNestedRowMapping(
    rowIndex: number,
    columnIndex: number,
    updates: Partial<NestedRowMappingConfig>,
    nestedRowIndex?: number,
    nestedColumnIndex?: number
  ) {
    if (!mockComponent.isMigrationTemplateSelected()) {
      return;
    }
    const colMapping = mockComponent.ensureColumnMapping(rowIndex, columnIndex, nestedRowIndex, nestedColumnIndex);
    const target = colMapping.nestedRowMapping = colMapping.nestedRowMapping || {} as NestedRowMappingConfig;
    assignDeep(target, updates);
  }

  it("should return early if migration template is not selected", () => {
    mockComponent.isMigrationTemplateSelected.and.returnValue(false);
    const colMapping = {nestedRowMapping: {}};
    mockEnsureColumnMapping.and.returnValue(colMapping);

    updateColumnNestedRowMapping(0, 0, {contentSource: NestedRowContentSource.ALL_CONTENT});

    expect(mockEnsureColumnMapping).not.toHaveBeenCalled();
  });

  it("should create nestedRowMapping if it doesn't exist", () => {
    const colMapping: any = {};
    mockEnsureColumnMapping.and.returnValue(colMapping);

    const updates: Partial<NestedRowMappingConfig> = {
      contentSource: NestedRowContentSource.ALL_CONTENT,
      packingBehavior: NestedRowPackingBehavior.ALL_IN_ONE
    };

    updateColumnNestedRowMapping(0, 0, updates);

    expect(colMapping.nestedRowMapping).toBeDefined();
    expect(colMapping.nestedRowMapping.contentSource).toBe(NestedRowContentSource.ALL_CONTENT);
    expect(colMapping.nestedRowMapping.packingBehavior).toBe(NestedRowPackingBehavior.ALL_IN_ONE);
  });

  it("should update existing nestedRowMapping", () => {
    const existingMapping: NestedRowMappingConfig = {
      contentSource: NestedRowContentSource.REMAINING_IMAGES,
      packingBehavior: NestedRowPackingBehavior.ONE_PER_ITEM
    };
    const colMapping = {nestedRowMapping: existingMapping};
    mockEnsureColumnMapping.and.returnValue(colMapping);

    const updates: Partial<NestedRowMappingConfig> = {
      contentSource: NestedRowContentSource.ALL_CONTENT,
      breakOn: BreakStopCondition.IMAGE
    };

    updateColumnNestedRowMapping(1, 2, updates);

    expect(colMapping.nestedRowMapping.contentSource).toBe(NestedRowContentSource.ALL_CONTENT);
    expect(colMapping.nestedRowMapping.packingBehavior).toBe(NestedRowPackingBehavior.ONE_PER_ITEM);
    expect(colMapping.nestedRowMapping.breakOn).toBe(BreakStopCondition.IMAGE);
  });

  it("should handle partial updates with optional fields", () => {
    const colMapping: any = {};
    mockEnsureColumnMapping.and.returnValue(colMapping);

    const updates: Partial<NestedRowMappingConfig> = {
      contentSource: NestedRowContentSource.PATTERN_MATCH,
      filenamePattern: "*.jpg",
      groupTextWithImage: true
    };

    updateColumnNestedRowMapping(0, 0, updates);

    expect(colMapping.nestedRowMapping.contentSource).toBe(NestedRowContentSource.PATTERN_MATCH);
    expect(colMapping.nestedRowMapping.filenamePattern).toBe("*.jpg");
    expect(colMapping.nestedRowMapping.groupTextWithImage).toBe(true);
  });

  it("should pass all parameters to ensureColumnMapping", () => {
    const colMapping = {nestedRowMapping: {}};
    mockEnsureColumnMapping.and.returnValue(colMapping);

    const updates: Partial<NestedRowMappingConfig> = {
      contentSource: NestedRowContentSource.ALL_CONTENT
    };

    updateColumnNestedRowMapping(5, 3, updates, 2, 1);

    expect(mockEnsureColumnMapping).toHaveBeenCalledWith(5, 3, 2, 1);
  });

  it("should handle empty updates object", () => {
    const existingMapping: NestedRowMappingConfig = {
      contentSource: NestedRowContentSource.ALL_IMAGES,
      packingBehavior: NestedRowPackingBehavior.COLLECT_WITH_BREAKS
    };
    const colMapping = {nestedRowMapping: existingMapping};
    mockEnsureColumnMapping.and.returnValue(colMapping);

    updateColumnNestedRowMapping(0, 0, {});

    expect(colMapping.nestedRowMapping.contentSource).toBe(NestedRowContentSource.ALL_IMAGES);
    expect(colMapping.nestedRowMapping.packingBehavior).toBe(NestedRowPackingBehavior.COLLECT_WITH_BREAKS);
  });

  it("should handle nested row and column indices", () => {
    const colMapping: any = {};
    mockEnsureColumnMapping.and.returnValue(colMapping);

    const updates: Partial<NestedRowMappingConfig> = {
      contentSource: NestedRowContentSource.REMAINING_TEXT,
      packingBehavior: NestedRowPackingBehavior.ONE_PER_ITEM
    };

    updateColumnNestedRowMapping(10, 5, updates, 3, 2);

    expect(mockEnsureColumnMapping).toHaveBeenCalledWith(10, 5, 3, 2);
    expect(colMapping.nestedRowMapping.contentSource).toBe(NestedRowContentSource.REMAINING_TEXT);
    expect(colMapping.nestedRowMapping.packingBehavior).toBe(NestedRowPackingBehavior.ONE_PER_ITEM);
  });
});
