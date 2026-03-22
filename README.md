# Civ

Civ is a browser-based 4X strategy game prototype with a TypeScript frontend and a WebSocket multiplayer backend. The project is focused on building the core loop of exploration, expansion, city growth, unit control, and turn-based play in a lightweight web stack.

This repository has been, if not 100% AI generated, almost 100% AI generated.

## Project Goals

- Build a playable 4X strategy experience in the browser.
- Support both single-player and multiplayer game modes.
- Keep game rules and shared types aligned across frontend and backend.
- Provide a foundation for AI opponents, persistence, matchmaking, and account-based play.

## Current Scope

The repository already includes:

- A frontend game client rendered in the browser.
- A backend WebSocket server for multiplayer sessions and room management.
- Shared game and network types used by both applications.
- Systems for map chunks, unit and city state, AI behavior, UI flows, persistence, and authentication-related frontend APIs.

## Repository Layout

- `frontend/`: Vite-based browser client, game engine, rendering, input, UI, networking, and API routes.
- `backend/`: TypeScript WebSocket server, room lifecycle, syncing, player management, validation, and AI orchestration.
- `shared/`: Shared type definitions for game state, units, cities, map chunks, and network messages.

## Running Locally

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

Default local endpoints:

- Frontend: `http://localhost:5173`
- Backend: `ws://localhost:8080`

## Why This Repo Exists

This project is intended to be a practical foundation for iterating on a modern, web-based civilization-style strategy game. The codebase is organized so gameplay systems, networking, and shared rules can evolve together without duplicating core game concepts across the stack.