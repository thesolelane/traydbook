---
name: express-rate-limit keyGenerator IPv6 crash
description: Custom keyGenerator using req.ip crashes the server at startup with ERR_ERL_KEY_GEN_IPV6.
---

`express-rate-limit` v8+ validates custom `keyGenerator` functions and throws `ERR_ERL_KEY_GEN_IPV6` at module load time (not at request time) if the function references `req.ip` without calling the library's `ipKeyGenerator` helper. This kills the entire server process before it can serve any requests.

**Broken pattern (do not use):**
```js
rateLimit({
  keyGenerator: req => (req.ip ?? '').replace(/^::ffff:/, ''),
})
```

**Correct pattern:**
```js
rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // No keyGenerator — the default handles IPv6 correctly
})
```

**Why:**
The default keyGenerator in express-rate-limit already normalises IPv4-mapped IPv6 addresses (`::ffff:x.x.x.x`). The custom stripper was redundant and triggered the validation guard.

**How to apply:**
Never add a custom `keyGenerator` that uses `req.ip` unless you also import and call `ipKeyGenerator` from the library. When in doubt, omit `keyGenerator` entirely.
