/**
 * Shared page chrome classes, so every page in the app and the admin agree on the same scale.
 * The rendered-markdown headings in globals.css sit below `pageTitleClass`, so a body heading
 * never competes with the title of the page it is on.
 */

/** The one page-title style: every <h1> in (app) and in the admin uses it. */
export const pageTitleClass = "text-2xl font-semibold tracking-tight";
