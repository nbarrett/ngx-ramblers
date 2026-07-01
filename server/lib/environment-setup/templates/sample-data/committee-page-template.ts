import {
  AlbumIndexSortField,
  IndexContentType,
  IndexRenderMode,
  PageContent,
  PageContentRow,
  PageContentType,
  StringMatch
} from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { SortDirection } from "../../../../../projects/ngx-ramblers/src/app/models/sort.model";

export const COMMITTEE_ROOT_PATH = "committee";
export const COMMITTEE_YEARS_FRAGMENT_PATH = "fragments/committee-years";

function committeeIntroductionRow(groupName: string): PageContentRow {
  return {
    type: PageContentType.TEXT,
    showSwiper: false,
    maxColumns: 1,
    columns: [{
      accessLevel: AccessLevel.PUBLIC,
      contentText: `# Committee\n\nWelcome to the ${groupName} Committee page. Here you'll find documents related to the Committee, AGM and Annual Financial Returns for the group.`
    }]
  };
}

function autoPopulateCommitteeDocumentsRow(): PageContentRow {
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

function committeeYearsIndexRow(): PageContentRow {
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

function sharedFragmentRow(pageContentId: string): PageContentRow {
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

export function committeeYearsFragmentPageContent(): PageContent {
  return {
    path: COMMITTEE_YEARS_FRAGMENT_PATH,
    rows: [committeeYearsIndexRow()]
  };
}

export function committeeRootPageContent(groupName: string, fragmentPageContentId: string): PageContent {
  return {
    path: COMMITTEE_ROOT_PATH,
    rows: [
      committeeIntroductionRow(groupName),
      autoPopulateCommitteeDocumentsRow(),
      sharedFragmentRow(fragmentPageContentId)
    ]
  };
}
