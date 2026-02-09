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
          <p><strong>Last updated:</strong> February 9, 2026</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">1. Introduction</h2>
          <p>
            BlitzClaw ("we", "our", "us") respects your privacy. This policy explains how we collect, 
            use, and protect your information when you use our AI assistant deployment service.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">2. Information We Collect</h2>
          
          <h3 className="text-lg font-medium text-white mt-6">Account Information</h3>
          <p>
            When you create an account, we collect your email address and authentication data 
            provided through our authentication provider (Clerk).
          </p>
          
          <h3 className="text-lg font-medium text-white mt-6">Payment Information</h3>
          <p>
            Payment processing is handled by Paddle, our Merchant of Record. We do not store 
            your credit card details. Paddle may collect billing information as described in 
            their privacy policy.
          </p>
          
          <h3 className="text-lg font-medium text-white mt-6">Usage Data</h3>
          <p>
            We collect data about your use of the Service, including API usage, token consumption, 
            and instance activity for billing and service improvement purposes.
          </p>
          
          <h3 className="text-lg font-medium text-white mt-6">Conversation Data</h3>
          <p>
            Messages between you and your AI assistant are processed to provide the Service. 
            Conversations may be stored temporarily for context and are processed by third-party 
            AI providers (Anthropic) according to their data handling policies.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide and maintain the Service</li>
            <li>To process payments and manage subscriptions</li>
            <li>To communicate with you about your account</li>
            <li>To improve and develop new features</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-white mt-8">4. Data Sharing</h2>
          <p>We share data with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Anthropic</strong> — AI model provider (processes conversation content)</li>
            <li><strong>Paddle</strong> — Payment processor (handles billing)</li>
            <li><strong>Clerk</strong> — Authentication provider (handles login)</li>
            <li><strong>Hetzner</strong> — Infrastructure provider (hosts your instance)</li>
          </ul>
          <p>
            We do not sell your personal information to third parties.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">5. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. When you delete your account, 
            we delete your data within 30 days, except where retention is required by law.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">6. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your data. 
            However, no method of transmission over the Internet is 100% secure.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">7. Your Rights</h2>
          <p>Depending on your location, you may have rights to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Delete your data</li>
            <li>Export your data</li>
            <li>Object to certain processing</li>
          </ul>
          <p>
            Contact us at privacy@blitzclaw.com to exercise these rights.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">8. International Transfers</h2>
          <p>
            Your data may be transferred to and processed in countries outside your residence. 
            We ensure appropriate safeguards are in place for such transfers.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">9. Children's Privacy</h2>
          <p>
            The Service is not intended for users under 18. We do not knowingly collect data 
            from children.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">10. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of significant changes 
            via email or through the Service.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">11. Contact</h2>
          <p>
            For privacy-related questions, contact us at privacy@blitzclaw.com
          </p>
        </div>
      </div>
    </div>
  );
}
