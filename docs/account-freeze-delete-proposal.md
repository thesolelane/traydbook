# Account freeze/delete — proposal only

No button behavior, columns, or database records have been changed for this item.

## Current problem

`DangerTab.tsx` writes `account_status` and `frozen_at`, which are absent from the
live users table. Both actions therefore fail. Its copy also promises automatic
deletion after six months and permanent removal of all associated data; the
current handlers implement neither promise.

## Freeze

Expected behavior: temporarily hide the profile, prevent new account activity,
retain existing records and credits, and permit deliberate reactivation.

Proposed implementation:

- An authenticated, rate-limited server endpoint derives the account ID from
  the verified session. The browser cannot select another account to freeze.
- The server sets the existing `is_active = false`, keeps `deleted_at = null`,
  and records an audit event. Public-profile reads already filter this account
  out. Privileged fields cannot be updated directly from the browser.
- Revoke other sessions and stop app/API writes for an inactive account. Keep a
  limited sign-in path to a reactivation screen; ordinary account activity must
  remain blocked until reactivation. Audit the reactivation and set
  `is_active = true` only if the account is not deleted or staff-suspended.
- Confirm how to distinguish a self-freeze from a staff suspension before
  implementing reactivation. `is_active` alone cannot distinguish these states;
  use an existing suitable audit mechanism or propose a separate migration for
  review if needed.
- Remove the six-month automatic-deletion promise unless that retention policy
  and an audited cleanup job are explicitly approved and implemented. A timed
  deletion policy also requires a reliable freeze timestamp.

## Delete

Expected behavior: an explicitly confirmed request that removes access and
visibility immediately, followed by a defined deletion/anonymization process.
Do not describe a soft delete as immediate permanent removal of all data.

Proposed implementation:

- Require typed `DELETE`, recent authentication, and server-side confirmation.
  Before confirmation, explain irreversible consequences and any wallet/export,
  credit, subscription, active job/bid, or legal-retention implications.
- The authenticated server derives the account ID, sets the existing
  `is_active = false` and `deleted_at = now()`, revokes access/sessions, and
  records the request. No new columns are needed for this initial soft-delete
  step. Deleted accounts cannot reactivate themselves.
- Separately define how to cancel recurring billing, preserve required payment
  records and counterparties' transaction history, remove uploaded files, and
  delete/anonymize posts, bids, messages and the Supabase Auth account.
- Review cascade effects and retention requirements before enabling permanent
  cleanup. The current `users`/Auth foreign keys can cascade deletions, so deleting
  an Auth account blindly is not a safe replacement for this process.
- Staff/admin accounts, delegated accounts and ongoing obligations need explicit
  restrictions; a delegate must never freeze or delete a principal's account.

## Review on dev.traydbook.com

Inspect Settings → Danger Zone and compare its current copy with this proposal.
Do not test these buttons on an account you need to keep: their implementation
has intentionally not been repaired in this change. Approve the intended
reactivation, retention and cleanup rules before implementation.
