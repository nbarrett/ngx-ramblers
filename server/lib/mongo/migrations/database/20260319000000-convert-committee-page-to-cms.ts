import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { dateTimeFromMillis } from "../../../shared/dates";
import {
  AlbumIndexSortField,
  IndexContentType,
  IndexRenderMode,
  PageContentType,
  StringMatch
} from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { SortDirection } from "../../../../../projects/ngx-ramblers/src/app/models/sort.model";

const debugLog = createMigrationLogger("convert-committee-page-to-cms");
const CONFIG_COLLECTION = "config";
const PAGE_CONTENT_COLLECTION = "pageContent";
const CONTENT_TEXT_COLLECTION = "contentText";
const COMMITTEE_FILES_COLLECTION = "committeeFiles";
const COMMITTEE_ROOT_PATH = "committee";
const COMMITTEE_YEARS_OLD_FRAGMENT_PATH = "committee#committee-years";
const COMMITTEE_YEARS_FRAGMENT_PATH = "fragments/committee-years";
const COMMITTEE_ACTION_BUTTONS_PATH = "committee#action-buttons";

function createCommitteeDocumentsRow(fileIds: string[], imageSource?: string) {
  return {
    type: PageContentType.COMMITTEE_DOCUMENTS,
    showSwiper: false,
    maxColumns: 1,
    columns: [],
    committeeDocuments: {
      fileIds,
      autoFromFirstActionButton: false,
      showFileActions: true,
      sortDirection: SortDirection.DESC,
      ...(imageSource ? {imageSource} : {})
    }
  };
}

function createAutoPopulateCommitteeDocumentsRow() {
  return {
    type: PageContentType.COMMITTEE_DOCUMENTS,
    showSwiper: false,
    maxColumns: 1,
    columns: [],
    committeeDocuments: {
      fileIds: [],
      autoFromFirstActionButton: true,
      showFileActions: true,
      sortDirection: SortDirection.DESC
    }
  };
}

function createCommitteeYearsIndexRow() {
  return {
    type: PageContentType.ALBUM_INDEX,
    showSwiper: true,
    maxColumns: 3,
    columns: [],
    albumIndex: {
      contentPaths: [{
        contentPath: COMMITTEE_ROOT_PATH,
        stringMatch: StringMatch.STARTS_WITH,
        maxPathSegments: 2
      }],
      excludePaths: [],
      columnOverrides: [],
      sortConfig: {field: AlbumIndexSortField.TITLE, direction: SortDirection.DESC},
      indexMarkdown: "## Committee Years",
      autoTitle: false,
      contentTypes: [IndexContentType.PAGES],
      renderModes: [IndexRenderMode.ACTION_BUTTONS]
    }
  };
}

function createSharedFragmentRow(pageContentId: string) {
  return {
    type: PageContentType.SHARED_FRAGMENT,
    showSwiper: false,
    maxColumns: 1,
    columns: [],
    fragment: {
      pageContentId
    }
  };
}

function createTextRow(text: string) {
  return {
    type: PageContentType.TEXT,
    showSwiper: false,
    maxColumns: 1,
    columns: [{
      contentText: text,
      accessLevel: AccessLevel.PUBLIC
    }]
  };
}

function extractYear(eventDate: number): number {
  return dateTimeFromMillis(eventDate).year;
}

async function migrateCommitteePage(db: Db) {
  const pageContentCollection = db.collection(PAGE_CONTENT_COLLECTION);
  const committeeFilesCollection = db.collection(COMMITTEE_FILES_COLLECTION);
  const contentTextCollection = db.collection(CONTENT_TEXT_COLLECTION);

  const allFiles = await committeeFilesCollection.find({}).toArray();
  debugLog("Found %d committee files", allFiles.length);

  const filesByYear: Record<number, string[]> = {};
  allFiles.forEach((file: any) => {
    const year = file.eventDate ? extractYear(file.eventDate) : null;
    if (year) {
      if (!filesByYear[year]) {
        filesByYear[year] = [];
      }
      filesByYear[year].push(file._id.toString());
    }
  });

  const years = Object.keys(filesByYear).map(Number).sort((a, b) => b - a);
  debugLog("Committee files grouped into %d years: %o", years.length, years);

  let yearsFragment = await pageContentCollection.findOne({path: COMMITTEE_YEARS_FRAGMENT_PATH});
  if (!yearsFragment) {
    yearsFragment = await pageContentCollection.findOne({path: COMMITTEE_YEARS_OLD_FRAGMENT_PATH});
    if (yearsFragment) {
      await pageContentCollection.updateOne({_id: yearsFragment._id}, {$set: {path: COMMITTEE_YEARS_FRAGMENT_PATH}});
      debugLog("Renamed committee years fragment from %s to %s", COMMITTEE_YEARS_OLD_FRAGMENT_PATH, COMMITTEE_YEARS_FRAGMENT_PATH);
    }
  }
  const actionButtonsFragment = await pageContentCollection.findOne({path: COMMITTEE_ACTION_BUTTONS_PATH});

  const introductionText = await contentTextCollection.findOne({category: "committee", name: "introduction"});
  const systemConfigDoc = await db.collection(CONFIG_COLLECTION).findOne({key: "system"});
  const shortName = systemConfigDoc?.value?.area?.shortName || "the group";
  const introText = introductionText?.text || `Welcome to the ${shortName} Committee page. Here, you'll find events related to the Committee, AGM and Annual Financial Returns for the group.`;

  // Extract image sources from existing fragment action-button columns before converting
  const fragmentColumns: any[] = (yearsFragment?.rows || [])
    .filter((row: any) => row?.type === PageContentType.ACTION_BUTTONS || row?.type === "slides")
    .flatMap((row: any) => row.columns || []);

  // Convert or create the fragment with an index row instead of action buttons
  const indexFragmentRows = [createCommitteeYearsIndexRow()];

  if (yearsFragment) {
    await pageContentCollection.updateOne({_id: yearsFragment._id}, {$set: {rows: indexFragmentRows}});
    debugLog("Converted committee years fragment to use index row (replaced %d action-button columns)", fragmentColumns.length);
  } else {
    const newFragment = await pageContentCollection.insertOne({path: COMMITTEE_YEARS_FRAGMENT_PATH, rows: indexFragmentRows});
    yearsFragment = {_id: newFragment.insertedId, path: COMMITTEE_YEARS_FRAGMENT_PATH, rows: indexFragmentRows};
    debugLog("Created committee years fragment with index row at %s", COMMITTEE_YEARS_FRAGMENT_PATH);
  }

  // Build root page
  const existingRoot = await pageContentCollection.findOne({path: COMMITTEE_ROOT_PATH});
  const hasCommitteeDocumentsRow = (existingRoot?.rows || []).some((row: any) => row?.type === PageContentType.COMMITTEE_DOCUMENTS);

  const rootRows: any[] = [];
  const existingTextRows = existingRoot && !hasCommitteeDocumentsRow
    ? (existingRoot.rows || []).filter((row: any) => row?.type === PageContentType.TEXT)
    : [];
  const existingActionButtonRows = existingRoot && !hasCommitteeDocumentsRow
    ? (existingRoot.rows || []).filter((row: any) => row?.type === PageContentType.ACTION_BUTTONS || row?.type === "slides")
    : [];

  if (introductionText?.text) {
    rootRows.push(createTextRow(`# Committee\n\n${introductionText.text}`));
    debugLog("Added introduction text row with heading from contentText");
  } else if (existingTextRows.length > 0) {
    rootRows.push(...existingTextRows);
    debugLog("Preserved %d existing text rows", existingTextRows.length);
  } else {
    rootRows.push(createTextRow(`# Committee\n\n${introText}`));
    debugLog("Added introduction text row with heading from default text");
  }

  rootRows.push(createAutoPopulateCommitteeDocumentsRow());
  debugLog("Added auto-populate committee documents row to root page");

  rootRows.push(createSharedFragmentRow(yearsFragment._id.toString()));
  debugLog("Added shared fragment reference to committee years (%s)", yearsFragment._id);

  rootRows.push(...existingActionButtonRows);
  debugLog("Preserved %d existing action button rows", existingActionButtonRows.length);

  if (actionButtonsFragment?.rows?.length > 0) {
    rootRows.push(...actionButtonsFragment.rows);
    await pageContentCollection.deleteOne({path: COMMITTEE_ACTION_BUTTONS_PATH});
    debugLog("Merged %d action buttons rows and cleaned up fragment", actionButtonsFragment.rows.length);
  }

  if (existingRoot) {
    if (!hasCommitteeDocumentsRow) {
      await pageContentCollection.updateOne({_id: existingRoot._id}, {$set: {rows: rootRows}});
      debugLog("Updated committee root page with %d rows", rootRows.length);
    } else {
      debugLog("Committee root page already has a committee-documents row — skipping root update");
    }
  } else if (rootRows.length > 0) {
    await pageContentCollection.insertOne({path: COMMITTEE_ROOT_PATH, rows: rootRows});
    debugLog("Created committee root page with %d rows", rootRows.length);
  }

  // Create year pages with committee documents rows
  for (const year of years) {
    const yearPath = `${COMMITTEE_ROOT_PATH}/${year}`;
    const fileIds = filesByYear[year];
    const existingYearPage = await pageContentCollection.findOne({path: yearPath});
    const matchingColumn = fragmentColumns.find((col: any) => col.href === yearPath);
    const imageSource = matchingColumn?.imageSource;
    debugLog("Year %d: imageSource=%s (from fragment column href=%s)", year, imageSource || "none", matchingColumn?.href || "no match");
    const yearRows: any[] = [
      createTextRow(`# Committee Year ${year}\n\n${introText}`),
      createCommitteeDocumentsRow(fileIds, imageSource)
    ];

    yearRows.push(createSharedFragmentRow(yearsFragment._id.toString()));

    if (existingYearPage) {
      const hasDocsRow = (existingYearPage.rows || []).some((row: any) => row?.type === PageContentType.COMMITTEE_DOCUMENTS);
      if (!hasDocsRow) {
        const updatedRows = [...(existingYearPage.rows || []), ...yearRows];
        await pageContentCollection.updateOne({_id: existingYearPage._id}, {$set: {rows: updatedRows}});
        debugLog("Added committee-documents row and shared fragment to page at %s with %d files", yearPath, fileIds.length);
      } else {
        debugLog("Page at %s already has a committee-documents row — skipping", yearPath);
      }
    } else {
      await pageContentCollection.insertOne({path: yearPath, rows: yearRows});
      debugLog("Created page at %s with %d files and shared fragment", yearPath, fileIds.length);
    }
  }
}

export async function up(db: Db) {
  await migrateCommitteePage(db);
}

export async function down(db: Db) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const committeeFilesCollection = db.collection(COMMITTEE_FILES_COLLECTION);
  const allFiles = await committeeFilesCollection.find({}).toArray();
  const years = [...new Set(allFiles.map((f: any) => f.eventDate ? extractYear(f.eventDate) : null).filter(Boolean))];

  for (const year of years) {
    await collection.deleteOne({path: `${COMMITTEE_ROOT_PATH}/${year}`});
  }
  await collection.deleteOne({path: COMMITTEE_ROOT_PATH});
  debugLog("Removed committee root page and %d year pages", years.length);
}
