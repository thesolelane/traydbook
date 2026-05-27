---
name: account_type is a PG ENUM
description: The live Supabase DB defines account_type as a PostgreSQL ENUM, not a text column with a CHECK constraint — schema.sql was misleading on this point.
---

## Rule
To add new account types, use:
```sql
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'new_value';
```
NOT: `ALTER TABLE users DROP CONSTRAINT ... ADD CONSTRAINT ... CHECK (account_type IN (...))` — that only works on text columns.

**Why:** The live staging DB was created with an ENUM type. The `schema.sql` file incorrectly showed it as `text ... check (account_type in (...))`. Any migration that tries to drop/recreate a check constraint on this column will fail with `ERROR: 22P02: invalid input value for enum account_type`.

**How to apply:** Any migration that needs a new account type (investor, brokerage, etc.) must use `ALTER TYPE account_type ADD VALUE IF NOT EXISTS`. In `schema.sql`, the column is declared as `account_type account_type not null` (using the enum type name, not text).
