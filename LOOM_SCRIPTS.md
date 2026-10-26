# Loom Video Scripts & Recording Guide

This document provides a minute-by-minute, word-for-word guide for recording the two required Loom videos for the SDET assignment.

---

## 📹 Loom 1: Code Walkthrough (Duration: 5–7 Minutes)

### Screen Setup Before Recording:
- Open VS Code / IDE with the `wellfound-jest` project open.
- Keep the project explorer on the left expanded showing `tests/`, `controllers/`, `helpers/`, `app.ts`.
- Have `tests/e2e/workflow.test.ts` and `tests/helpers/dbHandler.ts` open in tabs.

---

### Minute-by-Minute Script:

#### 0:00 – 1:00 | Introduction & Architectural Overview
> *"Hello Priyanshu, Krishna, Saud, and the engineering team! My name is Prathamesh Taware. In this video, I will walk you through my Jest-based automated testing suite for the Salon Booking Backend API.*
>
> *Before jumping into individual test files, I’d like to highlight a key architectural decision: In the original codebase, `app.listen()` was directly invoked inside `index.ts`. To make this suite enterprise-grade and test-friendly, I decoupled the Express application into `app.ts` and kept the server listener in `index.ts`. This allows Supertest to inject HTTP requests directly into the Express pipeline in-memory, eliminating port collisions, background process dependencies, and network latency."*

#### 1:00 – 2:15 | Zero-Friction Test Infrastructure & Helpers (`tests/helpers/`)
*(Click into `tests/helpers/dbHandler.ts`)*
> *"One of my primary goals as an SDET is ensuring tests are completely hermetic, isolated, and zero-friction. I implemented `mongodb-memory-server` in `dbHandler.ts`.*
>
> *In `tests/setup.ts`, `beforeAll` spins up an in-memory MongoDB instance. After each test (`afterEach`), `clearDB()` truncates all collections. This guarantees 100% test independence—no test ever fails due to leftover state from a previous run. And most importantly: anyone can clone this repository, run `npm test`, and the tests pass immediately without needing a local MongoDB daemon or Docker container.*
>
> *(Click into `tests/helpers/authHelper.ts` and `testData.ts`)*
> *In `authHelper.ts` and `testData.ts`, I created DRY factory functions for users, salons, services, and bookings, alongside a helper that signs valid JWT tokens for Customer, Stylist, and Admin roles."*

#### 2:15 – 3:45 | Deep Dive into the 5 APIs & Test Coverage
*(Click into `tests/api/auth.test.ts`)*
> *"Let's look at how the 5 required APIs are automated:*
>
> 1. *`POST /api/register` & `POST /api/login` (`tests/api/auth.test.ts`): We test successful registration, bcrypt password hashing verification in the DB, duplicate email rejection (400), and missing required fields (500). For login, we validate JWT token issuance, payload integrity (`userId`, `role`), and invalid password/email rejection.*
>
> 2. *(Click into `tests/api/salon.test.ts`)* *`GET /api/salons/:salonId/available-slots`: Here we test business logic: slots are computed in 30-minute intervals within opening hours. We test duration calculation—for a 60-minute service, the latest slot stops earlier. We also verify that when Stylist A is booked, only Stylist A is removed from that slot while Stylist B remains available.*
>
> 3. *(Click into `tests/api/booking.test.ts`)* *`POST /api/bookings`: Beyond basic booking creation, we thoroughly test concurrency and conflict prevention: double booking prevention on the exact same slot, overlapping duration conflicts (a 60-minute booking blocking a 30-minute slot), and multi-stylist booking at the same hour.*
>
> 4. *(Click into `tests/api/cancel.test.ts`)* *`POST /api/bookings/:bookingId/cancel`: Here we test critical authorization and security rules: Customer ownership enforcement (IDOR protection)—Customer B cannot cancel Customer A's booking (403 Forbidden). We also test Admin override—an Admin can cancel any booking—and idempotency where cancelling an already cancelled booking returns 400."*

#### 3:45 – 5:30 | Mandatory E2E Workflow (`tests/e2e/workflow.test.ts`)
*(Click into `tests/e2e/workflow.test.ts`)*
> *"Now let's examine the mandatory End-to-End user journey in `workflow.test.ts`.*
>
> *This single orchestrated test models a real-world customer journey across 10 distinct verification steps:*
> - *Step 1: Customer registers (`POST /api/register`).*
> - *Step 2: Customer logs in (`POST /api/login`) and extracts the Bearer JWT token.*
> - *Step 3: Customer queries available slots (`GET /api/salons/:id/available-slots`) and confirms the 10:00 AM slot is open.*
> - *Step 4: Customer books the 10:00 AM slot (`POST /api/bookings`), validating status 201 and calculated end time 10:30.*
> - *Step 5: Business Rule Verification: Query slots again to verify that 10:00 AM is now REMOVED from availability.*
> - *Step 6: Negative verification: Attempting a duplicate booking returns 400.*
> - *Step 7: Security check: A rogue customer token attempts to cancel the booking, asserting 403 Forbidden.*
> - *Step 8: Authorized customer cancels the booking (`POST /api/bookings/:id/cancel`), receiving 200.*
> - *Step 9: State restoration: Querying slots again confirms the 10:00 AM slot is restored and available again!*
> - *Step 10: Idempotency check: Re-attempting to cancel returns 400."*

#### 5:30 – 6:30 | Design Decisions & Trade-Offs & Conclusion
> *"To summarize our design trade-offs:*
> - *In-Memory DB vs Live DB: Using in-memory Mongo makes CI/CD fast and eliminates flaky network calls, while still allowing an external `MONGO_URI` if needed.*
> - *Supertest vs Axios/fetch: Supertest directly tests the Express router without socket port overhead, making the entire suite run in under 35 seconds.*
>
> *Thank you for your time, and please check out Loom 2 for the live test execution!"*

---

## 📹 Loom 2: Test Execution (Duration: 3–5 Minutes)

### Screen Setup Before Recording:
- Have a clean terminal window open inside the `wellfound-jest` folder.
- Split screen or have your IDE side-by-side with the terminal.

---

### Minute-by-Minute Script:

#### 0:00 – 0:45 | Introduction & Environment Check
> *"Hello again! In this video, I will execute the Jest automated test suite live from scratch, show the test results, run the E2E workflow, and walk through our code coverage report.*
>
> *First, let's verify our environment:*
*(Type and run)*
```bash
node -v
npm -v
```
> *"We are on Node v24 (also compatible with Node 18 and 20), and npm is ready. All dependencies are installed."*

#### 0:45 – 2:00 | Executing the Full Test Suite (`npm test`)
*(Type and run)*
```bash
npm test
```
> *(While tests are running)*
> *"Here we are running `npm test`, which executes Jest across all 5 test suites sequentially using `--runInBand` and `--forceExit`.*
>
> *Notice how fast each test suite spins up its own isolated database instance, executes positive and negative assertions, and cleans up.*
>
> *(When it finishes)*
> *And look at that: 5 test suites passed! 39 tests passed out of 39! Zero failures.*
> - *`auth.test.ts`: 12 tests passed.*
> - *`salon.test.ts`: 10 tests passed.*
> - *`booking.test.ts`: 8 tests passed.*
> - *`cancel.test.ts`: 8 tests passed.*
> - *`workflow.test.ts`: Full E2E user lifecycle passed!"*

#### 2:00 – 3:15 | Executing the Mandatory E2E Workflow (`npm run test:e2e`)
*(Type and run)*
```bash
npm run test:e2e
```
> *"Let's isolate and run just the mandatory E2E workflow using `npm run test:e2e`.*
>
> *(Wait for completion, ~8 seconds)*
> *Here we see the full end-to-end journey: Register -> Login -> Slot Discovery -> Booking -> Conflict Verification -> Authorization Enforcement -> Cancellation -> Slot Restoration. It executed in just 8 seconds with 100% assertion pass rate."*

#### 3:15 – 4:30 | Generating Code Coverage Report (`npm run test:coverage`)
*(Type and run)*
```bash
npm run test:coverage
```
> *(When table appears on screen)*
> *"Now let's examine the test coverage report generated by Jest.*
>
> *As you can see on the screen:*
> - *Overall statements: 98.05%*
> - *Branch coverage: 93.54%*
> - *Function coverage: 100%*
> - *Lines coverage: 98.01%*
>
> *Every controller, route, and model has between 96% and 100% coverage, with `salonController` and all models at a full 100%.*
>
> *The suite is thoroughly documented in `README.md` with complete setup instructions. Thank you so much for reviewing my assignment! I look forward to your feedback."*
