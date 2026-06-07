# Profitmuna Main

A finance app that automatically applies percentage allocations to your income for proper budgeting

## Stack

- **Frontend**: Next.js 15.4.11 + Tailwind CSS 4.1.0 + shadcn/ui
- **API**: Hono 4.12.9 on Cloudflare Workers
- **Database**: Drizzle ORM 0.45.2 on Cloudflare D1

## Getting Started

```bash
npm install
npm run dev
```

The web app runs at [http://localhost:3006](http://localhost:3006).
The API runs at [http://localhost:8793](http://localhost:8793).

## Project Structure

```
profitmuna-main/
  apps/
    web/          # Next.js frontend

    api/          # Hono API on Cloudflare Workers
  packages/
    db/           # Drizzle schema and migrations


```

## Scripts

| Command             | Description              |
| ------------------- | ------------------------ |
| `npm run dev`       | Start all dev servers    |
| `npm run build`     | Build all packages       |
| `npm run test`      | Run all tests            |
| `npm run typecheck` | TypeScript type checking |
