# Bob Outreach Email Templates

Templates used by Bob when drafting outreach emails to prospects.
Bob personalizes each email using data from the `outreach_prospects` table.

---

## Contractor Template

**Subject:** `Grow Your Contracting Business with TraydBook — [FIRST_NAME]`

**Body:**

Hi [FIRST_NAME],

I came across your [TYPE_CLASS] license ([LICENSE_NUMBER]) and wanted to reach out about TraydBook — a professional network built specifically for contractors like you.

TraydBook connects licensed contractors with project owners, real estate professionals, and homeowners actively seeking bids in [CITY], [STATE]. Verified members get:

- **More leads** — qualified project requests sent directly to you
- **A verified badge** on your profile showing your license is active
- **Faster payments** — built-in credit and payment tools

[BUSINESS_NAME] would be a strong fit. Getting started is free, and setup takes about 5 minutes.

Interested? Reply to this email or sign up at https://traydbook.com

Best,
The TraydBook Team

---

## Real Estate Agent Template

**Subject:** `Connect Your Clients with Trusted Contractors — TraydBook`

**Body:**

Hi [FIRST_NAME],

I wanted to introduce you to TraydBook — a platform that helps real estate professionals like you connect clients with licensed, verified contractors in [CITY], [STATE].

Whether your clients need pre-listing repairs, renovations, or new construction bids, TraydBook's contractor network is verified, licensed, and rated.

Benefits for real estate agents:
- **Verified contractor network** — all members are license-checked
- **Fast RFQ system** — get multiple bids within 24 hours
- **Free to use** for real estate professionals

Reply to this email or check us out at https://traydbook.com

Best,
The TraydBook Team

---

## Personalization Variables

| Variable | Source Column |
|---|---|
| `[FIRST_NAME]` | `first_name` |
| `[LAST_NAME]` | `last_name` |
| `[BUSINESS_NAME]` | `business_name` |
| `[LICENSE_NUMBER]` | `license_number` |
| `[TYPE_CLASS]` | `type_class` |
| `[CITY]` | `city` |
| `[STATE]` | `state` |

## Bob Instructions

1. Use the template above as a base.
2. Personalize using the prospect's data — never leave a `[VARIABLE]` unfilled.
3. If `business_name` is empty, use `[FIRST_NAME] [LAST_NAME]` instead.
4. If `type_class` is empty, use "general contracting".
5. Keep the tone professional, warm, and brief. Do not oversell.
6. If no email found via enrichment, mark prospect as `skipped` with reason `no_email_found`.
7. Draft the email and store it in `email_subject` + `email_body`, set status to `drafted`.
8. Do not send automatically — wait for admin approval unless `auto_send` flag is set.
