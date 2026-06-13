# Shared Expenses Application

A full-stack Next.js 15 application designed to manage shared flat expenses, track individual timelines, convert USD trip expenses, detect duplicate entries, and calculate optimized payments.

This project was built to solve shared expense tracking for flat mates **Aisha**, **Rohan**, **Priya**, **Meera**, and **Sam**.

---

## 🚀 Quick Start & Setup

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory (or use the seeded default `.env`):
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="super-secret-key-change-this-in-production"
PORT=3000
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Run Database Migrations & Seeding
Deploy migrations to initialize the SQLite database and seed the flat mates:
```bash
npx prisma migrate dev --name init
```
This automatically registers the 6 flat mates (Aisha, Rohan, Priya, Meera, Dev, Sam) with their correct timeline join/leave dates, and sets their default login passwords to `password123`.

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Tech Stack & Architecture

- **Framework:** Next.js 15 (App Router)
- **Database:** SQLite (Relational local database)
- **ORM:** Prisma
- **Auth:** Custom JWT HTTP-Only Cookies
- **Styling:** Tailwind CSS + custom glassmorphism components
- **Parsing:** Papa Parse (CSV reader)

---

## 💎 Features & Flat Mate Solutions

1. **Aisha ("One number per person")**
   - Implements the **Minimum Cash Flow (Greedy) Algorithm** under the "Settlements" tab to reduce complex group debts to the absolute minimum required transfers.

2. **Rohan ("No magic numbers")**
   - Under the "Balances" tab, clicking any member opens their **detailed ledger ledger history** showing exact credit/debit math behind every rupee they owe.

3. **Priya ("Trip in USD conversion")**
   - Ingests USD trip expenses, parses dollar prefixes (`$`), and converts them to INR using historical exchange rates (default `83.50`) on the date of the expense.

4. **Sam & Meera ("Membership timeline tracking")**
   - Restricts expense splits to active members on the `ExpenseDate` using `joinedAt` and `leftAt` dates. Sam (joined Apr 15) is excluded from March bills; Meera (left Mar 31) is excluded from April/May bills.

5. **Meera ("Approve changes / deduplication")**
   - The CSV import wizard lists duplicates, format mismatches, and negative amounts with individual **Approve / Skip** review controls before committing to the DB.

---

## 🤖 AI Collaborative Partner

This application was designed and coded in collaboration with **Antigravity**, an agentic AI coding assistant from Google DeepMind.
See [AI_USAGE.md](file:///Users/msr/Documents/test/AI_USAGE.md) for prompts and failure resolution details.
