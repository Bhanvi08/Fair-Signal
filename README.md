# FairSignal

**Movement is a signal to ask, not a reason to accuse.**

FairSignal is a frontend concept prototype for a candidate-first context step in remote assessments. It explores a simple idea: when an ordinary movement is noticed, invite the candidate to explain what happened and show that context alongside the timestamped event before a human reviewer evaluates it.

> **Prototype status:** this is an experimental demonstration, not a validated proctoring product or a cheating detector. Movement cues can be wrong. They must not determine guilt, eligibility, or an assessment outcome.

- **Live demo:** [FairSignal prototype](https://ais-dev-bfehuu5hejuh7drwvtlet5-496679207933.asia-southeast1.run.app/)

- **Source:** [Bhanvi08/Fair-Signal](https://github.com/Bhanvi08/Fair-Signal)

## The candidate-first flow

1. The candidate opens the demo and chooses **Start camera** before the browser requests camera access.

1. The browser shows a live preview and can produce an experimental movement cue. If camera or model access is unavailable, the sample-scenario buttons demonstrate the same interaction without camera access.

1. The candidate can confirm or change a category, add a note, or choose **Prefer not to say**. A candidate’s silence is not treated as guilt.

1. The event and any candidate context appear together in the reviewer view. A human reviewer can record a non-violation, ask a follow-up, or escalate for further human review.

The reviewer screen begins with clearly presented sample data so the flow can be explored without starting the camera.

## What the prototype contains

- A consent-led webcam preview using the browser’s `getUserMedia` API. Audio is not requested.

- Experimental client-side movement cues using MediaPipe Face Landmarker and a small canvas-based frame-difference fallback.

- Explicitly labeled sample scenarios for stretching, getting water, sneezing, and other movement.

- Candidate context attached to timestamped events, with a separate reviewer timeline and human-only actions.

- In-memory demo state with a reset control. There is no application backend, login, or persistent event database in this prototype.

## Run locally

### Requirements

- Node.js **20.19+** or **22.12+**

- npm

- A modern browser for the webcam demo

### Install and start

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. This project configures the development server at `http://localhost:3000/` by default. Keep the terminal running while you use the app.

To check the production build and TypeScript types:

```bash
npm run build
npm run lint
```

The current frontend does not require a Gemini API key or an `.env.local` file to run. The `.env.example` file is leftover AI Studio scaffolding and is not needed by the present app code.

### Camera access

Camera permission is requested only after the candidate presses **Start camera**. `localhost` is treated as a secure context by modern browsers; a deployed site must use HTTPS. If the page is embedded in another site or workspace and camera permission is blocked, open the app’s direct URL in a normal browser tab, allow camera access in the browser’s site settings, reload, and try again. Sample scenarios remain available without a camera.

## Privacy and data boundaries

The app processes camera frames in the browser and does not send or save the webcam video through an application backend. Candidate events and notes live in frontend state for the current demo session and are cleared when the app is reset or reloaded.

When camera mode starts, the browser downloads the MediaPipe runtime and face-landmark model from jsDelivr and Google Cloud Storage. These are model/runtime assets, not uploads of the candidate’s camera feed. The app also requests camera access from the browser only after the candidate’s click.

This is a prototype-level behavior description, not a production privacy guarantee. A real assessment deployment would need independently reviewed privacy and security controls, clear consent, a retention policy, accessibility alternatives, and candidate/provider testing.

## Technical notes

- **UI:** React, TypeScript, Vite, Tailwind CSS

- **Vision:** `@mediapipe/tasks-vision`

- **Structure:** `src/App.tsx` coordinates the candidate and reviewer views; `src/components/CandidateDemo.tsx` implements the camera/context flow; `src/components/ReviewerView.tsx` displays the event queue; `src/utils/faceLandmarks.ts` loads the browser vision task; `src/utils/motionClassifier.ts` contains experimental movement heuristics.

The movement labels are heuristic cues, not reliable interpretations of intent. Camera angle, lighting, motion outside the face, and ordinary posture changes can affect them. The prototype does not establish whether misconduct occurred and should not be used to make real assessment decisions.


