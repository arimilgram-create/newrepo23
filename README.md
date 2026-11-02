# Quad

Canvas LMS power-ups for students, delivered as a **bookmarklet**, so no browser extension is needed.
It works on school laptops that block extensions, and in any browser with a bookmarks bar.

## Features

**Make Canvas yours**
- 12 one-click themes (sidebar color, accent color, font, optional card palette)
- Dark mode: on, match device, or scheduled; Dim / Dark / Black levels
- Course card palettes saved to your Canvas account; per-course colors and nicknames
- Card styles (pictures, solid, gradient), custom card pictures, compact cards, corner rounding
- 11 fonts, full-width layout, hide the school logo and "Recent Feedback"

**Never miss work**
- To-do list grouped by day, overdue first, with a course filter; checking items off syncs with the Canvas planner
- Upcoming work listed on each dashboard card
- Quad's to-do (and optional notes) in the dashboard sidebar, replacing Canvas's
- Add and delete your own to-dos (Canvas planner notes)
- Due-soon reminders and desktop notifications
- `.ics` export for Google Calendar, Apple Calendar or Outlook

**Know where you stand**
- Grades on every card and in a list, with changes since you last looked
- GPA: unweighted, weighted and cumulative; three scales; credits, Honors/AP levels and what-if grades
- Final exam calculator

**Move faster**
- `Ctrl/Cmd + K` search for any course page, assignment or Quad action; `Alt + Q` toggles the panel
- Study timer (focus/break sessions)
- **Stay on** mode: Canvas runs in a full-window frame under Quad so it keeps working as you browse
- Settings backup and restore

## Install

1. Open `index.html` (or the hosted install page) in your browser.
2. Show the bookmarks bar (`Ctrl+Shift+B`, or `Cmd+Shift+B` on a Mac).
3. Drag the yellow **Quad** button onto the bar.
4. Go to Canvas and click **Quad**. Click it again to hide the panel.

Can't drag? Copy the contents of `dist/bookmarklet.txt`, create a new bookmark, and paste it in as the URL.

## How it works

Quad runs inside your Canvas tab and calls the Canvas REST API on the same site with your existing login.
It has no server and sends nothing anywhere else. Settings are kept in `localStorage` for that Canvas site.

| Feature | Canvas API |
| --- | --- |
| Courses, grades, nicknames | `GET /api/v1/courses`, `PUT/DELETE /api/v1/users/self/course_nicknames/:id` |
| Course colors | `GET /api/v1/users/self/colors`, `PUT /api/v1/users/self/colors/course_:id` |
| To-do | `GET /api/v1/planner/items`, `POST/PUT /api/v1/planner/overrides`, `POST/DELETE /api/v1/planner_notes` |

A bookmarklet only runs when clicked. Without Stay on, click it once per page load. Some managed Chromebooks block
`javascript:` bookmarks as well.

## Develop

```bash
npm install
npm run build   # bundles src/ with esbuild into dist/ and writes index.html
npm test        # unit tests + end-to-end run against a mocked Canvas in headless Chromium
```

| Path | What it is |
| --- | --- |
| `src/main.js` | Entry point |
| `src/page.js`, `src/styles/page.css` | Changes to Canvas pages: theme, dark mode, cards, sidebar |
| `src/panel.js`, `src/views.js`, `src/actions.js`, `src/styles/panel.css` | The Quad panel |
| `src/data.js`, `src/api.js` | Canvas API calls and derived data |
| `src/gpa.js` | Grade and GPA math |
| `src/palette.js`, `src/timer.js`, `src/reminders.js`, `src/stayon.js` | Search, timer, reminders, stay-on mode |
| `src/install.html` | Install page template |

Quad is an independent tool and is not affiliated with Instructure.
