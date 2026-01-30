import { PageContent, PageContentRow, PageContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../../../projects/ngx-ramblers/src/app/models/member-resource.model";

export interface PageContentTemplateParams {
  groupName: string;
  groupShortName: string;
}

function createTextRow(contentText: string, columns: number = 12): PageContentRow {
  return {
    type: PageContentType.TEXT,
    showSwiper: false,
    maxColumns: 12,
    columns: [
      {
        columns,
        accessLevel: AccessLevel.public,
        contentText
      }
    ]
  };
}

export function createHomeContent(params: PageContentTemplateParams): PageContent {
  return {
    path: "#home-content",
    rows: [
      createTextRow(`## Welcome to the ${params.groupName} Website\n\nWe are a friendly group offering walks in the local area. We usually meet on Sundays and offer a variety of walks.\n\nWalks are advertised on this site and on the Ramblers App.\n\nWe operate a "try before you buy" policy - you're welcome to join us for a few walks before deciding whether to become a member.\n\nWell-behaved dogs welcome!`)
    ]
  };
}

export function createWalksPageHeader(params: PageContentTemplateParams): PageContent {
  return {
    path: "walks#page-header",
    rows: [
      createTextRow("# Walks Programme")
    ]
  };
}

export function createWalksActionButtons(params: PageContentTemplateParams): PageContent {
  return {
    path: "walks#action-buttons",
    rows: [
      {
        type: PageContentType.ACTION_BUTTONS,
        showSwiper: false,
        maxColumns: 2,
        columns: [
          {
            columns: 6,
            title: "Walks Information",
            href: "walks/information",
            accessLevel: AccessLevel.public,
            contentText: "More information about our walks",
            showPlaceholderImage: true
          },
          {
            columns: 6,
            title: "Admin",
            href: "walks/admin",
            accessLevel: AccessLevel.committee,
            contentText: "Walk administration and settings",
            showPlaceholderImage: true
          }
        ]
      }
    ]
  };
}

export function createWalksInformation(params: PageContentTemplateParams): PageContent {
  return {
    path: "walks/information",
    rows: [
      createTextRow(`# Walks Information\n\n## Before you join a walk make sure that...\n\n- You have suitable footwear and clothing for the terrain and the weather\n- You have sufficient water and food with you\n- You are comfortable with the length/distance of the walk\n- You are familiar with the safety information on the [Ramblers website](https://www.ramblers.org.uk/go-walking-hub/safety)`)
    ]
  };
}

export function createContactUsPageContent(params: PageContentTemplateParams): PageContent {
  return {
    path: "contact-us",
    rows: [
      createTextRow(`# Contact Us\n\nFor general enquiries about ${params.groupName}, please email us.\n\nIf you have a question about a specific walk on our programme, please contact the walk leader directly.`)
    ]
  };
}

export function createAboutUsPageContent(params: PageContentTemplateParams): PageContent {
  return {
    path: "about-us",
    rows: [
      createTextRow(`# Join Us!\n\n## On the day\n\nYou can just turn up on the day. We do set off promptly at the start time, so please try to be there at least 10-15 minutes early.\n\nIt is advisable to carry a drink and a snack, and on longer walks bring a picnic.\n\n## How to join\n\nYou can join online via the [Ramblers website](https://www.ramblers.org.uk/membership).\n\nEnter your "Ramblers Group" as "${params.groupName}", and you'll be made a member of our group.`)
    ]
  };
}

export function createAdminActionButtons(params: PageContentTemplateParams): PageContent {
  return {
    path: "admin#action-buttons",
    rows: [
      {
        type: PageContentType.ACTION_BUTTONS,
        showSwiper: false,
        maxColumns: 3,
        columns: []
      }
    ]
  };
}

export function createAllSamplePageContent(params: PageContentTemplateParams): PageContent[] {
  return [
    createHomeContent(params),
    createWalksPageHeader(params),
    createWalksActionButtons(params),
    createWalksInformation(params),
    createContactUsPageContent(params),
    createAboutUsPageContent(params),
    createAdminActionButtons(params)
  ];
}

export const INCORRECT_PATHS_TO_CLEANUP = ["walks", "admin", "home", "committee"];
