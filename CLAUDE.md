# Barangay Malineng (malineng-web)

## Paano gamitin (how-to guides): keep them in sync
Every page that has a guide (`malineng-web/src/data/guides.json`) shows a "Paano gamitin" button with screenshots taken from the real app.

**Whenever you change a page, button, label or flow that appears in a guide, update that guide in the same change:**
1. Edit the steps in `malineng-web/scripts/guides/spec.mjs` (Tagalog `tl` and English `en`; the `ring` selector must still match the button).
2. Re-take the pictures: `malineng-web/scripts/guides/run.sh <guideId>` (needs Playwright; see `scripts/guides/README.md`).
3. Commit `public/guides/*.jpg` and `src/data/guides.json` together with the page change.

A new page that residents use should get a guide too. Never use drawings or stock photos in guides: only screenshots from the app.

## Working agreement
- Explain to the owner in Taglish; code, comments and names in English.
- Show a mock first for big new features; test (`npx tsc --noEmit`, `npx next build`, rules tests); open a PR; the owner clicks Merge.
