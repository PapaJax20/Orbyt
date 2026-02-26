import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Orbyt privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "February 25, 2026";

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-accent">
            Orbyt
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted hover:text-text transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted text-sm mb-10">Last updated: {lastUpdated}</p>

        <div className="space-y-8 text-text/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Orbyt (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Orbyt
              household management platform available at orbythq.com (the &quot;Service&quot;).
              This Privacy Policy explains how we collect, use, disclose, and safeguard
              your information when you use our Service. By using Orbyt, you consent to
              the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">Account Information</h3>
            <p>
              When you create an account, we collect your email address, display name,
              and optional profile information such as an avatar selection and theme
              preference.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">Household Data</h3>
            <p>
              Data you enter into Orbyt including calendar events, tasks, shopping lists,
              contacts, financial records (accounts, transactions, budgets, bills, savings
              goals), and related notes or attachments.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">Financial Data via Plaid</h3>
            <p>
              If you choose to connect a bank account, we use{" "}
              <a
                href="https://plaid.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                Plaid Inc.
              </a>{" "}
              to securely access your financial institution. Plaid may collect and transmit
              your financial data including account balances, transaction history, and
              account metadata (account name, type, and last four digits). We never
              receive or store your bank login credentials — Plaid handles all
              authentication directly.
            </p>
            <p className="mt-2">
              By connecting your bank through Plaid, you acknowledge and agree to{" "}
              <a
                href="https://plaid.com/legal/#end-user-privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                Plaid&apos;s End User Privacy Policy
              </a>.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">Connected Calendar Data</h3>
            <p>
              If you connect Google Calendar or Microsoft Outlook, we import event data
              (title, time, location, attendees) to display alongside your Orbyt calendar.
              OAuth tokens for these services are encrypted at rest.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">Usage &amp; Device Data</h3>
            <p>
              We collect standard log data including IP address, browser type, device
              information, and pages visited to maintain security and improve the Service.
              We use Sentry for error monitoring, which may capture technical diagnostics
              when errors occur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, operate, and maintain the Service</li>
              <li>To sync financial data from your connected bank accounts</li>
              <li>To sync calendar events from connected Google or Microsoft accounts</li>
              <li>To send notifications and reminders you have configured</li>
              <li>To improve the Service and develop new features</li>
              <li>To detect, prevent, and address technical issues and security threats</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal data. We do not use your financial data for
              advertising or share it with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Sharing &amp; Third Parties</h2>
            <p>We share data only with the following categories of service providers:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Plaid Inc.</strong> — Financial data aggregation (bank account
                connections, transactions, balances)
              </li>
              <li>
                <strong>Supabase</strong> — Database hosting, authentication, and file
                storage
              </li>
              <li>
                <strong>Vercel</strong> — Application hosting and content delivery
              </li>
              <li>
                <strong>Sentry</strong> — Error monitoring and diagnostics
              </li>
              <li>
                <strong>Google / Microsoft</strong> — Calendar sync (only if you connect
                your calendar)
              </li>
            </ul>
            <p className="mt-3">
              We may also disclose information if required by law, subpoena, or to
              protect the rights, safety, or property of Orbyt or its users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
            <p>We implement the following security measures to protect your data:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                All data in transit is encrypted via TLS 1.2+ with HSTS enforced
              </li>
              <li>
                Sensitive credentials (OAuth tokens, Plaid access tokens) are encrypted
                at rest using AES-256-GCM
              </li>
              <li>
                Row-Level Security (RLS) policies enforce data isolation between
                households at the database level
              </li>
              <li>
                Content Security Policy (CSP), X-Frame-Options, and other security
                headers are enforced on all pages
              </li>
              <li>
                All API inputs are validated and sanitized using schema validation
              </li>
              <li>
                Bank credentials are never transmitted to or stored by Orbyt — Plaid
                handles all bank authentication
              </li>
            </ul>
            <p className="mt-3">
              While we strive to protect your data, no method of electronic transmission
              or storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention &amp; Deletion</h2>
            <p>
              We retain your data for as long as your account is active and as needed to
              provide the Service. You can request data deletion at any time by contacting
              us.
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Bank connections:</strong> You can disconnect a bank at any time
                from Settings. Disconnecting revokes the access token at Plaid and removes
                the connection from your account.
              </li>
              <li>
                <strong>Calendar connections:</strong> You can disconnect Google or
                Microsoft calendar at any time. Disconnecting revokes OAuth tokens and
                removes imported events.
              </li>
              <li>
                <strong>Account deletion:</strong> Upon account deletion, all personal
                data and household data you own is permanently deleted from our systems.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent for data processing</li>
              <li>Disconnect third-party services (Plaid, Google, Microsoft) at any time</li>
              <li>Request a portable copy of your data</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Children&apos;s Privacy</h2>
            <p>
              Orbyt is not directed to children under 13. We do not knowingly collect
              personal information from children under 13. If you believe a child has
              provided us with personal data, please contact us and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users
              of material changes by updating the &quot;Last updated&quot; date at the top of this
              page. Your continued use of the Service after changes constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your data, contact us at:
            </p>
            <p className="mt-2 font-medium">
              <a href="mailto:privacy@orbythq.com" className="text-accent underline">
                privacy@orbythq.com
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border text-muted text-sm">
          <p>&copy; {new Date().getFullYear()} Orbyt. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
