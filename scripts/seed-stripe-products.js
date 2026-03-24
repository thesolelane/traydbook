import Stripe from 'stripe'
import { createRequire } from 'module'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const BUNDLES = [
  {
    id:      'starter',
    name:    'TraydBook Starter Credits',
    description: '25 credits — post jobs, RFQs & message contractors on TraydBook',
    credits: 25,
    cents:   900,
  },
  {
    id:      'builder',
    name:    'TraydBook Builder Credits',
    description: '75 credits — post jobs, RFQs & message contractors on TraydBook',
    credits: 75,
    cents:   2400,
  },
  {
    id:      'professional',
    name:    'TraydBook Professional Credits',
    description: '200 credits — post jobs, RFQs & message contractors on TraydBook',
    credits: 200,
    cents:   5400,
  },
  {
    id:      'power',
    name:    'TraydBook Power Credits',
    description: '500 credits — post jobs, RFQs & message contractors on TraydBook',
    credits: 500,
    cents:   9900,
  },
]

async function seed() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set')
    process.exit(1)
  }

  const results = {}

  for (const bundle of BUNDLES) {
    // Check if product already exists (idempotent)
    const existing = await stripe.products.search({
      query: `metadata['bundle_id']:'${bundle.id}'`,
    })

    let product
    if (existing.data.length > 0) {
      product = existing.data[0]
      console.log(`[skip] Product already exists: ${product.id} (${bundle.id})`)
    } else {
      product = await stripe.products.create({
        name: bundle.name,
        description: bundle.description,
        metadata: {
          bundle_id: bundle.id,
          credits:   String(bundle.credits),
        },
      })
      console.log(`[created] Product: ${product.id} (${bundle.id})`)
    }

    // Check for existing active price on this product
    const prices = await stripe.prices.list({
      product: product.id,
      active:  true,
    })

    let price
    if (prices.data.length > 0) {
      price = prices.data[0]
      console.log(`[skip] Price already exists: ${price.id} (${bundle.cents / 100} USD)`)
    } else {
      price = await stripe.prices.create({
        product:     product.id,
        unit_amount: bundle.cents,
        currency:    'usd',
        metadata: {
          bundle_id: bundle.id,
          credits:   String(bundle.credits),
        },
      })
      console.log(`[created] Price: ${price.id} ($${bundle.cents / 100})`)
    }

    results[bundle.id] = {
      product_id: product.id,
      price_id:   price.id,
      credits:    bundle.credits,
      cents:      bundle.cents,
    }
  }

  console.log('\n=== PRICE ID MAP (paste into server/index.js) ===')
  console.log(JSON.stringify(results, null, 2))
}

seed().catch(err => {
  console.error(err.message)
  process.exit(1)
})
