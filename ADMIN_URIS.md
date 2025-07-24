# Admin Dashboard URIs

This document lists all frontend URIs (React Router paths) for admin functionalities in the quiz platform, along with a brief description for each.

---

| URI                                         | Description                                                      |
|----------------------------------------------|------------------------------------------------------------------|
| `/admin-dashboard`                           | Main dashboard: list all quizzes                                 |
| `/admin-dashboard/quiz/new`                  | Create a new quiz                                                |
| `/admin-dashboard/quiz/:quizId`              | View and edit a specific quiz                                    |
| `/admin-dashboard/quiz/:quizId/stats`        | View live session controls, live participants, and all stats for a quiz |
| `/admin-dashboard/quiz/:quizId/publish`      | (Action) Publish a quiz (typically a button, not a page)         |
| `/admin-dashboard/quiz/:quizId/unpublish`    | (Action) Unpublish a quiz (typically a button, not a page)       |

**Actions (typically buttons, not separate pages):**

- **Publish/Unpublish Quiz:**
  - Actions on `/admin-dashboard/quiz/:quizId` or `/admin-dashboard` to publish or unpublish a quiz. These may correspond to the URIs `/admin-dashboard/quiz/:quizId/publish` and `/admin-dashboard/quiz/:quizId/unpublish`.
- **Start/End Live Session, Next Question:**
  - Controls on `/admin-dashboard/quiz/:quizId/stats` for live quiz management.

---

**Note:**
- All `:quizId` parameters should be replaced with the actual quiz ID.
- These URIs are for frontend navigation; with Firebase, actions are handled via Firestore updates. 