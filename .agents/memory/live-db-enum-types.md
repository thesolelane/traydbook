---
name: Live DB ENUM types
description: Which columns use PostgreSQL ENUMs in the live DB (not text + CHECK as in schema.sql)
---

## Rule
When extending allowed values on these columns, use `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, NOT `DROP CONSTRAINT / ADD CONSTRAINT CHECK`.

## Known ENUM types (live DB)

| ENUM name        | Column                    | Table       |
|------------------|---------------------------|-------------|
| account_type     | account_type              | users       |
| purchase_status  | status                    | purchases   |

## How to apply
Wrap in a DO block that checks `pg_type` for the enum name:
```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_status') THEN
    ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'held';
  ELSE
    -- CHECK constraint fallback for schema.sql / fresh DBs
    ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
    ALTER TABLE public.purchases ADD CONSTRAINT purchases_status_check
      CHECK (status IN ('pending','completed','failed','held'));
  END IF;
END $$;
```

**Why:** The live staging DB was created with ENUM types before schema.sql switched to text + CHECK. Migrations that use DROP/ADD CONSTRAINT fail with `invalid input value for enum`.
