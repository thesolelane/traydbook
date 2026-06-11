-- Seed: 15 outreach email templates (3 touches x 5 audiences)
-- Status: touch 1 = approved (Bob uses immediately), touches 2 & 3 = draft (admin reviews before activating)
-- Run this in the Supabase SQL editor.

INSERT INTO public.outreach_templates (name, prospect_type, touch_number, subject, body_html, body_text, status) VALUES

-- ─── CONTRACTOR ───────────────────────────────────────────────────────────────

(
  'Contractor — Touch 1: Cold Introduction',
  'contractor', 1,
  'Grow your contracting business in {{city}}, {{state}} — TraydBook',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">I came across your {{trade}} license and wanted to reach out about <strong>TraydBook</strong> — a professional network built for licensed contractors like you.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">TraydBook connects verified contractors with project owners, real estate professionals, and homeowners actively seeking bids in {{city}} and surrounding areas. Members get:</p>
<ul style="font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#222;margin:0 0 16px 0;padding-left:20px;">
  <li><strong>Qualified leads</strong> sent directly to you — no chasing</li>
  <li><strong>A verified badge</strong> that shows your license is active and in good standing</li>
  <li><strong>A professional profile</strong> that lets your work speak for itself</li>
</ul>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Getting started is free and takes about 5 minutes. No subscription required to claim your profile.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Interested? Reply to this email or sign up at <a href="https://app.traydbook.com" style="color:#e85d04;">app.traydbook.com</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">Best,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

I came across your {{trade}} license and wanted to reach out about TraydBook — a professional network built for licensed contractors like you.

TraydBook connects verified contractors with project owners, real estate professionals, and homeowners actively seeking bids in {{city}} and surrounding areas. Members get:

- Qualified leads sent directly to you — no chasing
- A verified badge that shows your license is active
- A professional profile that lets your work speak for itself

Getting started is free and takes about 5 minutes.

Interested? Reply to this email or visit app.traydbook.com

Best,
The TraydBook Team',
  'approved'
),

(
  'Contractor — Touch 2: Second Touch',
  'contractor', 2,
  'Following up — TraydBook for {{trade}} contractors in {{state}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">I sent a note last week about TraydBook — just wanted to follow up in case it got buried.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">The short version: contractors who complete their TraydBook profile and earn a verified badge move up in our lead distribution queue. That means when a project owner in {{city}} posts a job that matches your trade, you hear about it sooner.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Takes 5 minutes to set up. No credit card needed to get started.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">Create your free profile →</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">— The TraydBook Team</p>',
  'Hi {{first_name}},

I sent a note last week about TraydBook — just wanted to follow up in case it got buried.

Contractors who complete their profile and earn a verified badge move up in our lead queue. When a project owner posts a job in {{city}} that matches your trade, you hear about it sooner.

Takes 5 minutes to set up. No credit card needed.

Create your free profile: app.traydbook.com

— The TraydBook Team',
  'draft'
),

(
  'Contractor — Touch 3: Final Touch',
  'contractor', 3,
  'Last note from TraydBook — {{first_name}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">This is my last note — I don''t want to clog your inbox.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">If the timing is ever right, TraydBook is a free way for licensed contractors in {{state}} to get verified, get visible, and get leads. Your profile is there whenever you want it.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">app.traydbook.com</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">Best of luck with the business,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

This is my last note — I don''t want to clog your inbox.

If the timing is ever right, TraydBook is a free way for licensed contractors in {{state}} to get verified, get visible, and get leads.

app.traydbook.com

Best of luck with the business,
The TraydBook Team',
  'draft'
),

-- ─── REAL ESTATE AGENT ────────────────────────────────────────────────────────

(
  'Real Estate Agent — Touch 1: Cold Introduction',
  'real_estate_agent', 1,
  'Better contractor connections for your clients in {{city}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">I wanted to introduce you to <strong>TraydBook</strong> — a professional network that makes it easier to connect your clients with vetted, licensed contractors in {{city}}.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">As an agent, you can use TraydBook to:</p>
<ul style="font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#222;margin:0 0 16px 0;padding-left:20px;">
  <li>Browse verified contractors by trade and location — no guesswork</li>
  <li>Share contractor profiles directly with buyers and sellers</li>
  <li>Build a referral network with tradespeople who serve your market</li>
</ul>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Your profile is free. Takes a few minutes to set up and immediately starts surfacing you to contractors looking to build referral relationships.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">Join TraydBook free →</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">Best,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

I wanted to introduce you to TraydBook — a professional network that makes it easier to connect your clients with vetted, licensed contractors in {{city}}.

As an agent, you can use TraydBook to:
- Browse verified contractors by trade and location
- Share contractor profiles with buyers and sellers
- Build referral relationships with tradespeople in your market

Your profile is free and takes a few minutes to set up.

Join TraydBook: app.traydbook.com

Best,
The TraydBook Team',
  'approved'
),

(
  'Real Estate Agent — Touch 2: Second Touch',
  'real_estate_agent', 2,
  'Following up — contractor connections on TraydBook',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Quick follow-up on TraydBook. One thing agents often tell us: the ability to refer a client to a <em>verified</em> contractor — one whose license has been checked — saves them real headaches after closing.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">If you work in {{city}} and want a reliable go-to list of licensed tradespeople you can recommend with confidence, TraydBook makes that easy to build.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">Set up your free profile →</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">— The TraydBook Team</p>',
  'Hi {{first_name}},

Quick follow-up on TraydBook. One thing agents often tell us: being able to refer a client to a verified contractor — one whose license has been checked — saves real headaches after closing.

If you work in {{city}} and want a reliable go-to list of licensed tradespeople you can recommend, TraydBook makes that easy to build.

app.traydbook.com

— The TraydBook Team',
  'draft'
),

(
  'Real Estate Agent — Touch 3: Final Touch',
  'real_estate_agent', 3,
  'Last note from TraydBook — {{first_name}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">This is my last note. Just wanted to leave the door open — if you ever need a fast way to find or refer a licensed contractor in {{state}}, TraydBook is free to join and the directory is there whenever you need it.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">app.traydbook.com</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">Best,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

This is my last note. If you ever need a fast way to find or refer a licensed contractor in {{state}}, TraydBook is free to join.

app.traydbook.com

Best,
The TraydBook Team',
  'draft'
),

-- ─── HOMEOWNER ────────────────────────────────────────────────────────────────

(
  'Homeowner — Touch 1: Cold Introduction',
  'homeowner', 1,
  'Find trusted, licensed contractors in {{city}} — TraydBook',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Finding a reliable contractor can feel like a gamble. <strong>TraydBook</strong> changes that — it''s a network where every listed contractor has a verified license and a real track record.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">With TraydBook you can:</p>
<ul style="font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#222;margin:0 0 16px 0;padding-left:20px;">
  <li>Browse licensed contractors in {{city}} by trade</li>
  <li>Post your project and receive competitive bids</li>
  <li>Read reviews from verified homeowners — not anonymous posts</li>
</ul>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Free to join. No obligation to hire.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">Browse contractors near you →</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">Best,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

Finding a reliable contractor can feel like a gamble. TraydBook changes that — every listed contractor has a verified license and a real track record.

With TraydBook you can:
- Browse licensed contractors in {{city}} by trade
- Post your project and receive competitive bids
- Read reviews from verified homeowners

Free to join. No obligation to hire.

Browse contractors: app.traydbook.com

Best,
The TraydBook Team',
  'approved'
),

(
  'Homeowner — Touch 2: Second Touch',
  'homeowner', 2,
  'Have a home project coming up? TraydBook can help',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Following up quickly on TraydBook. If you have any home projects in {{city}} — renovations, repairs, or something you''ve been putting off — it''s worth having a shortlist of vetted contractors before you need one.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">TraydBook lets you post a project, get bids from licensed contractors in your area, and compare them side by side. No pressure, no salespeople.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">Check it out — it''s free →</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">— The TraydBook Team</p>',
  'Hi {{first_name}},

Following up on TraydBook. If you have any home projects in {{city}} — renovations, repairs, or something you''ve been putting off — it''s worth having a shortlist of vetted contractors ready.

Post a project, get bids from licensed contractors, and compare them side by side.

app.traydbook.com

— The TraydBook Team',
  'draft'
),

(
  'Homeowner — Touch 3: Final Touch',
  'homeowner', 3,
  'Last note from TraydBook — {{first_name}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">This is my last note — promise. If you ever need a licensed contractor in {{state}} and want to skip the guesswork, TraydBook will be there. It''s free and always will be for homeowners.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">app.traydbook.com</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">Take care,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

This is my last note. If you ever need a licensed contractor in {{state}} and want to skip the guesswork, TraydBook is there. Free for homeowners.

app.traydbook.com

Take care,
The TraydBook Team',
  'draft'
),

-- ─── INVESTOR — FLIPPER ───────────────────────────────────────────────────────

(
  'Investor Flipper — Touch 1: Cold Introduction',
  'investor_flipper', 1,
  'Reliable contractors for your next flip in {{city}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">One of the biggest variables in any flip is the contractor. <strong>TraydBook</strong> was built to take that friction out — it''s a network of licensed, verified tradespeople you can tap into directly in {{city}}.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">As an investor on TraydBook you can:</p>
<ul style="font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#222;margin:0 0 16px 0;padding-left:20px;">
  <li>Post RFQs and get competitive bids fast</li>
  <li>Build a private contractor bench you return to project after project</li>
  <li>See verified license status, reviews, and portfolio before you hire</li>
</ul>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Free to join. Worth checking out before your next acquisition.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">Join TraydBook →</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">Best,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

One of the biggest variables in any flip is the contractor. TraydBook was built to take that friction out — it''s a network of licensed, verified tradespeople you can tap into in {{city}}.

As an investor on TraydBook you can:
- Post RFQs and get competitive bids fast
- Build a private contractor bench you return to project after project
- See verified license status, reviews, and portfolio before you hire

Free to join.

app.traydbook.com

Best,
The TraydBook Team',
  'approved'
),

(
  'Investor Flipper — Touch 2: Second Touch',
  'investor_flipper', 2,
  'Following up — contractor pipeline for flippers in {{state}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Quick follow-up on TraydBook. Flippers in {{city}} who use the platform tell us the biggest win isn''t finding a contractor the first time — it''s having a reliable bench ready before they close on the next deal.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">If you''re active in {{state}}, it''s worth a look. Free to set up, and you can start browsing verified contractors right away.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">app.traydbook.com</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">— The TraydBook Team</p>',
  'Hi {{first_name}},

Quick follow-up. Flippers in {{city}} tell us the biggest win is having a reliable contractor bench ready before they close on the next deal.

Free to set up, browse verified contractors right away.

app.traydbook.com

— The TraydBook Team',
  'draft'
),

(
  'Investor Flipper — Touch 3: Final Touch',
  'investor_flipper', 3,
  'Last note from TraydBook — {{first_name}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Last note from me. If you ever want a faster way to find and vet licensed contractors for projects in {{state}}, TraydBook is there — free for investors to join.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">app.traydbook.com</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">Good luck on the next one,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

Last note. If you ever want a faster way to find and vet licensed contractors for projects in {{state}}, TraydBook is there — free for investors.

app.traydbook.com

Good luck on the next one,
The TraydBook Team',
  'draft'
),

-- ─── INVESTOR — BUY & HOLD ────────────────────────────────────────────────────

(
  'Investor Buy & Hold — Touch 1: Cold Introduction',
  'investor_buy_hold', 1,
  'Reliable contractors for your rental portfolio in {{city}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Managing a rental portfolio means having go-to contractors you can trust — not starting from scratch every time something breaks. <strong>TraydBook</strong> is a network of licensed, verified tradespeople built for exactly that.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">With TraydBook you can:</p>
<ul style="font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#222;margin:0 0 16px 0;padding-left:20px;">
  <li>Build a vetted contractor bench for each market you operate in</li>
  <li>Post maintenance and repair jobs and get bids quickly</li>
  <li>Verify license status and read real reviews before you commit</li>
</ul>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Free to join — no commitment.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">Join TraydBook →</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">Best,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

Managing a rental portfolio means having go-to contractors you can trust — not starting from scratch every time. TraydBook is a network of licensed, verified tradespeople built for that.

With TraydBook you can:
- Build a vetted contractor bench for each market you operate in
- Post maintenance and repair jobs and get bids quickly
- Verify license status and read real reviews before you commit

Free to join.

app.traydbook.com

Best,
The TraydBook Team',
  'approved'
),

(
  'Investor Buy & Hold — Touch 2: Second Touch',
  'investor_buy_hold', 2,
  'Following up — maintenance contractors in {{city}} on TraydBook',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Following up on my note about TraydBook. The investors who get the most out of it are landlords who treat it like a contractor address book — they add tradespeople to their network as they find good ones in {{city}}, so the bench is already there when something needs fixing.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Takes five minutes to set up. Free to join.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">app.traydbook.com</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">— The TraydBook Team</p>',
  'Hi {{first_name}},

Following up on TraydBook. Landlords who get the most out of it treat it like a contractor address book — adding tradespeople to their network as they find good ones in {{city}}.

Five minutes to set up. Free to join.

app.traydbook.com

— The TraydBook Team',
  'draft'
),

(
  'Investor Buy & Hold — Touch 3: Final Touch',
  'investor_buy_hold', 3,
  'Last note from TraydBook — {{first_name}}',
  '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Hi {{first_name}},</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;">Last one from me. If you ever want a faster way to find and vet licensed contractors for your properties in {{state}}, TraydBook is there — free for property investors to join.</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0 0 16px 0;"><a href="https://app.traydbook.com" style="color:#e85d04;">app.traydbook.com</a></p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;margin:0;">All the best,<br><strong>The TraydBook Team</strong></p>',
  'Hi {{first_name}},

Last one. If you ever want a faster way to find and vet licensed contractors for your properties in {{state}}, TraydBook is there — free for property investors.

app.traydbook.com

All the best,
The TraydBook Team',
  'draft'
);
