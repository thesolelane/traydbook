---
name: Solana pubkey storage location
description: Public key is in users.solana_pubkey — there is no solana_wallets table.
---

Solana public keys are stored in the `solana_pubkey` column on `public.users`, written via `POST /api/wallet/save-pubkey` after the user confirms their wallet on `/wallet-setup`.

**Why:**
Private keys never touch the server (generated client-side). Only the pubkey is sent to the server so it can be associated with the user for future on-chain features.

**How to apply:**
- Any feature that needs a user's Solana address should query `users.solana_pubkey`
- There is no `solana_wallets` table — do not create or reference one
- The admin Wallets section (`/api/admin/wallets`) queries `users.solana_pubkey` directly, filtered to `account_type = 'contractor'`
- The column may be null for contractors who did not complete wallet setup
