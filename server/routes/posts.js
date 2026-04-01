import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()

router.post('/', requireAuth, async (req, res) => {
  const { post_type, body, hashtags, is_urgent, media_urls } = req.body
  const userId = req.user.id

  if (!body?.trim()) return res.status(400).json({ error: 'Body is required' })

  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert({
      author_id: userId,
      post_type: post_type ?? 'update',
      body: body.trim(),
      hashtags: hashtags ?? [],
      is_urgent: is_urgent ?? false,
      media_urls: media_urls ?? [],
    })
    .select(`
      id, post_type, body, media_urls, hashtags, like_count, comment_count, share_count,
      is_urgent, is_boosted, created_at, author_id,
      users!author_id (display_name, handle, avatar_url, account_type)
    `)
    .single()

  if (error) {
    console.error('[posts] insert error:', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ post: data })
})

export default router
