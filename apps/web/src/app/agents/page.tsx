"use client";

import Link from "next/link";

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-foreground">
            ⚡ BlitzClaw
          </a>
          <div className="flex items-center gap-4">
            <Link
              href="/guide"
              className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
            >
              Startup Guide
            </Link>
            <span className="px-4 py-2 text-foreground bg-secondary rounded-lg">
              What Are Agents?
            </span>
            <a
              href="/sign-up"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
            >
              Create Your Agent →
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          One Assistant. Many Specialists.
        </h1>
        <p className="text-xl text-muted-foreground mb-12">
          Your main agent can spawn sub-agents — specialized workers for specific tasks.
          Think of it as building your own AI team.
        </p>

        {/* Main Agent */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">🤖</span> The Main Agent
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              When you deploy BlitzClaw, you get a <strong className="text-foreground">main agent</strong>. 
              This is who you talk to on Telegram. It handles your day-to-day requests, remembers 
              your preferences, and manages your workspace.
            </p>
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-sm text-foreground font-medium mb-2">The main agent:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Maintains long-term memory across sessions</li>
                <li>• Has full access to tools (web search, files, browser)</li>
                <li>• Responds to your messages directly</li>
                <li>• Can delegate work to sub-agents</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Sub-Agents */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">👥</span> What Are Sub-Agents?
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Sub-agents are <strong className="text-foreground">isolated workers</strong> that run 
              specific tasks in the background. They have their own context, can use different models, 
              and report back when done.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-2">🔬 Research Agent</p>
                <p className="text-xs text-muted-foreground">
                  "Deep dive into competitor pricing and summarize findings"
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-2">✍️ Writing Agent</p>
                <p className="text-xs text-muted-foreground">
                  "Draft 5 variations of this email, different tones"
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-2">📊 Analysis Agent</p>
                <p className="text-xs text-muted-foreground">
                  "Review this data and find anomalies"
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-2">🔄 Monitor Agent</p>
                <p className="text-xs text-muted-foreground">
                  "Check this website daily and alert me to changes"
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why Sub-Agents */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">💡</span> Why Use Sub-Agents?
          </h2>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="text-2xl">⚡</div>
                <div>
                  <p className="font-medium text-foreground">Parallel Work</p>
                  <p className="text-sm text-muted-foreground">
                    Main agent stays responsive while sub-agents work in the background. 
                    Start a research task and keep chatting.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-2xl">🎯</div>
                <div>
                  <p className="font-medium text-foreground">Focused Context</p>
                  <p className="text-sm text-muted-foreground">
                    Sub-agents start fresh without your chat history. Better focus, 
                    no confusion from unrelated conversations.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-2xl">💰</div>
                <div>
                  <p className="font-medium text-foreground">Cost Control</p>
                  <p className="text-sm text-muted-foreground">
                    Use cheaper models (Haiku) for routine tasks. Save Opus for complex reasoning.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-2xl">🔒</div>
                <div>
                  <p className="font-medium text-foreground">Isolation</p>
                  <p className="text-sm text-muted-foreground">
                    Sub-agents can't access your main memory. Good for sensitive or experimental tasks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Creating Sub-Agents */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">🛠️</span> Creating Sub-Agents
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Just ask your main agent. It knows how to delegate.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Spawn a sub-agent to research the top 10 CRM tools for startups. Report back when done."</span>
              </div>
              <div className="flex gap-3">
                <span className="text-blue-400">Agent:</span>
                <span className="text-foreground italic">"I've started a research agent on that task. I'll message you when it completes (usually 2-5 minutes for this kind of research)."</span>
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 mt-4">
              <p className="text-sm text-foreground font-medium mb-2">Tips:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Be specific about what you want back</li>
                <li>• Mention if you want a specific model ("use Haiku for this")</li>
                <li>• Sub-agents auto-announce results to your chat</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Automation / Cron */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">⏰</span> Scheduled Tasks
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Sub-agents can run on a schedule. Set up recurring tasks that work while you sleep.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Every morning at 8am, check Hacker News for AI news and send me a summary."</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Every Friday at 5pm, compile my week's notes into a summary."</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Check my competitor's pricing page daily. Alert me if anything changes."</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              The agent sets up cron jobs that spawn sub-agents at the scheduled times. 
              Results come to your Telegram automatically.
            </p>
          </div>
        </section>

        {/* SOUL.md */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">✨</span> SOUL.md — The Agent's Personality
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Every agent has a <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground">SOUL.md</code> file — 
              instructions that define who it is. This is where personality, tone, and operating principles live.
            </p>
            <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm">
              <p className="text-muted-foreground"># SOUL.md</p>
              <p className="text-foreground mt-2">You are a direct, no-nonsense assistant.</p>
              <p className="text-foreground">Skip pleasantries. Get to the point.</p>
              <p className="text-foreground">When uncertain, ask one clarifying question.</p>
              <p className="text-foreground">Never apologize for being helpful.</p>
            </div>
            <p className="text-sm text-muted-foreground">
              You can edit SOUL.md through your dashboard or by asking your agent to update it. 
              Changes take effect immediately.
            </p>
          </div>
        </section>

        {/* Presets & Specialists */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">🎭</span> Presets & Specialist Personalities
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Don't start from scratch. Use <strong className="text-foreground">presets</strong> — 
              pre-configured personalities and skills for common use cases.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-1">📝 Content Writer</p>
                <p className="text-xs text-muted-foreground">
                  SEO-aware, adapts to brand voice, handles blogs to social posts
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-1">💻 Code Reviewer</p>
                <p className="text-xs text-muted-foreground">
                  Security-focused, knows common patterns, suggests improvements
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-1">📊 Data Analyst</p>
                <p className="text-xs text-muted-foreground">
                  Finds patterns, creates summaries, explains insights clearly
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-1">🎯 Sales Assistant</p>
                <p className="text-xs text-muted-foreground">
                  Drafts outreach, researches prospects, tracks follow-ups
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-1">📚 Research Specialist</p>
                <p className="text-xs text-muted-foreground">
                  Deep dives, synthesizes sources, cites everything
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-1">🤝 Meeting Assistant</p>
                <p className="text-xs text-muted-foreground">
                  Takes notes, extracts action items, sends summaries
                </p>
              </div>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mt-4">
              <p className="text-sm text-foreground">
                <strong>Browse presets at{" "}
                <a 
                  href="https://www.agentpresets.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  agentpresets.ai
                </a>
                </strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Community-curated agent configurations. Available now for self-hosted OpenClaw instances, 
                coming soon to BlitzClaw with one-click install.
              </p>
            </div>
          </div>
        </section>

        {/* Teams of Specialists */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">👥</span> Teams of Specialists
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Combine specialists into <strong className="text-foreground">teams</strong> that work together on complex workflows.
            </p>
            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-2">🚀 Product Launch Team</p>
                <p className="text-xs text-muted-foreground">
                  Research Agent → Content Writer → Social Media Manager
                </p>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  "Research competitors, write launch copy, schedule social posts"
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-2">📈 Growth Team</p>
                <p className="text-xs text-muted-foreground">
                  Monitor Agent → Analyst → Sales Assistant
                </p>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  "Track mentions, analyze sentiment, draft outreach to engaged users"
                </p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-2">📝 Content Pipeline</p>
                <p className="text-xs text-muted-foreground">
                  Research Specialist → Content Writer → Editor Agent
                </p>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  "Research topic, write draft, review and polish"
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Future: Inter-Agent Communication */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">🔮</span> The Future: Full Autonomy
          </h2>
          <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Today, you orchestrate. Tomorrow, agents coordinate themselves.
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 items-start">
                <span className="text-primary">→</span>
                <span className="text-foreground">
                  Agents hand off work to each other automatically
                </span>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-primary">→</span>
                <span className="text-foreground">
                  Teams self-organize based on task requirements
                </span>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-primary">→</span>
                <span className="text-foreground">
                  You set goals, they figure out the steps
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Inter-agent communication is coming. Your role shifts from operator to <strong className="text-foreground">director</strong> — 
              setting vision and reviewing outcomes while your AI team handles execution.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-12 border-t border-border">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Start with one agent. Scale to a team.
          </h2>
          <p className="text-muted-foreground mb-8">
            Your main agent is ready. Sub-agents are one message away.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/sign-up"
              className="px-8 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-xl hover:bg-primary/90 transition"
            >
              Deploy Your Assistant →
            </a>
            <Link
              href="/guide"
              className="px-8 py-4 border border-border text-foreground text-lg font-medium rounded-xl hover:bg-secondary transition"
            >
              Getting Started Guide
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <a href="/" className="hover:text-foreground">Home</a>
          <span className="mx-2">·</span>
          <a href="/guide" className="hover:text-foreground">Guide</a>
          <span className="mx-2">·</span>
          <a href="/terms" className="hover:text-foreground">Terms</a>
          <span className="mx-2">·</span>
          <a href="/privacy" className="hover:text-foreground">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
