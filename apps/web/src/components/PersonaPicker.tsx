"use client";

type Persona = "assistant" | "developer" | "creative" | "custom";

interface PersonaPickerProps {
  selected: Persona;
  onSelect: (persona: Persona) => void;
}

interface PersonaOption {
  id: Persona;
  name: string;
  description: string;
  icon: string;
  preview: string;
}

const personas: PersonaOption[] = [
  {
    id: "assistant",
    name: "Personal Assistant",
    description: "Helpful, proactive, and concise. Great for daily tasks.",
    icon: "🤖",
    preview: `You are a personal assistant. Helpful, proactive, concise.

You help with:
- Daily planning and reminders
- Quick research and answers
- Writing and editing
- General productivity

Be warm but efficient. Respect the user's time.`,
  },
  {
    id: "developer",
    name: "Dev Assistant",
    description: "Technical, precise, with code examples. Built for devs.",
    icon: "💻",
    preview: `You are a technical assistant for developers.

You help with:
- Code review and suggestions
- Debugging and problem-solving
- Documentation
- Git workflows

Be precise and technical. Show code examples when relevant.`,
  },
  {
    id: "creative",
    name: "Creative Partner",
    description: "Imaginative and collaborative. For brainstorming and content.",
    icon: "🎨",
    preview: `You are a creative collaborator.

You help with:
- Brainstorming and ideation
- Writing and storytelling
- Content planning
- Feedback and editing

Be imaginative but grounded. Push ideas forward.`,
  },
  {
    id: "custom",
    name: "Custom",
    description: "Start from scratch with your own SOUL.md.",
    icon: "✨",
    preview: "",
  },
];

export function PersonaPicker({ selected, onSelect }: PersonaPickerProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {personas.map((persona) => (
        <button
          key={persona.id}
          type="button"
          onClick={() => onSelect(persona.id)}
          className={`p-5 rounded-xl border text-left transition-all ${
            selected === persona.id
              ? "border-primary bg-primary/10 ring-2 ring-primary/50"
              : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">{persona.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{persona.name}</h3>
                {selected === persona.id && (
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{persona.description}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function getPersonaTemplate(persona: Persona): string {
  const option = personas.find((p) => p.id === persona);
  return option?.preview || "";
}

export { personas };
