# Homeroom

A Chrome extension that gives Canvas a clean, card-based classroom layout: class cards, a Stream,
Classwork organized by topic, People, a To-do list and a Calendar. Your classes, assignments and grades
all come straight from Canvas.

![Home](screenshots/1-home.png)

| Stream | Classwork | Assignment |
| --- | --- | --- |
| ![Stream](screenshots/3-stream.png) | ![Classwork](screenshots/4-classwork.png) | ![Assignment](screenshots/7-assignment.png) |
| **To-do** | **Calendar** | **Dark theme** |
| ![To-do](screenshots/8-todo.png) | ![Calendar](screenshots/9-calendar.png) | ![Dark](screenshots/10-home-dark.png) |

## What it does

- **Home**: a card for every class on your Canvas dashboard, with a banner drawn for its subject, the teacher,
  and what's due next. Change a class's color from the card's menu (saved to Canvas).
- **Stream**: announcements and new assignments, newest first, with an Upcoming box.
- **Classwork**: modules shown as topics, with a topic list to jump around. Expand any item for details.
  Classes without modules are grouped by assignment group.
- **People**: teachers and classmates.
- **Grades** ("Your work"): every assignment with its status and score, filters for Assigned, Returned and Missing, and your overall grade.
- **Assignment page**: instructions, then a **Your work** card where you can add a file, link or text and **Turn in**,
  or **Mark as done** for work with nothing to hand in. **Private comments** to your teacher.
- **To-do**: Assigned, Missing and Done across all classes, grouped by week, with a class filter.
- **Calendar**: a week view of everything due, color-coded by class.
- Light and dark themes, phone-friendly layout, and the browser back button works throughout.

Anything Homeroom doesn't redo (quizzes, discussions, files, inbox and so on) opens in regular Canvas
with a **Back to Homeroom** button in the corner. Every Homeroom page also has an **Open in Canvas** button.

## Install

1. Download [`homeroom.zip`](homeroom.zip) and unzip it, or use the `extension/` folder from this repo.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder.
4. Open your Canvas site.

Homeroom runs automatically on `*.instructure.com`. If your school's Canvas has its own address
(like `canvas.myschool.edu`), open it, click the Homeroom icon in the toolbar and choose **Use Homeroom on this site**.

To switch back to plain Canvas, use the account menu (top right) › **Turn off Homeroom**, or the toolbar icon.

> School-managed Chromebooks often block Developer mode and unpacked extensions. If **Load unpacked** is missing,
> Homeroom would need to be published on the Chrome Web Store and allowed by your school.

## How it works

On the pages it redoes, the content script replaces Canvas's page before Canvas's own scripts run and draws Homeroom
instead, using the Canvas REST API with your existing login. Nothing is sent anywhere except your school's Canvas.

| Data | Canvas API |
| --- | --- |
| Classes, teachers, grades, colors | `/api/v1/courses`, `/api/v1/dashboard/dashboard_cards`, `/api/v1/users/self/colors` |
| Stream | `/api/v1/announcements`, `/api/v1/courses/:id/assignments` |
| Classwork | `/api/v1/courses/:id/modules`, `/api/v1/courses/:id/assignment_groups` |
| People | `/api/v1/courses/:id/users` |
| To-do, Calendar | `/api/v1/courses/:id/assignments?include[]=submission`, `/api/v1/planner/items` |
| Turn in, comments, mark as done | `/api/v1/courses/:id/assignments/:id/submissions`, `/submissions/self/files`, `/api/v1/planner/overrides` |

## Develop

```bash
npm install
npm run build   # bundles src/ into extension/ and homeroom.zip
npm test        # loads the extension in Chromium against a mock Canvas and clicks through every page
```

| Path | What it is |
| --- | --- |
| `src/content/main.js` | Decides whether to take over a page or add the Back to Homeroom button |
| `src/content/app.js` | App shell: top bar, menu, routing, events |
| `src/content/views/` | One file per page |
| `src/content/data.js`, `src/content/api.js` | Canvas API calls with a quick cache |
| `src/content/ui.js` | Icons, avatars, generated class banners, dates |
| `src/popup/` | Toolbar popup |

The name, logo, icons and banner art are original to Homeroom. Homeroom isn't affiliated with Instructure or Google.
