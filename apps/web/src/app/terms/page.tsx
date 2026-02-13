import Link from "next/link";

export const metadata = {
  title: "Terms of Service | BlitzClaw",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="text-blue-400 hover:underline mb-8 inline-block">
          ← Back to BlitzClaw
        </Link>
        
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300">
          <p><strong>Last updated:</strong> February 13, 2026</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">1. Scope and Provider</h2>
          <p>
            These Terms of Service ("Terms") govern your use of BlitzClaw, an AI assistant deployment 
            service provided by:
          </p>
          <p>
            <strong>2M Ventures UG (haftungsbeschränkt)</strong><br />
            Hohenstaufenstr. 22, 10779 Berlin, Germany<br />
            ("we", "us", "BlitzClaw")
          </p>
          <p>
            By using BlitzClaw, you agree to these Terms. If you do not agree, do not use the service.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">2. Service Description</h2>
          <p>
            BlitzClaw provides cloud-hosted AI assistant instances. Each instance runs on dedicated 
            infrastructure and connects to messaging platforms (currently Telegram). The AI capabilities 
            are powered by third-party AI models.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">3. Payment and Merchant of Record</h2>
          <p>
            <strong>Important:</strong> All payments for BlitzClaw subscriptions are processed by 
            Polar.sh ("Polar"), acting as Merchant of Record. When you subscribe to BlitzClaw:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You enter into a payment contract directly with Polar</li>
            <li>Polar handles all billing, invoicing, tax collection, and payment processing</li>
            <li>Polar's terms of service and privacy policy apply to payment processing</li>
            <li>Refund requests are handled according to Polar's policies and our Refund Policy</li>
          </ul>
          <p>
            We provide the technical service; Polar handles the commercial transaction.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">4. Third-Party AI Processing — Anthropic</h2>
          <p className="bg-yellow-900/30 border border-yellow-600/50 p-4 rounded-lg">
            <strong>⚠️ Important Notice:</strong> BlitzClaw uses AI models provided by Anthropic, PBC 
            ("Anthropic"). All content you send to or through your AI assistant — including messages, 
            files, and any data the assistant accesses — is transmitted to and processed by Anthropic's 
            systems.
          </p>
          <p>By using BlitzClaw, you acknowledge and agree that:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your conversation data is sent to Anthropic for AI processing</li>
            <li>Anthropic's <a href="https://www.anthropic.com/legal/aup" className="text-blue-400 hover:underline" target="_blank" rel="noopener">Acceptable Use Policy</a> applies to your use</li>
            <li>Anthropic's <a href="https://www.anthropic.com/legal/privacy" className="text-blue-400 hover:underline" target="_blank" rel="noopener">Privacy Policy</a> governs how Anthropic handles your data</li>
            <li>Anthropic may retain and use data as described in their policies</li>
            <li>You are responsible for ensuring your use complies with Anthropic's policies</li>
          </ul>
          <p>
            We have no control over Anthropic's data handling practices. Review their policies before use.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">5. Prohibited Content and Use</h2>
          <p>
            You must not use BlitzClaw to create, process, store, or distribute:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Child sexual abuse material (CSAM) or any sexualized content involving minors</li>
            <li>Content promoting terrorism, violence, or incitement to hatred</li>
            <li>Non-consensual intimate imagery</li>
            <li>Content infringing third-party intellectual property rights</li>
            <li>Malware, phishing content, or tools for cyberattacks</li>
            <li>Fraudulent or deceptive content designed to mislead</li>
            <li>Illegal goods or services</li>
            <li>Content violating applicable laws in Germany, the EU, or your jurisdiction</li>
          </ul>
          <p>
            We may suspend or terminate your account immediately and without notice for violations. 
            We may report illegal content to law enforcement where required by law.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">6. Your Responsibilities</h2>
          <p>You are solely responsible for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>All content you create, upload, or process through your instance</li>
            <li>Ensuring your use complies with applicable laws</li>
            <li>Maintaining the security of your account credentials</li>
            <li>Any secrets, API keys, or credentials you store in your instance</li>
            <li>How you use the AI assistant's outputs</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8">7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>BlitzClaw is provided "as is" without warranties of any kind</li>
            <li>We are not liable for AI outputs, their accuracy, or fitness for any purpose</li>
            <li>We are not liable for data loss, service interruptions, or security breaches</li>
            <li>We are not liable for indirect, incidental, special, or consequential damages</li>
            <li>Our total liability is limited to the fees you paid in the 3 months before the claim</li>
          </ul>
          <p>
            These limitations do not affect mandatory consumer rights under EU law or liability that 
            cannot be excluded under applicable law.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">8. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless 2M Ventures UG from any claims, damages, or 
            expenses arising from your use of the service, your content, or your violation of these 
            Terms or applicable law.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">9. Service Availability</h2>
          <p>
            We do not guarantee uninterrupted or error-free service. We may modify, suspend, or 
            discontinue features with reasonable notice where possible. For planned maintenance, 
            we will notify active users in advance.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">10. Termination</h2>
          <p>
            You may cancel your subscription at any time via the dashboard. Cancellation takes 
            effect at the end of your current billing period.
          </p>
          <p>
            We may terminate or suspend your account immediately for:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Violation of these Terms or applicable law</li>
            <li>Prohibited content or use</li>
            <li>Non-payment</li>
            <li>At our discretion, with 30 days notice for other reasons</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8">11. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. Material changes will be notified via email to 
            your registered address at least 14 days before taking effect. Continued use after 
            changes constitutes acceptance.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">12. Governing Law and Jurisdiction</h2>
          <p>
            These Terms are governed by German law. For consumers in the EU, mandatory consumer 
            protection laws of your country of residence apply where they provide greater protection.
          </p>
          <p>
            Disputes shall be resolved in the courts of Berlin, Germany, unless mandatory law 
            requires otherwise for consumer disputes.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">13. Severability</h2>
          <p>
            If any provision of these Terms is found invalid, the remaining provisions continue 
            in full force. The invalid provision shall be replaced with a valid provision that 
            most closely achieves the original intent.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">14. Contact</h2>
          <p>
            For questions about these Terms:<br />
            Email: support@blitzclaw.com<br />
            Address: 2M Ventures UG, Hohenstaufenstr. 22, 10779 Berlin, Germany
          </p>
        </div>
      </div>
    </div>
  );
}
