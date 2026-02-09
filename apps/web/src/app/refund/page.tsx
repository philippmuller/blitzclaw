import Link from "next/link";

export const metadata = {
  title: "Refund Policy | BlitzClaw",
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="text-blue-400 hover:underline mb-8 inline-block">
          ← Back to BlitzClaw
        </Link>
        
        <h1 className="text-3xl font-bold mb-8">Refund Policy</h1>
        
        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300">
          <p><strong>Last updated:</strong> February 9, 2026</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Overview</h2>
          <p>
            BlitzClaw operates on a subscription model. We want you to be satisfied with 
            our service, but due to the nature of server and AI compute costs, refunds are limited.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Subscription Refunds</h2>
          <p>
            If you cancel within the first 7 days of your initial subscription and have not 
            created an instance, you may request a full refund of the subscription fee.
          </p>
          <p>
            After the 7-day period, subscription fees are non-refundable, but you can cancel anytime 
            to prevent future charges. Your service will continue until the end of the billing period.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Credit/Top-up Refunds</h2>
          <p>
            For plans that include credits or top-ups:
          </p>
          <p>
            <strong>Unused credits:</strong> If you have unused credits and wish to close your account, 
            we may issue a partial refund for unused credits at our discretion, minus a 20% processing fee.
          </p>
          <p>
            <strong>Used credits:</strong> Credits that have been consumed (for AI model usage, compute, 
            etc.) are non-refundable as these costs have been incurred.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Service Issues</h2>
          <p>
            If you experience significant service issues or downtime that prevents you from using 
            BlitzClaw, contact us at support@blitzclaw.com. We will evaluate refund requests on a 
            case-by-case basis and may offer:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Service credits for future use</li>
            <li>Partial refunds for affected periods</li>
            <li>Extended subscription time</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-white mt-8">How to Request a Refund</h2>
          <p>
            To request a refund, email support@blitzclaw.com with:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your account email</li>
            <li>Reason for the refund request</li>
            <li>Any relevant details about the issue</li>
          </ul>
          <p>
            We aim to respond to refund requests within 3 business days.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Payment Processor</h2>
          <p>
            Refunds are processed through Creem, our payment processor. Refunds typically appear 
            on your statement within 5-10 business days, depending on your bank or card issuer.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Contact</h2>
          <p>
            For refund requests or billing questions, contact us at support@blitzclaw.com
          </p>
        </div>
      </div>
    </div>
  );
}
