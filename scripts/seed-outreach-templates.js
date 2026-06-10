/**
 * Seed approved outreach email templates (v3) into outreach_templates.
 *
 * Usage:
 *   node scripts/seed-outreach-templates.js
 *
 * Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or BETA_* equivalents)
 * before running.  Duplicate detection: skips any template whose
 * (prospect_type, name) already exists, so safe to re-run.
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.BETA_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.BETA_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

const TEMPLATES = [
  // ─── CONTRACTOR / TRADESMAN ──────────────────────────────────────────────────
  {
    prospect_type: 'contractor',
    touch_number: 1,
    name: 'Contractor — Email 1 of 3 (Cold Introduction)',
    subject: "You shouldn't have to pay to find work",
    body_text: `Hey [First Name],

My name's Cooper — I'm the founder of TraydBook, a professional network built specifically for contractors and tradespeople.

Quick question: how much are you spending on leads right now? Most lead platforms charge you every time you want to see a job — and send that same lead to multiple contractors at the same time.

TraydBook works differently. Contractors get free access to every job posted on the platform. The higher your trust score — built by completing your profile and staying active — the sooner you see new leads in your area. No pay-per-lead. No subscription required.

We're opening early access to a limited group of tradespeople before we go wide. I'd love to get you in early.

Claim your spot at traydbook.com — takes about 2 minutes.

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'contractor',
    touch_number: 2,
    name: 'Contractor — Email 2 of 3 (Second Touch)',
    subject: 'The better your profile, the sooner you see jobs',
    body_text: `Hey [First Name],

Sent you a note last week about TraydBook — wanted to follow up with a little more on how it works.

Most lead platforms are pay-to-play. You pay for a lead, you're competing with multiple contractors who got the same one, and your margin takes a hit before you've even picked up the phone.

TraydBook flips that. Leads are free. The order you see them depends on your trust score — profile completeness, trade verification, activity. The more dialed in your profile, the earlier you're in line.

And if you want to go further, there's Boosted by Bob — our optional add-on where Bob (our AI) actively hunts leads off-platform and routes them directly to you via SMS. First look, before anyone else.

We're still in early access — limited spots per trade per zip code.

traydbook.com to lock yours in.

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'contractor',
    touch_number: 3,
    name: 'Contractor — Email 3 of 3 (Final Touch)',
    subject: 'Last note from me',
    body_text: `Hey [First Name],

This is my last message — I don't want to be that guy who won't stop emailing.

TraydBook is early access right now and I'm hand-picking the first contractors in each market. Free leads, trust-based priority, and an optional SMS boost if you want Bob finding work for you off-platform.

If that sounds worth a look: traydbook.com

If the timing's off, no hard feelings — come back when you're ready.

Either way, good luck out there.

— Cooper
Founder, TraydBook`,
  },

  // ─── HOMEOWNER ───────────────────────────────────────────────────────────────
  {
    prospect_type: 'homeowner',
    touch_number: 1,
    name: 'Homeowner — Email 1 of 3 (Cold Introduction)',
    subject: 'A better way to find a contractor (no more guessing)',
    body_text: `Hi [First Name],

I'm Cooper, founder of TraydBook — a platform that makes it easier to find and hire verified contractors without the usual headaches.

Here's how it works: you post your project for free, verified tradespeople in your area submit bids, and you can see their work history, reviews, and credentials before you ever pick up the phone.

No more hoping the guy you found on Google is legit. No more waiting days for someone to call back.

We're in early access right now, opening up to homeowners in select areas. If you have a project coming up — or just want vetted contractors ready when you need them — it's worth getting on the list.

Join free at traydbook.com.

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'homeowner',
    touch_number: 2,
    name: 'Homeowner — Email 2 of 3 (Second Touch)',
    subject: 'How do you usually find contractors?',
    body_text: `Hi [First Name],

Quick follow-up from my last note about TraydBook.

Most people find contractors the same way — Google, a Facebook group, a neighbor's recommendation. Sometimes it works. Sometimes it's a nightmare.

TraydBook gives you a verified pool of local tradespeople who've been credentialed on the platform. You post the job, they come to you. You see their work, their ratings, their trade credentials — before you commit to anything.

Free to post a project. Free to get bids.

Early access is open now at traydbook.com — would love to have you in.

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'homeowner',
    touch_number: 3,
    name: 'Homeowner — Email 3 of 3 (Final Touch)',
    subject: 'Last one, I promise',
    body_text: `Hi [First Name],

One last note — I know your inbox is busy.

TraydBook is free for homeowners. Post a project, get bids from verified local contractors, and hire with confidence. That's it.

We're still in early access, so the experience is personal right now. Good time to get in before it gets crowded.

traydbook.com if you want to check it out.

No pressure either way.

— Cooper
Founder, TraydBook`,
  },

  // ─── REAL ESTATE AGENT / BROKERAGE ───────────────────────────────────────────
  {
    prospect_type: 'real_estate_agent',
    touch_number: 1,
    name: 'Real Estate Agent — Email 1 of 3 (Cold Introduction)',
    subject: 'Your contractor problem has a fix',
    body_text: `Hi [First Name],

My name's Cooper — I'm the founder of TraydBook, a professional network for the construction trades.

I talk to a lot of agents, and the same problem comes up constantly: you're scrambling to find a reliable contractor before a deal falls apart. Inspection flags, last-minute repairs, staging work — and your usual guy isn't available.

TraydBook is building a verified network of contractors organized by trade and zip code. When you need someone fast, post the job and get bids from credentialed tradespeople in your market within hours.

We're opening early access to agents and brokerages now. Getting in early means building your go-to contractor network before everyone else in your market is on the platform.

Take a look at traydbook.com — happy to walk you through it if you want.

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'real_estate_agent',
    touch_number: 2,
    name: 'Real Estate Agent — Email 2 of 3 (Second Touch)',
    subject: 'How many deals have contractor issues slowed down?',
    body_text: `Hi [First Name],

Following up on my note about TraydBook.

It's not that contractors are impossible to find — it's that finding a reliable one fast, in the middle of a transaction, is the real challenge.

TraydBook is designed for exactly that. Verified pros, organized by trade and location, available to bid on your jobs with no fees on your end.

Agents who are already on the platform will have an edge — you'll know which contractors are active, responsive, and have a track record before you ever need to make the call.

Early access is still open: traydbook.com

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'real_estate_agent',
    touch_number: 3,
    name: 'Real Estate Agent — Email 3 of 3 (Final Touch)',
    subject: 'Last note on TraydBook',
    body_text: `Hi [First Name],

Last one from me on this.

TraydBook is free for real estate professionals. Build a shortlist of verified contractors in your market, post jobs when you need them, and stop scrambling when a deal needs work done fast.

Still early — which means you'd be getting in ahead of most agents in your area.

traydbook.com if you want to check it out.

— Cooper
Founder, TraydBook`,
  },

  // ─── INVESTOR — WHOLESALER / FLIPPER ─────────────────────────────────────────
  {
    prospect_type: 'investor_flipper',
    touch_number: 1,
    name: 'Investor (Flipper) — Email 1 of 3 (Cold Introduction)',
    subject: "Contractor access that doesn't slow your deals down",
    body_text: `Hey [First Name],

I'm Cooper, founder of TraydBook — a platform connecting investors with verified tradespeople, built for speed.

Here's what I keep hearing from flippers and wholesalers: finding reliable contractors fast is the bottleneck. Your timeline is tight, your margin depends on labor costs, and you can't afford to wait a week for three guys to call you back.

TraydBook lets you post a job and get bids from verified contractors in your market — organized by trade, rated by previous work, no cost to post.

We're in early access now. Investors who get in early can build out their contractor bench before the platform fills up in their market.

Worth 2 minutes: traydbook.com

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'investor_flipper',
    touch_number: 2,
    name: 'Investor (Flipper) — Email 2 of 3 (Second Touch)',
    subject: "Your deal timeline shouldn't depend on who answers the phone",
    body_text: `Hey [First Name],

Following up on TraydBook.

Most investors have a short list of contractors they trust — and when those guys are booked, everything slows down. You either wait, or you take a risk on someone new.

TraydBook gives you a bench, not just one or two names. Verified contractors by trade and zip code, with work history you can see before you commit.

Post a job, get bids, move fast. No fees, no middleman.

Early access is open now at traydbook.com — spots per market are limited.

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'investor_flipper',
    touch_number: 3,
    name: 'Investor (Flipper) — Email 3 of 3 (Final Touch)',
    subject: 'Last note',
    body_text: `Hey [First Name],

Last message from me on this.

TraydBook is free to use, built for fast-moving investors, and still in early access — meaning you'd be one of the first in your market with access to a vetted contractor network.

If deal timelines and contractor availability are ever a pain point, it's worth a look.

traydbook.com

— Cooper
Founder, TraydBook`,
  },

  // ─── INVESTOR — BUY & HOLD ───────────────────────────────────────────────────
  {
    prospect_type: 'investor_buy_hold',
    touch_number: 1,
    name: 'Investor (Buy & Hold) — Email 1 of 3 (Cold Introduction)',
    subject: "Stop hunting for maintenance contractors every time something breaks",
    body_text: `Hey [First Name],

I'm Cooper, founder of TraydBook — a professional network for contractors and the people who hire them.

If you're managing rental properties, you know the drill: something breaks, your usual guy is busy, and you're back to square one finding someone reliable at a reasonable price.

TraydBook is building a verified contractor network organized by trade and zip code. Post a maintenance job, get bids from credentialed local tradespeople, and start building relationships with guys who show up and do good work.

We're opening early access now. Investors who get in first will have an established contractor network on the platform when everyone else is still figuring it out.

Free to use: traydbook.com

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'investor_buy_hold',
    touch_number: 2,
    name: 'Investor (Buy & Hold) — Email 2 of 3 (Second Touch)',
    subject: 'Consistent contractors, lower turnover costs',
    body_text: `Hey [First Name],

Quick follow-up on TraydBook.

Buy-and-hold investors don't just need contractors fast — they need consistent ones. Someone who knows your properties, your standards, and shows up when called.

That's what TraydBook is designed to help you build: a reliable bench of tradespeople you can call on market by market, with their work history and credentials visible from day one.

No fees for posting jobs. No subscription. Free during early access.

traydbook.com — worth a look if you manage more than a couple doors.

— Cooper
Founder, TraydBook`,
  },
  {
    prospect_type: 'investor_buy_hold',
    touch_number: 3,
    name: 'Investor (Buy & Hold) — Email 3 of 3 (Final Touch)',
    subject: 'One last note',
    body_text: `Hey [First Name],

Last one from me.

TraydBook is free, built for people who hire contractors regularly, and still in early access — meaning you'd be getting a head start on building your contractor network before the platform is fully open.

If property maintenance and contractor reliability are ever a headache, that's exactly what we're solving.

traydbook.com

— Cooper
Founder, TraydBook`,
  },
]

async function main() {
  console.log(`Seeding ${TEMPLATES.length} outreach templates…\n`)

  const { data: existing } = await supabase
    .from('outreach_templates')
    .select('name, prospect_type')

  const existingKeys = new Set((existing || []).map(r => `${r.prospect_type}||${r.name}`))

  let inserted = 0
  let skipped = 0

  for (const tpl of TEMPLATES) {
    const key = `${tpl.prospect_type}||${tpl.name}`
    if (existingKeys.has(key)) {
      console.log(`  SKIP  ${tpl.name}`)
      skipped++
      continue
    }

    const { error } = await supabase.from('outreach_templates').insert({
      ...tpl,
      status: 'approved',
    })

    if (error) {
      console.error(`  ERROR ${tpl.name}: ${error.message}`)
    } else {
      console.log(`  OK    ${tpl.name}`)
      inserted++
    }
  }

  console.log(`\nDone — ${inserted} inserted, ${skipped} skipped.`)
}

main().catch(err => { console.error(err); process.exit(1) })
