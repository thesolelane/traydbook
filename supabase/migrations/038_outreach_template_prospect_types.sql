-- Migration 038: Expand outreach_templates to cover all 5 outreach audiences
-- and add touch_number (1/2/3) for sequence position tracking

ALTER TABLE public.outreach_templates
  DROP CONSTRAINT IF EXISTS outreach_templates_prospect_type_check;

ALTER TABLE public.outreach_templates
  ADD CONSTRAINT outreach_templates_prospect_type_check
  CHECK (prospect_type IN (
    'contractor',
    'homeowner',
    'real_estate_agent',
    'investor_flipper',
    'investor_buy_hold',
    'other'
  ));

-- touch_number: which email in the 3-touch sequence (1, 2, or 3)
ALTER TABLE public.outreach_templates
  ADD COLUMN IF NOT EXISTS touch_number INT CHECK (touch_number IN (1, 2, 3));

CREATE INDEX IF NOT EXISTS idx_outreach_templates_type_touch
  ON public.outreach_templates(prospect_type, touch_number)
  WHERE status = 'approved';
