# Quad

Canvas LMS power-ups for students, delivered as a **bookmarklet** so no browser extension is needed.
It works on school laptops that block extensions, and in any browser with a bookmarks bar.

- **To-do list**: everything due in the next 7/14/30 days, grouped by day, overdue work first. Checking an item off marks it done in your Canvas planner.
- **Grades**: current score and letter for each class, plus a grade badge on every dashboard card.
- **GPA calculator**: weighted and unweighted, 4.0 scale, with per-class credits and Honors/AP levels.
- **Dark mode** and an option to hide dashboard card images.

## Install

1. Open `index.html` (or the hosted install page) in your browser.
2. Show the bookmarks bar (`Ctrl+Shift+B`, or `Cmd+Shift+B` on a Mac).
3. Drag the yellow **Quad** button onto the bar.
4. Go to Canvas and click **Quad**. Click it again to hide the panel.

Can't drag? Copy the contents of `dist/bookmarklet.txt`, create a new bookmark, and paste it in as the URL.

## How it works

Quad runs inside your Canvas tab and calls the Canvas REST API on the same site with your existing login
(`/api/v1/courses`, `/api/v1/planner/items`, `/api/v1/users/self/colors`, and `/api/v1/planner/overrides` to mark items done).
It has no server and sends nothing anywhere else. Settings are kept in `localStorage` for that Canvas site.

Because a bookmarklet only runs when clicked, you need to click it once per page load to re-apply dark mode and card grades.
Some managed Chromebooks block `javascript:` bookmarks as well.

## Develop

```bash
npm install
npm run build   # minifies src/quad.js, writes dist/ and index.html
npm test        # runs the bookmarklet against a mocked Canvas page in headless Chromium
```

Source lives in `src/quad.js` (the bookmarklet) and `src/install.html` (the install page template).

Quad is an independent tool and is not affiliated with Instructure.
