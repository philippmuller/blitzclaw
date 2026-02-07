import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "@blitzclaw/db";
import { InstanceCard } from "@/components";

export default async function InstancesPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
    include: {
      instances: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) return null;

  const instances = user.instances;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Instances</h1>
          <p className="text-muted-foreground mt-1">
            Manage your AI assistant instances.
          </p>
        </div>
        <Link
          href="/dashboard/instances/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Instance
        </Link>
      </div>

      {/* Instances Grid */}
      {instances.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No instances yet
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create your first AI assistant instance to get started.
          </p>
          <Link
            href="/dashboard/instances/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Instance
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              id={instance.id}
              status={instance.status}
              channelType={instance.channelType}
              personaTemplate={instance.personaTemplate}
              ipAddress={instance.ipAddress}
              createdAt={instance.createdAt.toISOString()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
