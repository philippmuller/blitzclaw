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
          <p><strong>Last updated:</strong> February 9, 2026</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">1. Acceptance of Terms</h2>
          <p>
            By accessing or using BlitzClaw ("Service"), you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, do not use the Service.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">2. Description of Service</h2>
          <p>
            BlitzClaw provides AI assistant deployment services, allowing users to create and manage 
            AI-powered chatbots connected to messaging platforms like Telegram. The Service includes 
            server provisioning, AI model access, and related infrastructure.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">3. Account Registration</h2>
          <p>
            You must create an account to use the Service. You are responsible for maintaining the 
            confidentiality of your account credentials and for all activities under your account.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">4. Billing and Payment</h2>
          <p>
            The Service operates on a subscription model with usage-based pricing. You agree to pay 
            all fees associated with your use of the Service. Payments are processed by Paddle, our 
            Merchant of Record. All fees are non-refundable except as described in our Refund Policy.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">5. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Violate any laws or regulations</li>
            <li>Infringe on intellectual property rights</li>
            <li>Distribute malware or harmful content</li>
            <li>Harass, abuse, or harm others</li>
            <li>Generate illegal, harmful, or deceptive content</li>
            <li>Attempt to bypass usage limits or security measures</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-white mt-8">6. Service Availability</h2>
          <p>
            We strive to maintain high availability but do not guarantee uninterrupted service. 
            We may modify, suspend, or discontinue features at any time with reasonable notice.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">7. Data and Privacy</h2>
          <p>
            Your use of the Service is subject to our Privacy Policy. You retain ownership of your 
            data. We process data as necessary to provide the Service.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, BlitzClaw shall not be liable for any indirect, 
            incidental, special, consequential, or punitive damages, or any loss of profits or revenues.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">9. Termination</h2>
          <p>
            We may terminate or suspend your account for violations of these terms. You may cancel 
            your subscription at any time through the dashboard or by contacting support.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">10. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the Service after changes 
            constitutes acceptance of the new terms.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">11. Contact</h2>
          <p>
            For questions about these terms, contact us at support@blitzclaw.com
          </p>
        </div>
      </div>
    </div>
  );
}
