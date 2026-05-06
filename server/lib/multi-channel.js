import { appendFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export async function alertAdmins(alert) {
  const channels = []

  if (process.env.SLACK_WEBHOOK_URL) {
    channels.push(sendSlackAlert(alert))
  }

  channels.push(sendEmailAlert(alert))

  if (alert.severity === 'CRITICAL' && process.env.PAGERDUTY_KEY) {
    channels.push(sendPagerDutyAlert(alert))
  }

  channels.push(appendToLocalAuditLog({
    type: 'ALERT',
    severity: alert.severity,
    content: alert,
    timestamp: new Date().toISOString(),
  }))

  await Promise.allSettled(channels)
}

async function sendSlackAlert(alert) {
  const payload = {
    channel: '#security-critical',
    text: `🚨 TraydBook Admin: ${alert.severity}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚨 ${alert.severity}: ${alert.mode || 'Alert'}` },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Mode:* ${alert.mode || 'N/A'}\n*Reason:* ${alert.reason || 'N/A'}\n*Action:* ${alert.action || 'Review quarantine buffer'}`,
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `⏰ ${new Date().toISOString()} | TraydBook Admin` }],
      },
    ],
  }

  try {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.error('[admin] Slack alert failed:', e.message)
  }
}

async function sendEmailAlert(alert) {
  console.log(`[admin][EMAIL] ${alert.severity}: ${alert.message || alert.reason}`)
}

async function sendPagerDutyAlert(alert) {
  try {
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: process.env.PAGERDUTY_KEY,
        event_action: 'trigger',
        payload: {
          summary: `TraydBook Admin ${alert.mode || 'CRITICAL'}`,
          severity: 'critical',
          source: 'traydbook-admin-panel',
          custom_details: alert,
        },
      }),
    })
  } catch (e) {
    console.error('[admin] PagerDuty alert failed:', e.message)
  }
}

async function appendToLocalAuditLog(entry) {
  const logPath = '/var/log/traydbook-admin/audit.log'
  try {
    mkdirSync(dirname(logPath), { recursive: true })
    appendFileSync(logPath, JSON.stringify(entry) + '\n')
  } catch {
    // log dir not available in dev — silent
  }
}
