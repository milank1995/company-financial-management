# Private Company Financial Management Web Application Documentation

This document provides a comprehensive overview of the design, features, accounting logic, and database architecture of the Company Financial Management Web Application.

---

## 1. System Overview & Architecture

The application is built as a secure, private, multi-company financial tracking platform using **Next.js (App Router)**, **TypeScript**, **Tailwind CSS (v4)**, and **Supabase PostgreSQL** with **Prisma ORM**.

Key architectural characteristics include:
* **Multi-Company Separation**: All core business and financial entities contain a `companyId` foreign key. Query isolation guarantees that users can only view or modify records belonging to their registered company.
* **Cascading Delete Prevention**: Financial transaction records are never deleted automatically. The database uses `onDelete: Restrict` to protect accounting history. When primary entities (partners, employees, or projects) are deactivated, they are soft-deleted or marked as inactive, preserving their historical transaction logs.
* **Soft-Delete Architecture**: Transactions contain nullable `deletedAt` and `deletedBy` fields. When a record is deleted, it is marked with the current timestamp and user ID. All report calculators and filters automatically exclude soft-deleted items.
* **Precise Math Handling**: PostgreSQL `Decimal(15,2)` is used for all monetary fields, and `Decimal(7,4)` is used for ownership percentages to prevent floating-point rounding errors.

---

## 2. Core Modules & Functionality

### A. Authentication & Session Management
* **Credentials Flow**: Users register their company and login credentials. Passwords are securely hashed using `bcryptjs`.
* **State Protection**: Sessions are governed by signed JWTs stored in HTTP-only, secure cookies, preventing client-side scripting attacks.
* **API Guards**: A central authentication middleware checks route eligibility and returns `401 Unauthorized` for expired or missing tokens.

### B. Partners & Ownership Setup
* **Partners Directory**: Allows adding and managing partners. Partners can be marked as inactive, which prevents them from receiving future payouts or payments without affecting past entries.
* **Ownership Setup**:
  * Partners own specific percentages of the company.
  * To support changing ownership setups, the system uses an effective-date model (`effectiveDate`).
  * The active ownership percentages for any month are resolved using the latest setup whose `effectiveDate` is less than or equal to the selected month's start date.
  * **Validation Rule**: A setup can only be saved and activated if the sum of all partner percentages equals exactly `1.0000` (100%).

### C. Projects & Payments
* **Project Directory**: Tracks client projects, contract budgets, and status (Active/Archived).
* **Payment Inflows**: Records payments made by clients. Each payment tracks:
  * Payment Date
  * Client Name
  * Project ID
  * **Recipient Partner**: The partner who received the funds. This is tracked as company money held by the partner.

### D. Employees & Salaries
* **Staff Directory**: Configures active employees, email, role, and status.
* **Multi-Source Salary Payments**: Supports three distinct payment channels:
  1. `COMPANY`: Paid directly out of company accounts.
  2. `PARTNER`: Paid personally by a partner.
  3. `CLIENT_DIRECT`: Paid directly by a client to the employee. It supports two sub-scenarios:
     * *Direct to Partner Account*: The client pays the salary to a partner's personal account. The amount is recorded as company money held by that partner.
     * *Direct to Employee*: The client pays the employee directly. It does not affect partner settlements.

### E. Company Expenses
* **Expense Log**: Tracks operational costs (Office, Software, Travel, Utility, Marketing, Consulting, etc.).
* **Paid By Partner**: Every company expense is tracked by which partner paid it personally, becoming a credit in their monthly settlement.

### F. Partner Adjustments
* **Ledger Entries**: Tracks transactions that modify partner balances but are not regular expenses or profits:
  * **Credits**: Loans from partners, capital injections.
  * **Debits**: Personal withdrawals, loan repayments, capital drawdowns.

---

## 3. Financial & Accounting Logic

### A. Core Calculation Formulas
* **Total Salary Expense** = `COMPANY` + `PARTNER` + `CLIENT_DIRECT` salary transactions.
* **Net Profit** = `Total Project Income` - `Total Salary Expense` - `Total Company Expenses`.
* **Profit Share** (per partner) = `Net Profit` × `Partner Ownership Percentage` (active for that month).

### B. Partner Settlement Calculation
The settlement balance determines whether the company owes the partner (Receivable) or the partner owes the company (Payable).

$$\text{Final Settlement} = \text{Profit Share} + \text{Salaries Paid Personally} + \text{Expenses Paid Personally} + \text{Adjustments (Credits - Debits)} - \text{Total Company Money Received}$$

Where:
* **Salaries Paid Personally**: Sum of salaries where `paymentSource = PARTNER` and `partnerId = partner`.
* **Expenses Paid Personally**: Sum of company expenses paid personally by the partner.
* **Adjustments**: Net adjustments (Credits - Debits).
* **Total Company Money Received**: The sum of:
  1. *Project Income Received*: Client payments received by the partner.
  2. *Salary Received*: Client-direct salary payments received into the partner's account.
  *This amount is company money held by the partner (a liability to the company), reducing their receivable.*

### C. Yearly Dashboard Aggregation
* Rather than using a single ownership percentage for the entire year, the yearly settlement is calculated as the **direct sum of the 12 monthly settlements**.
* This preserves the accuracy of calculations when partner ownership structures change mid-year.

---

## 4. Advanced System Features

### A. Reusable Filtering & Pagination System
Ledger pages (Salaries, Project Payments, and Expenses) contain a unified filter engine:
* **Quick Date Filters**:
  * `[All]`: Fetches entire historical data.
  * `[Monthly]`: Filters within the selected Month + Year.
  * `[Yearly]`: Filters within the selected Year.
  * `[Custom Range]`: Filters between specified `From Date` and `To Date` bounds.
* **Coordinated Inputs**: All filters work together. Selecting a partner, date range, and search keyword updates table records and summary cards in real-time.
* **Pagination**: Prevents page lag by using server-side pagination (`limit` and `page`).
* **URL State Synchronization**: Filter inputs are synced to the URL query string, making filter states bookmarkable and shareable.

### B. Client-Side CSV Export
* Every filtered ledger view includes an **Export CSV** button. Clicking this compiles the currently filtered rows and downloads them as a formatted CSV spreadsheet.

### C. CSV File Upload & Bulk Data Import
Allows users to upload transaction sheets in bulk:
* **Header Mapping**: Standard CSV column headers are parsed case-insensitively.
* **Entity Resolution**: Spreadsheet names (Employee Name, Partner Name, Project Name) are matched case-insensitively to database UUIDs.
* **Validation Engine**: Validates number formats (ignores commas like `135,000.00`), date formats, and values.
* **Anomalies Report**: Returns line-by-line validation errors if matching entities are not found.
* **Transactional Safety**: Uses a `prisma.$transaction` block to write all imported rows. If any row fails, the entire batch is rolled back to prevent dirty data.

---

## 5. Database Schema & Index Optimization

Composite indexes have been created on foreign keys and transaction date fields to ensure queries scale efficiently:
```prisma
// Project Payments
@@index([companyId, paymentDate])
@@index([companyId, partnerId, paymentDate])
@@index([companyId, projectId, paymentDate])

// Employee Salaries
@@index([companyId, paymentDate])
@@index([companyId, partnerId, paymentDate])
@@index([companyId, employeeId, paymentDate])
@@index([companyId, receivedByPartnerId, paymentDate])

// Company Expenses
@@index([companyId, expenseDate])
@@index([companyId, partnerId, expenseDate])

// Partner Adjustments
@@index([companyId, adjustmentDate])
@@index([companyId, partnerId, adjustmentDate])
```
These indexes speed up range queries, partner filtering, and monthly/yearly aggregations.
