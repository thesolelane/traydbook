export default function Terms() {
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
        Terms of Service
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 40 }}>
        Effective date: January 1, 2025 &nbsp;·&nbsp; Last updated: May 2025
      </p>

      <div style={{ fontSize: 15, color: 'var(--color-text)', lineHeight: 1.75 }}>
        <Section title="1. Acceptance of terms">
          By creating an account or using TraydBook, you agree to these Terms of Service and our
          Privacy Policy. If you do not agree, do not use the platform. TraydBook is intended for
          construction industry professionals and project owners aged 18 and over.
        </Section>

        <Section title="2. Accounts">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>You must provide accurate and complete information when registering</li>
            <li>You are responsible for maintaining the security of your account and password</li>
            <li>You may not share your account or credentials with others</li>
            <li>One person or entity may not maintain more than one active account</li>
            <li>You must notify us immediately of any unauthorized account access</li>
          </ul>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree not to:</p>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>Post false, misleading, or fraudulent information</li>
            <li>Impersonate any person, contractor, license holder, or business</li>
            <li>Claim credentials, licenses, or certifications you do not hold</li>
            <li>Harass, threaten, or abuse other users</li>
            <li>Spam, solicit, or send unsolicited commercial messages</li>
            <li>Scrape, crawl, or extract data from the platform without permission</li>
            <li>Attempt to access other users' accounts or private data</li>
            <li>Use the platform for any unlawful purpose</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            TraydBook reserves the right to remove content and suspend or terminate accounts that
            violate these terms, at our sole discretion.
          </p>
        </Section>

        <Section title="4. Credits and payments">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>
              Credits are purchased through Stripe and used to access platform features (posting
              RFQs, messaging, boosting listings)
            </li>
            <li>Credits are non-refundable except where required by applicable law</li>
            <li>Credits have no cash value and cannot be transferred between accounts</li>
            <li>
              TraydBook may change credit pricing or the cost of actions with reasonable notice
            </li>
            <li>
              SMS notification subscriptions are billed monthly and can be cancelled at any time
              from Settings
            </li>
          </ul>
        </Section>

        <Section title="5. Content ownership">
          <p>
            You retain ownership of content you post on TraydBook. By posting, you grant TraydBook a
            non-exclusive, worldwide, royalty-free license to display, distribute, and promote your
            content as part of operating the platform.
          </p>
          <p style={{ marginTop: 10 }}>
            You are solely responsible for the content you post. Do not post content that infringes
            on the intellectual property rights of others.
          </p>
        </Section>

        <Section title="6. Verified badges and credentials">
          <p>
            TraydBook's verification system (Pro Verified, Licensed, Vouched badges) is designed to
            help establish trust, but{' '}
            <strong>we do not guarantee the accuracy of any credential</strong> displayed on the
            platform. License verification relies on publicly available records and user-submitted
            documents. Always perform your own due diligence before hiring or contracting with any
            individual through TraydBook.
          </p>
          <p style={{ marginTop: 10 }}>
            Submitting false credentials for verification is a violation of these terms and may
            result in immediate account termination and referral to relevant licensing authorities.
          </p>
        </Section>

        <Section title="7. Contractor relationships">
          TraydBook is a marketplace platform only. We are not a party to any contract, agreement,
          or employment relationship formed between users through the platform. Any disputes between
          contractors and project owners are between those parties. TraydBook is not responsible for
          the quality, timeliness, or legality of any work arranged through the platform.
        </Section>

        <Section title="8. Account termination">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>
              You may freeze your account (data held for 6 months) or delete it at any time in
              Settings → Danger Zone
            </li>
            <li>TraydBook may suspend or terminate your account for violations of these terms</li>
            <li>Upon termination, your right to access the platform ceases immediately</li>
            <li>
              Sections of these terms that should survive termination (liability, disputes) will do
              so
            </li>
          </ul>
        </Section>

        <Section title="9. Disclaimer of warranties">
          TraydBook is provided "as is" without warranties of any kind, express or implied. We do
          not guarantee uninterrupted access, error-free operation, or that the platform will meet
          your specific requirements. Use of TraydBook is at your own risk.
        </Section>

        <Section title="10. Limitation of liability">
          To the maximum extent permitted by law, TraydBook shall not be liable for any indirect,
          incidental, special, or consequential damages arising from your use of the platform,
          including lost profits, loss of data, or damages resulting from interactions with other
          users. Our total liability to you for any claim shall not exceed the amount you paid us in
          the 12 months preceding the claim.
        </Section>

        <Section title="11. Governing law">
          These terms are governed by the laws of the State of [State], United States, without
          regard to conflict of law principles. Any disputes shall be resolved in the courts located
          in [State].
        </Section>

        <Section title="12. Changes to these terms">
          We may update these terms from time to time. Continued use of the platform after changes
          are posted constitutes acceptance. We will notify you of material changes by email or
          in-app notice at least 7 days before they take effect.
        </Section>

        <Section title="13. Contact">
          <p>Questions about these terms:</p>
          <p style={{ marginTop: 8 }}>
            <strong>Email:</strong> legal@traydbook.com
            <br />
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
      <div style={{ fontSize: 14, color: 'var(--color-text)', lineHeight: 1.75 }}>{children}</div>
    </div>
  )
}
