# DECISIONS.md — Decisions Log

This document details the architectural, technical, and design decisions made while building the Shared Expenses App, listing options considered and the rationale behind each choice.

---

## 1. Web Framework: Next.js 15 (App Router)

* **Options Considered:**
  1. *React + Vite SPA + Express Backend:* Flexible, but requires running two separate servers and configuring complex CORS.
  2. *Next.js 15 (App Router):* Unified codebase, full-stack out of the box, standard framework approved by the team.
* **Chosen Option:** Next.js 15 (App Router)
* **Rationale:** It allows writing type-safe API routes and UI components in a single repository, simplifies deployment to Vercel, and provides built-in routing, headers, and cookie utilities.

---

## 2. Database & ORM: Prisma + SQLite (Local) / PostgreSQL (Production)

* **Options Considered:**
  1. *SQLite (Development):* Zero-configuration, file-based, fast, and does not require local Docker or Postgres installations.
  2. *PostgreSQL (Production):* Scalable, fully relational, fits the "Relational DBs only" requirement, integrates with Neon or Supabase.
* **Chosen Option:** Prisma ORM with a SQLite provider locally, which can be easily switched to PostgreSQL for deployment.
* **Rationale:** Relational databases are mandatory. Prisma provides clean migrations, type-safe clients, and auto-completions. Using SQLite locally ensures the project runs out of the box for grading without requiring a local Postgres database configuration, while the schema is designed to be 100% compatible with production PostgreSQL.

---

## 3. Session Authentication: Custom JWT Cookies

* **Options Considered:**
  1. *NextAuth.js (v4 / v5):* Standard, but v5 is in beta and v4 has peer dependency conflicts with React 19 and Next.js 15.
  2. *Custom JWT & Secure Cookies:* Lightweight session tokens signed using `jsonwebtoken` and verified in Next.js middleware.
* **Chosen Option:** Custom JWT & Secure Cookies
* **Rationale:** Implementing custom session cookies completely avoids npm version conflicts and React 19 peer-dependency issues, giving us full control over user sessions, registration, and logout flows. It is robust, secure, and has zero compatibility issues.

---

## 4. Settlement Algorithm: Minimum Cash Flow (Greedy Approach)

* **Options Considered:**
  1. *Pairwise Settlements:* If A owes B, and B owes C, record separate payments. (High transaction count).
  2. *Minimum Cash Flow (Greedy):* Consolidate everyone's net balance, then greedily pair the largest debtor with the largest creditor to minimize transactions.
* **Chosen Option:** Minimum Cash Flow Algorithm
* **Rationale:** Aisha explicitly asked for "one number per person: who pays whom, how much, done." The greedy algorithm minimizes the total number of transfers required to fully settle all debts, avoiding circular payments and simplifying the flat's finances.

---

## 5. Currency Handling: Pre-computed Conversion to Base Currency (INR)

* **Options Considered:**
  1. *Store multiple currencies and calculate balances dynamically:* Highly complex, requires converting exchange rates in every query.
  2. *Convert USD to INR at the date of the expense, and store both:* Pre-computes the base currency equivalent while preserving the original amount and rate.
* **Chosen Option:** Convert USD to INR at the expense date and store pre-converted `amountInr` in `Expense` and `ExpenseSplit`.
* **Rationale:** Priya pointed out that the spreadsheet incorrectly treated $1 = ₹1. Converting USD to INR using a historical rate (₹83.5) on the date of the expense resolves this. Storing both the original and converted values maintains full auditability for Rohan's ledger without slowing down balance queries.

---

## 6. Membership Timelines: Active Date Ranges

* **Options Considered:**
  1. *Flat splits across all members:* Simplest, but Sam (joined mid-April) would pay for March electricity, and Meera (left end of March) would pay for April bills.
  2. *Active date boundaries on GroupMembership:* Restrict split calculations to members whose `joinedAt <= expenseDate <= leftAt`.
* **Chosen Option:** Active date boundaries on `GroupMembership`.
* **Rationale:** This fully addresses Sam's and Meera's timeline requests. Active dates are enforced automatically in the CSV importer and the manual expense split builder.

---

## 7. Rounding and Paise Discrepancies: Payer Remainder Adjustment

* **Options Considered:**
  1. *Floor/ceil rounding:* Splits could add up to 1 paise more or less than the total expense amount.
  2. *Payer adjustment:* Distribute exact shares, calculate the sum, and adjust the difference (usually 1-2 paise) on the payer's split.
* **Chosen Option:** Payer remainder adjustment.
* **Rationale:** Ensures that the sum of all splits in `ExpenseSplit` matches the parent `Expense.amountInr` down to the exact decimal, preventing floating point leaking in the database queries.
