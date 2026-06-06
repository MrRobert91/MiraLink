# External Form Delivery Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every completed form locally, track its Google/Microsoft delivery result, and reuse the same local record on retries.

**Architecture:** SQLite is the source of truth and is written before the external request. The submit endpoint orchestrates local upsert, external delivery, and status update; the frontend retains the returned local identifier for retries and displays delivery status in administration.

**Tech Stack:** FastAPI, Pydantic, SQLite, pytest, React, TypeScript, Vitest, Testing Library.

---

### Task 1: SQLite delivery state and idempotent upsert

**Files:**
- Modify: `backend/app/services/form_responses.py`
- Create: `backend/tests/test_form_responses.py`

- [ ] Write failing tests that open a legacy schema, verify automatic column migration, create a submission, update its external result, and upsert the same identifier without increasing the row count.
- [ ] Run `python -m pytest backend/tests/test_form_responses.py -v` and verify failures are caused by missing status fields and methods.
- [ ] Add guarded SQLite column migrations, make `record_submission` accept an optional identifier, replace answers transactionally on reuse, and add `update_external_status`.
- [ ] Add delivery fields to list, detail, and CSV output.
- [ ] Run `python -m pytest backend/tests/test_form_responses.py -v` and verify all tests pass.

### Task 2: Save-first API orchestration

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] Write failing endpoint tests for successful delivery, provider rejection, provider exception, and retry using the first response's `submission_id`.
- [ ] Run the focused API tests and verify they fail because the current endpoint persists after delivery and returns HTTP errors for exceptions.
- [ ] Extend the request with optional `submission_id`; upsert locally as `pending`, attempt external delivery, update to `sent` or `failed`, and always return the local identifier when persistence succeeded.
- [ ] Run `python -m pytest backend/tests/test_api.py -v` and verify all tests pass.

### Task 3: Frontend retry contract

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/App.tsx`

- [ ] Write a failing API serialization test requiring optional `submission_id` and the expanded response contract.
- [ ] Run `npm.cmd test -- --run src/lib/api.test.ts` from `frontend` and verify the new assertion fails.
- [ ] Add `saved` and `submission_id` response fields, add optional `submission_id` to the payload, retain it in `App`, clear it when loading/resetting a form, and reuse it on retries.
- [ ] Keep the review state after external failure and show the backend's locally-saved message.
- [ ] Run the focused frontend test and verify it passes.

### Task 4: Administrative visibility

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/AdminPanel.tsx`
- Modify: `frontend/src/styles.css`
- Create: `frontend/src/components/AdminPanel.test.tsx`

- [ ] Write failing rendering tests for sent, failed, pending, and historical unknown states.
- [ ] Run the focused component test and verify it fails because no delivery status is rendered.
- [ ] Extend submission types and render an accessible status badge and last external message in expanded detail.
- [ ] Add scoped badge styles without changing unrelated administration layout.
- [ ] Run the focused component test and verify it passes.

### Task 5: Full verification

**Files:**
- Verify all modified files.

- [ ] Run `python -m pytest backend/tests` and confirm zero failures.
- [ ] Run `npm.cmd test` from `frontend` and confirm zero failures.
- [ ] Run `npm.cmd run build` from `frontend` and confirm TypeScript and Vite complete successfully.
- [ ] Review `git diff --check` and `git diff` for accidental or unrelated changes.

