const PHYSICAL_ADDRESS = 'TraydBook · 8 The Green, Suite A · Dover, DE 19901'

const FOOTER_SENTINEL_HTML = '<!-- traydbook-footer -->'
const FOOTER_SENTINEL_TEXT = '---traydbook-footer---'

export function buildFooterHtml(unsubscribeUrl) {
  const unsub = unsubscribeUrl || '#'
  return `${FOOTER_SENTINEL_HTML}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e0e0e0;font-family:Arial,sans-serif;font-size:12px;color:#888;text-align:center;line-height:1.7;">
  <p style="margin:0 0 6px 0;">This is a commercial message from TraydBook. You received this email because your contact information appears in licensed contractor public records.</p>
  <p style="margin:0 0 6px 0;">${PHYSICAL_ADDRESS}</p>
  <p style="margin:0;"><a href="${unsub}" style="color:#666;text-decoration:underline;">Unsubscribe</a> — to stop receiving emails from TraydBook, click the link above.</p>
</div>`
}

export function buildFooterText(unsubscribeUrl) {
  const unsub = unsubscribeUrl || ''
  return `\n\n${FOOTER_SENTINEL_TEXT}\nThis is a commercial message from TraydBook. You received this email because your contact information appears in licensed contractor public records.\n${PHYSICAL_ADDRESS}\nTo unsubscribe: ${unsub}`
}

export function appendEmailFooter(html, text, unsubscribeUrl) {
  const safeHtml = html || ''
  const safeText = text || ''
  const htmlNeedsFooter = !safeHtml.includes(FOOTER_SENTINEL_HTML)
  const textNeedsFooter = !safeText.includes(FOOTER_SENTINEL_TEXT)
  return {
    html: htmlNeedsFooter ? safeHtml + buildFooterHtml(unsubscribeUrl) : safeHtml,
    text: textNeedsFooter
      ? (safeText ? safeText + buildFooterText(unsubscribeUrl) : buildFooterText(unsubscribeUrl))
      : safeText,
  }
}
