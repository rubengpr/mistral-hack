# Project instructions

## Product

- This repository starts as a generic hackathon scaffold.
- Do not invent product requirements. Ask when a decision changes scope or user experience.
- Prioritize a reliable end-to-end vertical slice before secondary features.
- Keep the demo path deterministic and easy to rehearse.

## Code style

- All code, comments, content, and user-facing text must be in English. Do not use Spanish, Catalan, or any other language.
- Use appropriate HTTP status codes for success and error cases.
- Return `{ success: true, data }` on API success and `{ error: string }` on API errors.
- Name files in kebab-case and include their purpose when useful.
- Do not add trailing slashes to internal URLs, paths, or links.
- Use custom, user-facing validation messages instead of native browser messages.
- Avoid hardcoded user-facing strings when localization is enabled.

## Architecture

- Put one `route.ts` per API resource under `app/api/[resource]/`.
- Route handlers handle authentication, structural validation, service delegation, and HTTP responses.
- Put business logic in `lib/services/` and data access in `lib/db/`.
- Put external providers under `lib/integrations/[provider]/`.
- Server Components may call server-side modules directly.
- Client Components call backend routes through wrappers in `lib/api/`.
- Keep multi-step workflows in backend services, not Client Components.
- Validate external input at system boundaries.

## Stack

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS v3
- shadcn/ui for component primitives

## Components

- Prefer Server Components. Add `"use client"` only for hooks, event handlers, or browser APIs.
- Put reusable UI in `components/ui/` and feature components in `components/features/`.
- Use shadcn/ui CLI (`npx shadcn@latest add [component]`) for adding new UI primitives to `components/ui/`.
- Extract reusable stateful logic to `hooks/use-*.ts`.
- Use named exports for reusable components and default exports for page-level components.
- Use direct function declarations rather than `React.FC`.
- Put shared domain types in `types/` and avoid `any`.
- Use the `@/` alias for internal imports and `import type` for type-only imports.

## Security

- Only expose client-safe environment variables through `NEXT_PUBLIC_*`.
- Never expose credentials, internal errors, or stack traces to clients.
- Validate and sanitize user-controlled input before database or external API calls.
- Verify identity and resource ownership for protected operations.
- Never use `dangerouslySetInnerHTML` with unsanitized input.
- Do not commit `.env` files or secrets.

## Workflow

- Keep changes small and reviewable.
- Do not add dependencies unless they materially reduce implementation risk.
- Do not fabricate successful API responses or verification results.
- Run `pnpm lint`, `pnpm typecheck`, and relevant tests after meaningful changes.
- Run `pnpm build` before deployment.
- State what was verified and what remains unverified.
