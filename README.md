# Spy Room — Multiplayer Game

A real-time 2–8 player browser game built with Node.js, Express and Socket.IO.

## Run locally
1. Install Node.js 18+.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Deploy
Deploy this repository to a Node-capable host such as Render, Railway, Fly.io, or a VPS. Use the start command `npm start`. The app listens on `process.env.PORT`.

## Game rules
- 3–8 players join a room with a code.
- Host starts a round.
- One player is secretly the Spy.
- Other players receive a topic and question.
- Players discuss for 60 seconds.
- Everyone votes for the suspected Spy.
- If the Spy is not identified, the Spy wins. If identified, the Spy gets one final chance to guess the topic; a correct guess lets the Spy win, otherwise the players win.
- The host can start another round.
