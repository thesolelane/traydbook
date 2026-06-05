-- Migration 033: Credit transfer ledger
-- Adds credit_transfers log table and an atomic transfer_credits() RPC
-- that debits the sender and credits the recipient in a single transaction.

CREATE TABLE IF NOT EXISTS public.credit_transfers (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  to_user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount        integer     NOT NULL CHECK (amount > 0),
  note          text,
  transfer_type text        NOT NULL DEFAULT 'transfer'
                            CHECK (transfer_type IN ('transfer','brokerage_issue','gift','reward')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.credit_transfers TO service_role;

CREATE INDEX IF NOT EXISTS credit_transfers_from_idx ON public.credit_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS credit_transfers_to_idx   ON public.credit_transfers(to_user_id);

-- ── Atomic transfer RPC ───────────────────────────────────────────────────────
-- Returns the sender's new credit_balance, or raises an exception on failure.

CREATE OR REPLACE FUNCTION public.transfer_credits(
  p_from_user_id  uuid,
  p_to_user_id    uuid,
  p_amount        integer,
  p_note          text    DEFAULT NULL,
  p_transfer_type text    DEFAULT 'transfer'
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_sender_balance integer;
  v_new_balance    integer;
BEGIN
  IF p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'self_transfer';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  -- Lock sender row to prevent race conditions
  SELECT credit_balance INTO v_sender_balance
    FROM public.users
    WHERE id = p_from_user_id
    FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'sender_not_found';
  END IF;

  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  -- Debit sender
  UPDATE public.users
    SET credit_balance = credit_balance - p_amount
    WHERE id = p_from_user_id
    RETURNING credit_balance INTO v_new_balance;

  -- Credit recipient (raise if not found)
  UPDATE public.users
    SET credit_balance = credit_balance + p_amount
    WHERE id = p_to_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipient_not_found';
  END IF;

  -- Log the transfer
  INSERT INTO public.credit_transfers
    (from_user_id, to_user_id, amount, note, transfer_type)
    VALUES (p_from_user_id, p_to_user_id, p_amount, p_note, p_transfer_type);

  RETURN v_new_balance;
END;
$$;
