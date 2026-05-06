-- ============================================================
-- Protected Super Admin Lock
-- Run in Supabase SQL editor (production AND beta)
-- ============================================================

-- Step 1: Grant super admin role
UPDATE users
SET account_type = 'admin'
WHERE email = 'acooper@cooperanth.com';

-- Step 2: Trigger function — blocks any role demotion or suspension of this account
CREATE OR REPLACE FUNCTION enforce_protected_super_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Block account_type change away from 'admin'
  IF OLD.email = 'acooper@cooperanth.com'
     AND NEW.account_type IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PROTECTED_ADMIN: account_type for this account cannot be changed at the database level.';
  END IF;

  -- Block soft-deletion / suspension (deleted_at being set)
  IF OLD.email = 'acooper@cooperanth.com'
     AND NEW.deleted_at IS NOT NULL
     AND OLD.deleted_at IS NULL THEN
    RAISE EXCEPTION 'PROTECTED_ADMIN: this account cannot be suspended.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Attach trigger to users table
DROP TRIGGER IF EXISTS tg_protect_super_admin ON users;
CREATE TRIGGER tg_protect_super_admin
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_protected_super_admin();

-- Step 4: Confirm
SELECT
  id,
  email,
  account_type,
  created_at
FROM users
WHERE email = 'acooper@cooperanth.com';
