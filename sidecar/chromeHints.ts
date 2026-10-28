/** What a chrome_* result adds when the agent lands on a sign-in page in the app's headless Chrome. */
import type { Cdp } from "./chrome.ts";
import { evaluate } from "./chromePage.ts";

// ponytail: a sign-in page is known by a title that starts with it or a path segment naming it; one that does neither gets no hint.
const TITLE = /^\W*(?:sign|log)[ _-]?in\b/i;
const PATH = /\/(?:sign|log)[_-]?in(?:[/?#.]|$)/i;

const SIGN_IN_HINT =
  "\nThis is the app's headless Chrome: the user can't see it or type into it, so never ask them to sign in here. " +
  "If you can't sign in here yourself, pass user_chrome: true to use their own Chrome, where they're signed in.";

/** A page's title and URL. */
type Page = { title: string; url: string };

/** SIGN_IN_HINT when `page` reads as a sign-in page in the app's Chrome outside a task (which can't use the user's); else nothing. */
export const signInHint = (page: Page, user: boolean, task: boolean) =>
  !user && !task && (TITLE.test(page.title) || PATH.test(page.url))
    ? SIGN_IN_HINT
    : "";

/** The loaded page's title and URL; empty when they can't be read. */
export const pageOf = (cdp: Cdp, sessionId: string): Promise<Page> =>
  evaluate(cdp, sessionId, "({ title: document.title, url: location.href })")
    .then((v) => v as Page)
    .catch(() => ({ title: "", url: "" }));
