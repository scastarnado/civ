# Contributing Guidelines

Thank you for contributing to Civ. This repository is a browser-based 4X strategy game prototype with separate frontend and backend applications plus shared game types. These guidelines are here to make issues, pull requests, and code changes easier to review and maintain.

## Before You Contribute

Please make sure you:

- Read the project overview in the README.
- Review the Code of Conduct before participating in discussions or reviews.
- Check existing issues and pull requests before opening a new one.
- Keep changes focused on a single problem or feature when possible.

## Ways To Contribute

You can help by:

- Reporting bugs with clear reproduction steps.
- Suggesting gameplay, UI, networking, or developer-experience improvements.
- Fixing bugs.
- Improving documentation.
- Submitting focused features that fit the project goals.

## Reporting Issues

When opening an issue, include as much of the following as possible:

- A short, specific summary of the problem or request.
- Steps to reproduce the issue.
- Expected behavior.
- Actual behavior.
- Screenshots, logs, or error messages if relevant.
- Whether the issue is in the frontend, backend, or shared types.

If the issue is gameplay-related, include the game mode, current turn or state, and what action triggered the problem.

## Setting Up Locally

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

Type-checking:

```bash
cd frontend
npm run type-check

cd ../backend
npm run type-check
```

Default local endpoints:

- Frontend: `http://localhost:5173`
- Backend: `ws://localhost:8080`

## Pull Request Guidelines

Before opening a pull request:

- Keep the branch focused on one change set.
- Make sure the change is understandable without unrelated cleanup.
- Run the relevant type-check or build steps for the parts you changed.
- Update documentation when behavior, setup, or project expectations change.

In your pull request, include:

- A short explanation of what changed.
- Why the change was needed.
- Any tradeoffs or limitations.
- Testing notes describing what you ran or verified.

## Project-Specific Notes

- Changes that affect shared game rules or network payloads should stay aligned across `frontend/`, `backend/`, and `shared/`.
- The frontend contains parallel `.ts`, `.js`, and `.d.ts` files in several source folders. If you make a behavior-affecting frontend change, keep the corresponding files in sync.
- Avoid broad refactors unless they are necessary for the task.
- Prefer small, reviewable changes over large mixed updates.

## Style Expectations

- Follow the existing code style in each part of the repository.
- Preserve existing naming and structure unless there is a strong reason to change it.
- Add comments only when they clarify non-obvious logic.
- Do not include unrelated formatting-only changes in feature or bug-fix pull requests.

## Community Standards

By participating in this project, you agree to follow the standards described in the Code of Conduct.
