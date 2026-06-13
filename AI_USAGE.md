# AI_USAGE.md — AI Usage Log

This document lists the AI tools used, key prompts, and three concrete cases where the AI generated code that was incorrect, how we caught it, and what we changed.

---

## 1. AI Tools & Key Prompts

* **Primary AI Collaborator:** Antigravity (Powered by Google Gemini 3.5 Flash / Claude Opus)
* **Key Prompts Used:**
  1. *"create a next js app, and these are the keys that we have to follow strictly... create an indepth detailed plan firstly covering all these ,for implementation with system desgn and structure as well."*
  2. *"Create the CSV parsing and anomaly detection engine with strict rules for validation and membership."*
  3. *"Create balance calculation and ledger history engine for Rohan's requirement."*
  4. *"Create settlement optimizer using the Minimum Cash Flow algorithm for Aisha's requirement."*

---

## 2. Concrete AI Failure Cases

### Case 1: Prisma v7 Datasource Deprecation
* **AI Code Generated:** The AI generated a standard `schema.prisma` file containing:
  ```prisma
  datasource db {
    provider = "sqlite"
    url      = env("DATABASE_URL")
  }
  ```
* **How It Was Caught:** When running `npx prisma migrate dev --name init`, the command crashed with the following error:
  `Error: The datasource property 'url' is no longer supported in schema files. Move connection URLs to prisma.config.ts...`
* **What Was Changed:** We realized the template had pulled Prisma v7.8.0, which has breaking changes regarding datasource urls. Instead of setting up the complex Prisma 7 config files, we programmatically downgraded prisma and `@prisma/client` to version 6 (`npm install @prisma/client@6 prisma@6`), which natively supports traditional env variables inside the schema. This fixed the migration immediately.

### Case 2: NextAuth.js Peer Dependency Warnings on React 19
* **AI Code Generated:** The AI originally suggested using `NextAuth.js` with the credentials provider for login management.
* **How It Was Caught:** During installation of dependencies, npm surfaced severe peer dependency conflicts because `NextAuth.js` v4 is not fully compatible with React 19 (installed by default in Next.js 15), and NextAuth v5 is still in beta.
* **What Was Changed:** Rather than using `--legacy-peer-deps` to force a potentially buggy auth package on React 19, we decided to implement a custom session authentication helper in `src/lib/auth.ts` using `jsonwebtoken` and `bcrypt` with HTTP-only secure cookies. This simplified the setup, had zero package dependencies conflicts, and worked out of the box.

### Case 3: Floating Point Paise Rounding Discrepancy
* **AI Code Generated:** The AI generated split calculation math dividing the total expense amount equally by the number of active members, storing the raw floating point values directly:
  ```typescript
  const share = amount / activeMembers.length;
  ```
* **How It Was Caught:** During testing, we noticed that splitting an expense of ₹1,000 between 3 members resulted in each member owing ₹333.3333333333333. When summing these up in the database queries, the total was ₹999.9999999999999, which didn't match the parent expense of ₹1,000 exactly, causing minor cents/paise leaks in balances.
* **What Was Changed:** We updated the split logic to round each member's split to 2 decimal places using `parseFloat(share.toFixed(2))`. We also added a rounding adjustment phase: the sum of the rounded splits is subtracted from the total, and any remaining difference (e.g. 1 paise) is added to the payer's split to keep the database ledger perfectly balanced.
