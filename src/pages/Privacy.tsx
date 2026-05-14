export default function Privacy() {
  return (
    <div className="container" style={{ maxWidth: 760, padding: '48px 24px 80px' }}>
      <div
        style={{
          fontFamily: 'var(--font-condensed)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          color: 'var(--color-brand)',
          marginBottom: 8,
        }}
      >
        Legal
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-condensed)',
          fontSize: 34,
          fontWeight: 800,
          color: 'var(--color-text)',
          marginBottom: 6,
          marginTop: 0,
        }}
      >
        Privacy Policy
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 40 }}>
        Effective date: January 1, 2025 &nbsp;·&nbsp; Last updated: May 2025
      </p>

      <div style={{ fontSize: 15, color: 'var(--color-text)', lineHeight: 1.75 }}>

        <Section title="1. Who we are">
          TraydBook is a professional network for the construction industry, operated by TraydBook Inc.
          ("TraydBook", "we", "us"). This Privacy Policy explains how we collect, use, and protect
          information about you when you use our platform at traydbook.com and related services.
        </Section>

        <Section title="2. Information we collect">
          <strong>Information you provide:</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Account registration details (name, email, phone number)</li>
            <li>Professional profile information (trade, license numbers, company name, location)</li>
            <li>Content you post (project updates, bids, job listings, messages)</li>
            <li>Payment information (processed securely by Stripe — we do not store card numbers)</li>
            <li>Verification documents submitted for the Verified Badge program</li>
          </ul>
          <strong style={{ display: 'block', marginTop: 12 }}>Information collected automatically:</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Device and browser type, IP address</li>
            <li>Pages visited, features used, and time spent on the platform</li>
            <li>Authentication logs and session data</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            <strong>License information:</strong> Contractor license numbers entered on TraydBook are
            publicly accessible information by nature (issued by government licensing boards). We display
            them on your public profile to establish trust with project owners.
          </p>
        </Section>

        <Section title="3. How we use your information">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>To create and manage your account</li>
            <li>To connect contractors, project owners, and other trade professionals</li>
            <li>To process payments and credits through Stripe</li>
            <li>To send notifications about messages, bids, and platform activity</li>
            <li>To verify professional credentials and issue Verified Badges</li>
            <li>To detect fraud, abuse, and security threats</li>
            <li>To improve the platform through aggregated analytics</li>
            <li>To send optional SMS alerts you have subscribed to via Telnyx</li>
          </ul>
          We do not sell your personal information to third parties.
        </Section>

        <Section title="4. How we share your information">
          <p>Your public profile information (name, handle, trade, location, license numbers, reviews) is
          visible to other TraydBook users. You can make your profile private in Settings → Privacy.</p>
          <p style={{ marginTop: 10 }}>We share information with:</p>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li><strong>Supabase</strong> — database and authentication infrastructure</li>
            <li><strong>Stripe</strong> — payment processing</li>
            <li><strong>Telnyx</strong> — SMS notifications (only if you subscribe)</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            We may disclose information if required by law, court order, or to protect the rights and
            safety of our users or the public.
          </p>
        </Section>

        <Section title="5. Data retention">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li><strong>Active accounts:</strong> Data is retained while your account is active</li>
            <li><strong>Frozen accounts:</strong> Data is retained for up to 6 months from the freeze date, then permanently deleted</li>
            <li><strong>Deleted accounts:</strong> Core account data is removed within 30 days. Anonymized activity records (e.g., bid history without personal identifiers) may be retained for up to 12 months for platform integrity purposes</li>
            <li><strong>Payment records:</strong> Retained for 7 years as required by financial regulations</li>
          </ul>
        </Section>

        <Section title="6. Your rights">
          <p>You have the right to:</p>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate information in your profile</li>
            <li>Delete your account (Settings → Danger Zone)</li>
            <li>Export your data — contact us at privacy@traydbook.com</li>
            <li>Opt out of SMS notifications (Settings → Notifications)</li>
            <li>Make your profile private (Settings → Privacy)</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            California residents have additional rights under CCPA. EU/EEA residents have rights under
            GDPR. Contact us at <strong>privacy@traydbook.com</strong> to exercise any of these rights.
          </p>
        </Section>

        <Section title="7. Security">
          All data is transmitted over TLS/HTTPS. Passwords are hashed and never stored in plain text.
          Access to production systems is restricted and logged. Payment data is handled exclusively
          by Stripe and never touches our servers. We conduct regular security reviews and maintain
          access controls to protect your information.
        </Section>

        <Section title="8. Cookies">
          We use essential session cookies to keep you logged in. We do not use third-party
          advertising or tracking cookies. You can clear cookies at any time through your browser
          settings, which will log you out of the platform.
        </Section>

        <Section title="9. Children">
          TraydBook is not intended for users under 18 years of age. We do not knowingly collect
          information from minors. If you believe a minor has created an account, contact us at
          privacy@traydbook.com and we will remove it promptly.
        </Section>

        <Section title="10. Changes to this policy">
          We may update this policy from time to time. When we do, we will update the effective date
          above and, for material changes, notify you by email or in-app notice. Continued use of
          TraydBook after changes constitutes acceptance of the updated policy.
        </Section>

        <Section title="11. Contact">
          <p>For privacy questions or data requests:</p>
          <p style={{ marginTop: 8 }}>
            <strong>Email:</strong> privacy@traydbook.com<br />
            <strong>TraydBook Inc.</strong>
          </p>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontFamily: 'var(--font-condensed)',
          fontSize: 17,
          fontWeight: 800,
          color: 'var(--color-text)',
          marginTop: 0,
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--color-text)', lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  )
}
