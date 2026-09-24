import { definePlugin, type ImprintPlugin } from "@imprint/runtime-admin";
import { wikiActions } from "./admin/actions";
import { wikiScreen } from "./admin/screens";
import { wikiContentTypes } from "./content-types";
import { wikiPublicRoute } from "./public";

/**
 * @imprint/plugin-wiki — wikis as a plugin (design/fase-5, design/wiki.md):
 * three content types with their relation rules, the tree studio under
 * `/admin/wiki`, its actions (including publish-to-live), and the public
 * route that gives every wiki its own URL space (`/<wiki>/…`, restricted
 * ones under /members). A site switches it on with `plugins: [wikiPlugin()]`.
 *
 * Node scripts (seed, tests) import the React-free entries instead:
 * `./content-types`, `./schemas` and `./href`; this index pulls in screens.
 */
export function wikiPlugin(): ImprintPlugin {
  return definePlugin({
    name: "wiki",
    version: "0.10.2",
    contentTypes: wikiContentTypes,
    menu: [{ group: "content", section: "Wiki", items: [{ href: "/admin/wiki", label: "Wikis" }] }],
    screen: wikiScreen,
    actions: wikiActions,
    publicRoute: wikiPublicRoute,
  });
}

export { wikiContentTypes } from "./content-types";
export { scopedSlug, slugify, wikiPageHref } from "./href";
export {
  legacyVisibilityToAccess,
  WikiFieldsSchema,
  WikiFolderSchema,
  WikiPageSchema,
  WikiSchema,
  type Wiki,
  type WikiFolder,
  type WikiPage,
} from "./schemas";
export { WikiView } from "./view";
export { getWiki, getWikiTree, listWikis, type WikiTree } from "./wiki";
