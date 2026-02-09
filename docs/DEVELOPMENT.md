# Development Guide

This guide covers setting up BlitzClaw for local development.

## Prerequisites

- Node.js 22+ (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- npm 10+
- PostgreSQL 14+ (local or hosted)
- Git

## Quick Start

```bash
# Clone the repository
git clone https://github.com/blitzclaw/blitzclaw.git
cd blitzclaw

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Start development server
npm run dev
```

The web app will be available at `http://localhost:3000`.

## Project Structure

```
blitzclaw/
├── apps/
│   ├── web/              # Next.js web application
│   │   ├── src/
│   │   │   ├── app/      # App router pages & API routes
│   │   │   ├── components/
│   │   │   └── lib/      # Utilities
│   │   └── package.json
│   └── cli/              # CLI tool
│       ├── src/
│       │   ├── commands/ # CLI commands
│       │   ├── lib/      # Shared utilities
│       │   └── index.ts  # Entry point
│       └── package.json
├── packages/
│   └── db/               # Prisma schema & client
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
├── scripts/              # Utility scripts
├── docs/                 # Documentation
└── package.json          # Root workspace config
```

## Environment Setup

### Required for Development

```bash
# Database (use local PostgreSQL or Supabase free tier)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blitzclaw

# Clerk (create free account at clerk.dev)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:3000/api
```

### Optional for Development

These are only needed to test specific features:

```bash
# Billing (test mode keys from Paddle)
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
PADDLE_CLIENT_TOKEN=...
PADDLE_SUBSCRIPTION_PRICE_ID=...
PADDLE_TOPUP_10_PRICE_ID=...
PADDLE_TOPUP_25_PRICE_ID=...
PADDLE_TOPUP_50_PRICE_ID=...
PADDLE_ENVIRONMENT=sandbox

# Infrastructure (only for testing provisioning)
HETZNER_API_TOKEN=...

# AI (only for testing proxy)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PROXY_SIGNING_SECRET=dev-secret-change-in-prod
```

## Database Development

### Using Local PostgreSQL

```bash
# macOS (Homebrew)
brew install postgresql@14
brew services start postgresql@14
createdb blitzclaw

# Then use:
DATABASE_URL=postgresql://localhost:5432/blitzclaw
```

### Using Supabase (Easiest)

1. Create free project at [supabase.com](https://supabase.com)
2. Copy connection string from Settings → Database
3. Use in `.env.local`

### Database Commands

```bash
# Generate Prisma client (run after schema changes)
npm run db:generate

# Push schema to database (development only)
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio

# Create migration (for production changes)
npx prisma migrate dev --name <migration-name>
```

## Running the Apps

### Web App

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production build
npm run start --filter=@blitzclaw/web
```

### CLI

```bash
# Build CLI
npm run build --filter=blitzclaw

# Run CLI directly
node apps/cli/dist/index.js --help

# Or link globally for development
cd apps/cli && npm link
blitzclaw --help
```

## Testing

### Linting

```bash
npm run lint
```

### Type Checking

```bash
# Check all packages
npx turbo run build --filter=@blitzclaw/db
npx tsc --noEmit --project apps/web/tsconfig.json
npx tsc --noEmit --project apps/cli/tsconfig.json
```

### E2E Tests

```bash
# Run E2E test script
./scripts/e2e-test.sh

# With verbose output
VERBOSE=1 ./scripts/e2e-test.sh
```

## Common Tasks

### Adding a New API Route

1. Create file in `apps/web/src/app/api/<path>/route.ts`
2. Export HTTP method handlers (`GET`, `POST`, etc.)
3. Use `auth()` from Clerk for authentication

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Your logic here
  return NextResponse.json({ data: "..." });
}
```

### Adding a CLI Command

1. Create file in `apps/cli/src/commands/<name>.ts`
2. Export command factory function
3. Import in `apps/cli/src/index.ts`

```typescript
import { Command } from "commander";

export function myCommand(): Command {
  const cmd = new Command("mycommand")
    .description("Does something");
  
  cmd
    .command("subcommand")
    .action(async () => {
      // Your logic
    });
  
  return cmd;
}
```

### Modifying Database Schema

1. Edit `packages/db/prisma/schema.prisma`
2. Run `npm run db:generate`
3. Run `npm run db:push` (dev) or create migration (prod)

## Troubleshooting

### "Cannot find module '@blitzclaw/db'"

Run `npm run db:generate` to generate the Prisma client.

### Clerk Middleware Errors

Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set.

### Database Connection Refused

1. Check PostgreSQL is running
2. Verify `DATABASE_URL` is correct
3. Check firewall/network settings

### Hot Reload Not Working

1. Check you're using `npm run dev` (not build + start)
2. Clear `.next` cache: `rm -rf apps/web/.next`
3. Restart dev server

## IDE Setup

### VS Code

Recommended extensions:
- Prisma
- ESLint
- Tailwind CSS IntelliSense
- Pretty TypeScript Errors

### Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Run `npm run lint` and fix issues
4. Commit with clear message
5. Push and open PR
