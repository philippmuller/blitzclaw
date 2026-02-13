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
          <p><strong>Last updated:</strong> February 13, 2026</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Payment Processing</h2>
          <p>
            All payments for BlitzClaw are processed by Polar.sh ("Polar"), acting as Merchant 
            of Record. Refunds are processed through Polar according to this policy.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">EU Right of Withdrawal</h2>
          <p>
            As an EU consumer, you have a 14-day right of withdrawal for digital services. However, 
            by activating your BlitzClaw instance, you:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Request immediate performance of the service</li>
            <li>Acknowledge that server and AI compute resources are consumed immediately</li>
            <li>Agree to waive the right of withdrawal once the service begins</li>
          </ul>
          <p>
            If you have not yet created an instance, you may request a full refund within 14 days 
            of subscription purchase.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Subscription Refunds</h2>
          <p>
            <strong>Before instance creation:</strong> Full refund within 14 days.
          </p>
          <p>
            <strong>After instance creation:</strong> No refund for the current billing period. 
            You may cancel anytime to prevent future charges. Service continues until period end.
          </p>
          <p>
            <strong>Technical issues:</strong> If we cannot provide functioning service due to 
            our fault for more than 72 consecutive hours, you may request a pro-rata refund for 
            the affected period.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Usage Credits</h2>
          <p>
            AI usage beyond included credits is billed by Polar at the end of each billing cycle. 
            Usage credits that have been consumed represent costs already incurred and are not 
            refundable.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">How to Request a Refund</h2>
          <p>
            Email support@blitzclaw.com with:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your account email</li>
            <li>Reason for refund request</li>
            <li>Order/transaction ID if available</li>
          </ul>
          <p>
            We respond within 5 business days. Approved refunds are processed by Polar and 
            typically appear within 5-10 business days depending on your payment provider.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">Chargebacks</h2>
          <p>
            Please contact us before initiating a chargeback with your bank. Chargebacks for 
            legitimate charges may result in account suspension. We will work with you to resolve 
            billing issues directly.
          </p>
          
          <h2 className="text-xl font-semibold text-white mt-8">Contact</h2>
          <p>
            Billing questions: support@blitzclaw.com
          </p>
        </div>
      </div>
    </div>
  );
}
