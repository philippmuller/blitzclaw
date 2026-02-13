import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | BlitzClaw",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="text-blue-400 hover:underline mb-8 inline-block">
          ← Back to BlitzClaw
        </Link>
        
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300">
          <p><strong>Last updated:</strong> February 13, 2026</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">1. Data Controller</h2>
          <p>
            The data controller for BlitzClaw is:
          </p>
          <p>
            <strong>2M Ventures UG (haftungsbeschränkt)</strong><br />
            Geschäftsführer: Philipp Müller<br />
            Hohenstaufenstr. 22, 10779 Berlin, Germany<br />
            Email: privacy@blitzclaw.com
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">2. Data We Collect</h2>
          
          <h3 className="text-lg font-medium text-white mt-6">Account Data</h3>
          <p>
            Email address and authentication credentials (processed via Clerk).
          </p>
          
          <h3 className="text-lg font-medium text-white mt-6">Instance Configuration</h3>
          <p>
            Settings you configure for your AI assistant: name, personality, connected services.
          </p>
          
          <h3 className="text-lg font-medium text-white mt-6">Usage Data</h3>
          <p>
            API usage metrics, token consumption, instance status — for billing and service operation.
          </p>
          
          <h3 className="text-lg font-medium text-white mt-6">Conversation Data</h3>
          <p>
            Messages exchanged with your AI assistant are processed to provide the service. See 
            Section 3 for important information about third-party processing.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">3. Third-Party Data Processing</h2>
          
          <div className="bg-yellow-900/30 border border-yellow-600/50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-white mt-2">⚠️ Anthropic (AI Provider)</h3>
            <p className="mt-2">
              <strong>All content you send to your AI assistant is transmitted to Anthropic, PBC 
              (San Francisco, USA) for processing.</strong> This includes:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>All messages you send</li>
              <li>Files or data you share with or through the assistant</li>
              <li>Content the assistant accesses on your behalf (websites, documents)</li>
              <li>Any secrets or credentials you instruct the assistant to use</li>
            </ul>
            <p className="mt-2">
              Anthropic processes this data under their own privacy policy and terms. We cannot 
              control how Anthropic stores, processes, or uses your data. Review Anthropic's 
              policies: <a href="https://www.anthropic.com/legal/privacy" className="text-blue-400 hover:underline" target="_blank" rel="noopener">anthropic.com/legal/privacy</a>
            </p>
            <p className="mt-2">
              <strong>Data transfer:</strong> Your data is transferred to the USA. Anthropic 
              participates in standard contractual clauses for EU-US data transfers.
            </p>
          </div>

          <h3 className="text-lg font-medium text-white mt-6">Polar.sh (Payment Processing)</h3>
          <p>
            Polar acts as Merchant of Record for all payments. Polar collects billing information 
            including payment method details. We do not store your payment card data.
            See: <a href="https://polar.sh/legal/privacy" className="text-blue-400 hover:underline" target="_blank" rel="noopener">polar.sh/legal/privacy</a>
          </p>

          <h3 className="text-lg font-medium text-white mt-6">Clerk (Authentication)</h3>
          <p>
            Clerk processes your login credentials and manages authentication sessions.
            See: <a href="https://clerk.com/legal/privacy" className="text-blue-400 hover:underline" target="_blank" rel="noopener">clerk.com/legal/privacy</a>
          </p>

          <h3 className="text-lg font-medium text-white mt-6">Infrastructure Providers</h3>
          <p>
            Your instance runs on servers provided by Hetzner, DigitalOcean, or Vultr (EU/Germany 
            datacenter). These providers have physical access to server infrastructure but not 
            to application-level data which is encrypted.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">4. Legal Basis for Processing (GDPR Art. 6)</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Contract performance (Art. 6(1)(b)):</strong> Processing necessary to provide the service you requested</li>
            <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> Service security, fraud prevention, service improvement</li>
            <li><strong>Legal obligation (Art. 6(1)(c)):</strong> Tax records, law enforcement requests</li>
            <li><strong>Consent (Art. 6(1)(a)):</strong> For optional processing, where applicable</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8">5. Data Retention</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account data:</strong> Until account deletion plus 30 days</li>
            <li><strong>Instance data:</strong> Deleted within 7 days of instance termination</li>
            <li><strong>Billing records:</strong> 10 years (German tax law requirement)</li>
            <li><strong>Conversation data on your instance:</strong> You control this; deleted when instance is deleted</li>
          </ul>
          <p>
            Note: Data sent to Anthropic is retained according to Anthropic's policies, which we 
            cannot control.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">6. Your Rights (GDPR)</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Access (Art. 15):</strong> Request a copy of your personal data</li>
            <li><strong>Rectification (Art. 16):</strong> Correct inaccurate data</li>
            <li><strong>Erasure (Art. 17):</strong> Request deletion of your data</li>
            <li><strong>Restriction (Art. 18):</strong> Limit how we process your data</li>
            <li><strong>Portability (Art. 20):</strong> Receive your data in machine-readable format</li>
            <li><strong>Object (Art. 21):</strong> Object to processing based on legitimate interest</li>
            <li><strong>Withdraw consent:</strong> Where processing is based on consent</li>
          </ul>
          <p>
            Contact privacy@blitzclaw.com to exercise these rights. We respond within 30 days.
          </p>
          <p>
            <strong>Supervisory authority:</strong> You may lodge a complaint with the Berlin 
            Commissioner for Data Protection (Berliner Beauftragte für Datenschutz und Informationsfreiheit).
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">7. International Transfers</h2>
          <p>
            Your data is transferred to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>USA (Anthropic):</strong> Conversation data for AI processing</li>
            <li><strong>USA (Clerk):</strong> Authentication data</li>
            <li><strong>EU/USA (Polar):</strong> Payment data</li>
          </ul>
          <p>
            For US transfers, we rely on Standard Contractual Clauses (SCCs) where available from 
            the provider. You acknowledge that US law may provide different data protection standards 
            than EU law.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">8. Security</h2>
          <p>
            We implement technical and organizational measures including:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>TLS encryption for data in transit</li>
            <li>Encrypted storage for sensitive data</li>
            <li>Access controls and authentication</li>
            <li>Regular security monitoring</li>
          </ul>
          <p>
            No system is 100% secure. You are responsible for securing your account credentials 
            and any secrets you store in your instance.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">9. Children</h2>
          <p>
            BlitzClaw is not intended for users under 18. We do not knowingly collect data from 
            minors. If you believe a minor has provided data, contact us for deletion.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">10. Changes</h2>
          <p>
            We may update this policy. Material changes will be notified via email at least 14 
            days before taking effect.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">11. Contact</h2>
          <p>
            For privacy inquiries: privacy@blitzclaw.com<br />
            General support: support@blitzclaw.com
          </p>
        </div>
      </div>
    </div>
  );
}
