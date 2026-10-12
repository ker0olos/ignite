---
name: design-references
description: Find design references on Dribbble for a screen, component or style (a dashboard, an onboarding flow, a pricing page, glassmorphism) and show the user the best ones. Use when the user asks for design inspiration, references, examples or what something could look like.
---

# Design references

Search Dribbble in the app's own headless Chrome and show the user a few
shots worth looking at. Dribbble has no search API, and its site stops plain
HTTP clients (`curl`, `fetch`) with a bot check, so the search runs in
Chrome.

**Always use the headless Chrome.** Never pass `user_chrome: true` to any
`chrome_*` tool here: no login is needed, and the user's own Chrome must not
fill with tabs. If the headless one hits a challenge page, say so and stop.

## 1. Search

Turn the request into a short query of 1 to 4 words ("dashboard", "mobile
onboarding", "pricing page dark"). Open the search in a new tab:

```
chrome_navigate  url: https://dribbble.com/search/<query, URL-encoded>  new_tab: true
```

## 2. Read the results

Run this in that tab with `chrome_eval`. It returns the first 24 shots with
their full-size image URLs (lazy-loaded cards have a placeholder `src`, so the
URL is read from the card's HTML):

```js
[...document.querySelectorAll("li.shot-thumbnail")].slice(0, 24).map((li) => ({
  title: li.querySelector(".shot-title")?.textContent.trim(),
  shot: li.querySelector("a.shot-thumbnail-link")?.href,
  image:
    li.innerHTML.match(
      /https:\/\/cdn\.dribbble\.com\/userupload\/[^"?\s]+/,
    )?.[0] + "?resize=1600x1200",
}));
```

If it returns nothing, take a `chrome_screenshot` of the tab to see why (no
results, a changed page, a challenge) and tell the user. If there are few
results, try one broader query.

## 3. Pick and show

Choose the 4 to 6 shots that best fit what the user asked for, judging by
their titles first. Download each into your scratchpad with bash and show it
with `show_image`:

```
curl -sL -o <scratchpad>/ref-1.png "<image URL>"
```

(The artifact frame can't load remote images, so don't put the CDN URLs in an
HTML page.)

Then reply with a short list: each shot's title linked to its `shot` URL,
and one line on what's worth taking from it (layout, color, type, a
component). Close the tab with `chrome_cdp` (`Target.closeTarget`) when done.
