# Resourceful — Property Intelligence Platform

A nationwide web application that generates professional property tax appeal reports using AI analysis, public property data APIs, and owner-provided photographs.

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm
- [Supabase](https://supabase.com) project
- [Stripe](https://stripe.com) account (test mode for development)
- [Anthropic](https://console.anthropic.com) API key
- [ATTOM Data](https://api.gateway.attomdata.com) API key
- [Google Cloud](https://console.cloud.google.com) project with Maps JS, Geocoding, Places, Street View Static, and Maps Static APIs enabled
- [Resend](https://resend.com) account with a verified sending domain

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`. See `.env.example` for documentation on each variable.

### 3. Set up the database

Run all migrations against your Supabase project (via SQL editor or Supabase CLI):

```bash
supabase db push
```

Create storage buckets in Supabase Dashboard:
- `reports` — for generated PDF files
- `photos` — for user-uploaded property photos

### 4. Seed counties

Populate the `county_rules` table with all ~3,143 US counties:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-url SUPABASE_SERVICE_ROLE_KEY=your-key npx tsx scripts/seed-counties.ts
```

Then configure at least one county via the admin dashboard (`/admin/counties`):
- Set `is_active = true`
- Fill assessment ratios, appeal board info, and filing deadlines

### 5. Create an admin user

1. Create a user via Supabase Auth dashboard (Authentication → Users → Add user)
2. Insert into the `admin_users` table:
   ```sql
   INSERT INTO admin_users (user_id, email, name, is_super_admin)
   VALUES ('your-auth-user-uuid', 'your@email.com', 'Your Name', true);
   ```

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

1. Push to GitHub — Vercel builds automatically
2. Set all environment variables from `.env.example` in Vercel project settings
3. Set `NEXT_PUBLIC_APP_URL` to your Vercel domain
4. Configure Stripe webhook:
   - URL: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Event: `payment_intent.succeeded`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation, pipeline stages, conventions, and critical rules.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `supabase db push` | Push schema migrations |
| `supabase gen types typescript` | Regenerate TypeScript types |
