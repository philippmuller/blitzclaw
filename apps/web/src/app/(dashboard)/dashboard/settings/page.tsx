import { currentUser } from "@clerk/nextjs/server";
import { UserProfile } from "@clerk/nextjs";
import { prisma } from "@blitzclaw/db";

export default async function SettingsPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
    include: {
      balance: true,
      _count: { select: { instances: true } },
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences.
        </p>
      </div>

      {/* Account Overview */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Account Overview</h2>
        <div className="space-y-4">
          <div className="flex justify-between py-3 border-b border-border">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground">
              {clerkUser.emailAddresses[0]?.emailAddress}
            </span>
          </div>
          <div className="flex justify-between py-3 border-b border-border">
            <span className="text-muted-foreground">Account ID</span>
            <span className="font-mono text-sm text-foreground">{user?.id.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border">
            <span className="text-muted-foreground">Total Instances</span>
            <span className="font-medium text-foreground">{user?._count.instances || 0}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-muted-foreground">Member Since</span>
            <span className="font-medium text-foreground">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Coming Soon Features */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Coming Soon</h2>
        <div className="space-y-4">
          <div className="p-4 bg-secondary/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔑</div>
              <div>
                <h3 className="font-medium text-foreground">Bring Your Own API Key</h3>
                <p className="text-sm text-muted-foreground">
                  Use your own Anthropic or OpenAI API key to bypass our proxy billing.
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-secondary/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📧</div>
              <div>
                <h3 className="font-medium text-foreground">Google Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Connect Gmail and Calendar to give your AI access to your inbox and schedule.
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-secondary/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔄</div>
              <div>
                <h3 className="font-medium text-foreground">Auto Top-up</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically add credits when your balance drops below a threshold.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clerk User Profile */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Account Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage your profile, security, and connected accounts.
          </p>
        </div>
        <div className="p-6">
          <UserProfile
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none border-0",
                navbar: "hidden",
                pageScrollBox: "p-0",
                profileSection: "border-border",
                profileSectionHeader: "border-border",
                profileSectionPrimaryButton: "bg-primary text-primary-foreground hover:bg-primary/90",
              },
            }}
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card border border-red-500/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Irreversible actions that affect your account and data.
        </p>
        <button
          disabled
          className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 font-medium rounded-lg hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete Account (Coming Soon)
        </button>
      </div>
    </div>
  );
}
