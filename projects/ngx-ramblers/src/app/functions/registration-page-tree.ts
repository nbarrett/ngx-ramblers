import { RegistrationNavbarPath, RegistrationNavbarTitle, RegistrationNavigationItem, RegistrationPage, RegistrationPageType } from "../models/site-registration.model";
import { SitemapMoveDirection, SitemapNode } from "../models/sitemap.model";

export const REGISTRATION_NAVBAR_LIMIT = 8;

export function unusedRegistrationPath(used: Set<string>, path: string): string {
  const extras = Array.from({length: 30}, (_item, index) => `${path}-${index + 2}`);
  return [path, ...extras].find(candidate => !used.has(candidate)) || `${path}-${used.size + 2}`;
}

export function registrationPageTree(pages: RegistrationPage[]): SitemapNode[] {
  const byPath = pages.reduce((index, page) => index.set(page.path, {key: page.path, title: page.title, href: null, selected: page.selected, detail: registrationPageDetail(page), children: []}), new Map<string, SitemapNode>());
  return pages.reduce((roots, page) => {
    const node = byPath.get(page.path);
    const parent = page.parentPath ? byPath.get(page.parentPath) : null;
    if (parent) {
      parent.children = [...parent.children, node];
      return roots;
    } else {
      return [...roots, node];
    }
  }, [] as SitemapNode[]);
}

export function registrationPagesWithSelection(pages: RegistrationPage[], path: string, selected: boolean): RegistrationPage[] {
  return pages.map(page => {
    const isTarget = page.path === path;
    const isDescendant = page.path.startsWith(`${path}/`);
    const isAncestor = path.startsWith(`${page.path}/`);
    if (selected && (isTarget || isDescendant || isAncestor)) {
      return {...page, selected: true};
    } else if (!selected && (isTarget || isDescendant)) {
      return {...page, selected: false};
    } else {
      return page;
    }
  });
}

export function registrationPagesMoved(pages: RegistrationPage[], path: string, direction: SitemapMoveDirection): RegistrationPage[] {
  const moving = pages.find(page => page.path === path);
  const siblingIndexes = pages.reduce((indexes, page, index) => page.parentPath === moving?.parentPath ? [...indexes, index] : indexes, [] as number[]);
  const position = siblingIndexes.findIndex(index => pages[index].path === path);
  const swapWith = position + direction;
  if (!moving || position < 0 || swapWith < 0 || swapWith >= siblingIndexes.length) {
    return pages;
  } else {
    const from = siblingIndexes[position];
    const to = siblingIndexes[swapWith];
    return pages.map((page, index) => index === from ? pages[to] : index === to ? pages[from] : page);
  }
}

export function proposedRegistrationNavigation(pages: RegistrationPage[]): RegistrationNavigationItem[] {
  return pages.filter(page => page.selected && !page.parentPath).map(page => ({path: page.path, title: page.title}));
}

const NAVBAR_ROLES: {path: RegistrationNavbarPath; title: RegistrationNavbarTitle; synonyms: string[]}[] = [
  {path: RegistrationNavbarPath.HOME, title: RegistrationNavbarTitle.HOME, synonyms: ["home", "welcome"]},
  {path: RegistrationNavbarPath.ABOUT_US, title: RegistrationNavbarTitle.ABOUT_US, synonyms: ["about", "about us", "about-us"]},
  {path: RegistrationNavbarPath.CONTACT_US, title: RegistrationNavbarTitle.CONTACT_US, synonyms: ["contact", "contacts", "contact us", "contact-us", "contact details"]},
  {path: RegistrationNavbarPath.PHOTOS, title: RegistrationNavbarTitle.PHOTOS, synonyms: ["photos", "gallery", "scrapbook", "albums", "album"]},
  {path: RegistrationNavbarPath.LEADING_A_WALK, title: RegistrationNavbarTitle.LEADING_A_WALK, synonyms: ["leading a walk", "walk leaders", "walk-leaders", "leaders"]},
  {path: RegistrationNavbarPath.IN_THE_NEWS, title: RegistrationNavbarTitle.IN_THE_NEWS, synonyms: ["in the news", "news", "notice board", "notices", "notice-board"]},
  {path: RegistrationNavbarPath.TESTIMONIALS, title: RegistrationNavbarTitle.TESTIMONIALS, synonyms: ["testimonials", "testimonial"]},
  {path: RegistrationNavbarPath.MEMBERSHIP, title: RegistrationNavbarTitle.MEMBERSHIP, synonyms: ["membership", "join us", "join"]},
  {path: RegistrationNavbarPath.COMMITTEE, title: RegistrationNavbarTitle.COMMITTEE, synonyms: ["committee"]},
  {path: RegistrationNavbarPath.INFORMATION, title: RegistrationNavbarTitle.INFORMATION, synonyms: ["information", "info"]}
];

const MAX_NAVBAR_TITLE_WORDS = 3;

const NAVBAR_CORE_PATHS: string[] = [
  RegistrationNavbarPath.HOME, RegistrationNavbarPath.WALKS, RegistrationNavbarPath.EVENTS,
  RegistrationNavbarPath.ABOUT_US, RegistrationNavbarPath.CONTACT_US, RegistrationNavbarPath.PHOTOS,
  RegistrationNavbarPath.ADMIN
];

const NAVBAR_REQUIRED_PATHS: string[] = [
  RegistrationNavbarPath.HOME, RegistrationNavbarPath.ABOUT_US, RegistrationNavbarPath.CONTACT_US, RegistrationNavbarPath.ADMIN
];

export function isRegistrationFeaturePath(path: string): boolean {
  return path === RegistrationNavbarPath.WALKS || path === RegistrationNavbarPath.EVENTS || path === RegistrationNavbarPath.ADMIN;
}

function pageMatchesRole(page: RegistrationPage, role: {path: RegistrationNavbarPath; synonyms: string[]}): boolean {
  const leaf = (page.path.split("/").pop() || "").toLowerCase().replace(/-/g, " ");
  const title = page.title.trim().toLowerCase();
  const galleryForPhotos = role.path === RegistrationNavbarPath.PHOTOS && !page.proposed && (page.type === RegistrationPageType.GALLERY || /\b(photos?|photo galler(y|ies)|galler(y|ies)|albums?)\b/.test(title));
  return galleryForPhotos || role.synonyms.some(synonym => leaf === synonym || title === synonym);
}

export function standardiseRegistrationPageNames(pages: RegistrationPage[]): RegistrationPage[] {
  return NAVBAR_ROLES.reduce((current, role) => {
    const titled = current.map(page => page.path === role.path ? {...page, title: role.title} : page);
    const match = titled.find(page => !page.parentPath && page.path !== role.path && pageMatchesRole(page, role));
    return match ? renameRegistrationPage(titled, match.path, role.path, role.title) : titled;
  }, pages);
}

export function insertRegistrationFeaturePages(pages: RegistrationPage[], hasWalks: boolean, hasSocialEvents: boolean): RegistrationPage[] {
  const about = {url: "", path: RegistrationNavbarPath.ABOUT_US, title: RegistrationNavbarTitle.ABOUT_US, type: RegistrationPageType.TEXT, selected: true, parentPath: null as string, proposed: true};
  const contact = {url: "", path: RegistrationNavbarPath.CONTACT_US, title: RegistrationNavbarTitle.CONTACT_US, type: RegistrationPageType.CONTACT, selected: true, parentPath: null as string, proposed: true};
  const walks = {url: "", path: RegistrationNavbarPath.WALKS, title: RegistrationNavbarTitle.WALKS, type: RegistrationPageType.INDEX, selected: true, parentPath: null as string, proposed: true};
  const events = {url: "", path: RegistrationNavbarPath.EVENTS, title: RegistrationNavbarTitle.EVENTS, type: RegistrationPageType.INDEX, selected: true, parentPath: null as string, proposed: true};
  const admin = {url: "", path: RegistrationNavbarPath.ADMIN, title: RegistrationNavbarTitle.ADMIN, type: RegistrationPageType.INDEX, selected: true, parentPath: null as string, proposed: true};
  const features = [about, contact, ...(hasWalks ? [walks] : []), ...(hasSocialEvents ? [events] : []), admin];
  return [...pages, ...features.filter(feature => !pages.some(page => page.path === feature.path))];
}

export function assembleRegistrationPages(pages: RegistrationPage[], hasWalks = false, hasSocialEvents = false): RegistrationPage[] {
  const flattened = withSourceNesting(pages);
  return constrainRegistrationNavbar(nestRegistrationPages(insertRegistrationFeaturePages(standardiseRegistrationPageNames(flattened), hasWalks, hasSocialEvents)));
}

function withSourceNesting(pages: RegistrationPage[]): RegistrationPage[] {
  const byPath = new Map(pages.map(page => [page.path, page]));
  const leafOf = (page: RegistrationPage) => page.path.split("/").pop() || page.path;
  const sourceParentOf = (page: RegistrationPage): RegistrationPage => {
    const parent = page.parentPath ? byPath.get(page.parentPath) : null;
    return !parent ? null : parent.proposed ? sourceParentOf(parent) : parent;
  };
  const nestedPath = (page: RegistrationPage): string => {
    const parent = page.proposed ? null : sourceParentOf(page);
    return parent ? `${nestedPath(parent)}/${leafOf(page)}` : leafOf(page);
  };
  return pages.map(page => {
    const path = nestedPath(page);
    return {...page, path, parentPath: path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : null};
  });
}

function nestRegistrationPages(pages: RegistrationPage[]): RegistrationPage[] {
  const hasWalks = pages.some(page => page.path === RegistrationNavbarPath.WALKS && !page.parentPath);
  const hasAbout = pages.some(page => page.path === RegistrationNavbarPath.ABOUT_US && !page.parentPath);
  const newParentOf = (page: RegistrationPage): string | null => {
    if (isRegistrationFeaturePath(page.path) && !page.url) {
      return null;
    } else if (hasWalks && isWalksSubpage(page) && page.parentPath !== RegistrationNavbarPath.WALKS) {
      return RegistrationNavbarPath.WALKS;
    } else if (hasAbout && isAboutSubpage(page) && page.parentPath !== RegistrationNavbarPath.ABOUT_US) {
      return RegistrationNavbarPath.ABOUT_US;
    } else {
      return null;
    }
  };
  const moves = pages
    .map(page => ({page, parentPath: newParentOf(page)}))
    .filter(move => !!move.parentPath)
    .filter((move, index, all) => !all.some(other => other !== move && move.page.path.startsWith(`${other.page.path}/`)));
  return moves.reduce((moved, move) => withSubtreeMoved(moved, move.page.path, `${move.parentPath}/${move.page.path.split("/").pop() || move.page.path}`), pages);
}

function withSubtreeMoved(pages: RegistrationPage[], fromPath: string, toPath: string): RegistrationPage[] {
  const movedPath = (path: string | null) => path === fromPath ? toPath : path?.startsWith(`${fromPath}/`) ? `${toPath}${path.slice(fromPath.length)}` : path;
  const newParent = toPath.includes("/") ? toPath.substring(0, toPath.lastIndexOf("/")) : null;
  return pages.map(page => page.path === fromPath
    ? {...page, path: toPath, parentPath: newParent}
    : page.path.startsWith(`${fromPath}/`) ? {...page, path: movedPath(page.path), parentPath: movedPath(page.parentPath)} : page);
}

function isWalksSubpage(page: RegistrationPage): boolean {
  const haystack = `${page.path.split("/").pop()} ${page.title}`.toLowerCase().replace(/-/g, " ");
  return page.path !== RegistrationNavbarPath.WALKS && /leading a walk|walk leaders|walk guides|walk brief/.test(haystack);
}

function isAboutSubpage(page: RegistrationPage): boolean {
  const haystack = `${page.path.split("/").pop()} ${page.title}`.toLowerCase().replace(/-/g, " ");
  return /testimonial/.test(haystack);
}

export function isNavbarTitle(title: string): boolean {
  const words = (title || "").trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= MAX_NAVBAR_TITLE_WORDS && !/[.?!,;:]/.test(title);
}

export function constrainRegistrationNavbar(pages: RegistrationPage[]): RegistrationPage[] {
  const ordered = orderRegistrationNavbar(pages);
  const roots = ordered.filter(page => !page.parentPath);
  const coreRoots = roots.filter(page => NAVBAR_CORE_PATHS.includes(page.path) && !(isRegistrationFeaturePath(page.path) && page.url));
  const sentenceRoots = roots.filter(page => !coreRoots.some(core => core.path === page.path) && !NAVBAR_REQUIRED_PATHS.includes(page.path) && !isNavbarTitle(page.title));
  const overflowRoots = roots.filter(page => !coreRoots.some(core => core.path === page.path) && !NAVBAR_REQUIRED_PATHS.includes(page.path));
  if (roots.length <= REGISTRATION_NAVBAR_LIMIT && !sentenceRoots.length) {
    return ordered;
  } else {
    const information = roots.find(page => page.path === RegistrationNavbarPath.INFORMATION) || {
      url: overflowRoots[0]?.url || coreRoots[0].url, path: RegistrationNavbarPath.INFORMATION, title: RegistrationNavbarTitle.INFORMATION,
      type: RegistrationPageType.INDEX, selected: true, parentPath: null, proposed: true
    };
    const keptCore = coreRoots.filter(page => page.path !== information.path);
    const required = keptCore.filter(page => NAVBAR_REQUIRED_PATHS.includes(page.path) || page.path === RegistrationNavbarPath.WALKS || page.path === RegistrationNavbarPath.EVENTS);
    const optional = keptCore.filter(page => !required.some(item => item.path === page.path));
    const room = REGISTRATION_NAVBAR_LIMIT - 1 - required.length;
    const kept = [...required, ...optional.slice(0, Math.max(room, 0))];
    const droppedCore = keptCore.filter(page => !kept.some(item => item.path === page.path));
    const overflowList = roots.length > REGISTRATION_NAVBAR_LIMIT
      ? [...overflowRoots.filter(page => page.path !== information.path), ...droppedCore]
      : sentenceRoots.filter(page => page.path !== information.path);
    const overflow = (page: RegistrationPage) => overflowList.some(root => page.path === root.path || page.path.startsWith(`${root.path}/`));
    const rehomed = ordered.filter(overflow).map(page => ({
      ...page,
      path: `${information.path}/${page.path}`,
      parentPath: page.parentPath ? `${information.path}/${page.parentPath}` : information.path
    }));
    const retained = ordered.filter(page => !overflow(page) && page.path !== information.path);
    const keptRoots = roots.length > REGISTRATION_NAVBAR_LIMIT ? kept : retained.filter(page => !page.parentPath);
    return orderRegistrationNavbar([...keptRoots, information, ...retained.filter(page => !!page.parentPath), ...rehomed]);
  }
}

function orderRegistrationNavbar(pages: RegistrationPage[]): RegistrationPage[] {
  const rank = (path: string) => {
    const order: string[] = [
      RegistrationNavbarPath.HOME, RegistrationNavbarPath.ABOUT_US, RegistrationNavbarPath.WALKS,
      RegistrationNavbarPath.EVENTS, RegistrationNavbarPath.CONTACT_US, RegistrationNavbarPath.PHOTOS,
      RegistrationNavbarPath.INFORMATION, RegistrationNavbarPath.ADMIN
    ];
    const index = order.indexOf(path);
    return index < 0 ? order.indexOf(RegistrationNavbarPath.INFORMATION) + 0.5 : index;
  };
  const roots = pages.filter(page => !page.parentPath).sort((left, right) => rank(left.path) - rank(right.path));
  const children = pages.filter(page => !!page.parentPath);
  return [...roots, ...children];
}

function renameRegistrationPage(pages: RegistrationPage[], fromPath: string, toPath: string, title: string): RegistrationPage[] {
  return withSubtreeMoved(pages, fromPath, toPath).map(page => page.path === toPath
    ? {...page, title, sourceTitle: page.sourceTitle || page.title, suggestedTitle: title}
    : page);
}

function registrationPageDetail(page: RegistrationPage): string {
  if (page.proposed) {
    return "Section index on the new site";
  } else if (page.type === RegistrationPageType.WALKS) {
    return "Walks programme on the new site";
  } else if (page.type === RegistrationPageType.CONTACT) {
    return "Contact page on the new site";
  } else if (page.type === RegistrationPageType.GALLERY) {
    return "Photo gallery on the new site";
  } else if (page.type === RegistrationPageType.INDEX) {
    return "Section index on the new site";
  } else {
    return "Text and images on the new site";
  }
}
