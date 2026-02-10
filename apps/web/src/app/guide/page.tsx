"use client";

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-foreground">
            ⚡ BlitzClaw
          </a>
          <a
            href="/sign-up"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            Get Started
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Your AI Assistant is Ready. Now What?
        </h1>
        <p className="text-xl text-muted-foreground mb-12">
          Think of it less like software, more like onboarding a new team member.
        </p>

        {/* Section 1 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">💬</span> Start by Talking
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Your assistant learns from conversation. Don't just give commands — have a dialogue.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Hey, can you help me draft an email to my team about the project delay?"</span>
              </div>
              <div className="flex gap-3">
                <span className="text-blue-400">Assistant:</span>
                <span className="text-foreground italic">"Sure! What's the main reason for the delay, and what tone do you want — apologetic, matter-of-fact, or optimistic?"</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              It asks clarifying questions. Answer them. This builds context.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">🔄</span> Ask It to Try Again
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              First attempts aren't always perfect. That's fine — redirect it.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"This is too formal. Make it sound more like how I'd actually talk."</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Can you shorten this to 3 sentences?"</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Actually, let's take a different approach entirely."</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Every correction teaches it your preferences.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">🎓</span> Teach It How You Work
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Share your methods. The assistant remembers and applies them.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"When I ask for meeting notes, always use bullet points and put action items at the top."</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"I prefer to review things in the morning. If something's not urgent, save it for my 9am summary."</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"My writing style is casual but direct. No corporate speak."</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              These instructions stick. You won't have to repeat them.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">🔍</span> Ask Why Things Don't Work
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              When something fails, ask for an explanation. Understanding helps both of you.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Why couldn't you access that file?"</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"What went wrong with the calendar lookup?"</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Is there a different way to do this?"</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Sometimes it's a permission issue. Sometimes it's a better approach. You'll learn what it can and can't do.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">🧠</span> Build Memory Together
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-muted-foreground">
              Your assistant maintains a memory file. Help it stay accurate.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Remember that I'm working on the Q2 launch until March."</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"Add my wife's birthday (June 15) to your notes."</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-400">You:</span>
                <span className="text-foreground">"What do you know about me so far?"</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Over time, it builds a picture of your work, your preferences, and your life — making it more useful every day.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="text-3xl">⚡</span> Things to Try
          </h2>
          <div className="bg-card border border-border rounded-xl p-6">
            <ul className="space-y-3 text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span>"Search the web for [topic] and summarize what you find"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span>"Draft a response to this message: [paste text]"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span>"Remind me to [task] tomorrow at 9am"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span>"What's on my calendar today?"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span>"Help me brainstorm ideas for [project]"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">→</span>
                <span>"Explain [complex topic] like I'm new to it"</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center py-12 border-t border-border">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            The best assistant is the one you've trained yourself.
          </h2>
          <p className="text-muted-foreground mb-8">
            Start small. Be patient. Give feedback. Watch it get better.
          </p>
          <a
            href="/sign-up"
            className="inline-block px-8 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-xl hover:bg-primary/90 transition"
          >
            Deploy Your Assistant →
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <a href="/" className="hover:text-foreground">Home</a>
          <span className="mx-2">·</span>
          <a href="/terms" className="hover:text-foreground">Terms</a>
          <span className="mx-2">·</span>
          <a href="/privacy" className="hover:text-foreground">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
