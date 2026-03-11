# Notification System

## Overview

Notifications are delivered via REST API and WebSocket (`/notifications` namespace). Each notification contains a `type`, `metadata` (with `event` field), and i18n `translations`. The FE uses **`type`** to select a strategy and **`metadata`** to build navigation links — the BE does not provide pre-built links.

## Response Shape

```json
{
  "id": "uuid",
  "type": "COMMENT",
  "isRead": false,
  "metadata": {
    "event": "POST_COMMENT",
    "postId": 42,
    "commentId": 123
  },
  "senderId": 5,
  "title": "New Comment on Your Post",
  "content": "john_doe commented on your post \"How to solve DP?\".",
  "createdAt": "2026-03-11T10:00:00.000Z"
}
```

- `title` and `content` are resolved server-side based on the user's `preferredLanguage` (EN/VI).
- `senderId` is `null` for self-targeted notifications (e.g. payment success, problem solved).

## Notification Type & Event Reference

| Type         | Event                      | Metadata                                                                                                            |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PAYMENT`    | `PAYMENT_SUCCESS`          | `transactionId: number`                                                                                             |
| `SYSTEM`     | `NEW_PROBLEM_REPORT`       | `reportId: number`, `problemId: number`                                                                             |
| `SUBMISSION` | `PROBLEM_SOLVED`           | `problemId: number`, `problemSlug: string`, `submissionId: number`                                                  |
| `DISCUSS`    | `POST_PUBLISHED`           | `postId: number`                                                                                                    |
| `COMMENT`    | `POST_COMMENT`             | `postId: number`, `commentId: number`                                                                               |
| `REPLY`      | `POST_COMMENT_REPLY`       | `postId: number`, `commentId: number`, `parentCommentId: number`                                                    |
| `COMMENT`    | `SOLUTION_COMMENT`         | `solutionId: number`, `commentId: number`, `problemId: number`                                                      |
| `REPLY`      | `SOLUTION_COMMENT_REPLY`   | `solutionId: number`, `commentId: number`, `parentCommentId: number`, `problemId: number`                           |
| `REPLY`      | `PROBLEM_COMMENT_REPLY`    | `problemId: number`, `commentId: number`, `parentCommentId: number`                                                 |
| `STUDY_PLAN` | `STUDY_PLAN_COMPLETED`     | `studyPlanId: number`, `studyPlanSlug: string`, `totalProblems: number`                                             |
| `STUDY_PLAN` | `STUDY_PLAN_MILESTONE`     | `studyPlanId: number`, `studyPlanSlug: string`, `milestone: number`, `solvedCount: number`, `totalProblems: number` |
| `STUDY_PLAN` | `STUDY_PLAN_DAY_COMPLETED` | `studyPlanId: number`, `studyPlanSlug: string`, `dayNumber: number`, `problemCount: number`                         |
