# BCMS SaaS Public Launch

This workspace now includes the missing backend pieces needed to run the current Vite app as a public SaaS and accept paid upgrades through the existing bank-transfer flow.

## What was added

- `supabase/migrations/20260425_public_launch.sql`
  Creates the core multi-tenant billing schema:
  `organizations`, `profiles`, `subscriptions`, `payment_orders`, `org_branding`, and `plg_events`.
- `supabase/functions/*`
  Adds production edge functions used by the UI:
  `resolve-tenant`, `payment-webhook`, `subscription-activate`, `plg-event`, and `plg-scorer`.
- `vercel.json`
  Makes the monorepo easy to deploy publicly on Vercel.

## Public deployment flow

1. Create a Supabase project.
2. Run the SQL migration in `supabase/migrations/20260425_public_launch.sql`.
3. Deploy the edge functions from the `supabase/functions` directory.
4. Create these function secrets in Supabase:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   You can keep the same values locally in `supabase/.env.example` for reference.
5. Copy `apps/web/.env.example` to a real environment file and fill in production values.
6. Deploy the frontend to Vercel with the root of this workspace.
7. Point your main domain and wildcard subdomain to Vercel:
   - `bcms.yourdomain.com`
   - `*.yourdomain.com`
8. In Supabase Auth, add your production URLs to `Site URL` and redirect URLs.

## One-command Supabase deploy

After installing the Supabase CLI and logging in, you can deploy the backend with:

```powershell
pnpm deploy:supabase
```

If you need a different project ref:

```powershell
./scripts/deploy-supabase.ps1 -ProjectRef your-project-ref
```

This script will:

1. Link the Supabase project
2. Push database migrations
3. Set function secrets from `supabase/.env.example`
4. Deploy all required edge functions

## Required frontend env

Set these in Vercel for the frontend:

- `VITE_BASE_DOMAIN`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON`

Example:

```env
VITE_BASE_DOMAIN=theossphere.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON=your-production-anon-key
```

A ready-to-fill production example is included at `apps/web/.env.production.example`.

## Billing model that is now supported

The current UI uses manual payment confirmation, not instant card checkout.

1. Customer signs up.
2. Customer selects a plan.
3. Customer uploads a payment slip.
4. `payment-webhook` creates a pending order.
5. Admin confirms the order from the dashboard.
6. `subscription-activate` upgrades the subscription and tenant feature flags.

This matches the app's existing payment modal and admin order review flow.

## Important operational notes

- The `payment-slips` storage bucket is marked public because the current admin UI opens slip files directly by URL.
- If you want private slips later, update the UI to request signed URLs before changing bucket visibility.
- New users automatically get an organization, owner profile, trial subscription, and generated subdomain through the `handle_new_user()` database trigger.
- Tenant resolution supports both subdomains and custom domains.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend variables such as `VITE_*`.

## Suggested next upgrade

If you want automatic card charging next, add a Stripe checkout flow beside the current transfer-slip flow and have Stripe webhooks call `subscription-activate` automatically.

## Stripe upgrade path

If you want to move from bank-transfer slips to card payments, the clean next step is:

1. Add Stripe Checkout session creation in a new Supabase Edge Function
2. Add a Stripe webhook Edge Function
3. Let the webhook call the same subscription activation logic after successful payment
4. Keep the current manual transfer flow as a fallback for enterprise customers

## Public launch checklist

### Vercel

1. Import this project into Vercel.
2. Keep the root directory at the workspace root.
3. Set these environment variables in Vercel:
   - `VITE_BASE_DOMAIN`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON`
4. Deploy and verify the generated production URL works.
5. Add your real custom domain and wildcard subdomain in Vercel:
   - `bcms.yourdomain.com`
   - `*.yourdomain.com`

### Supabase Auth

Set these in Supabase Dashboard -> Authentication -> URL Configuration:

- Site URL:
  `https://bcms.yourdomain.com`
- Redirect URLs:
  - `https://bcms.yourdomain.com`
  - `https://*.yourdomain.com`
  - your Vercel preview URL if you want preview testing

### Supabase verification

Confirm these exist in the Supabase Dashboard:

- Edge Functions:
  - `resolve-tenant`
  - `payment-webhook`
  - `subscription-activate`
  - `plg-event`
  - `plg-scorer`
- Storage bucket:
  - `payment-slips`
- Tables:
  - `organizations`
  - `profiles`
  - `subscriptions`
  - `payment_orders`
  - `org_branding`
  - `plg_events`

### Smoke test

1. Open the main app URL.
2. Register a new account.
3. Confirm the new organization, profile, and free subscription appear in Supabase.
4. Open a paid package and upload a payment slip.
5. Confirm a row is created in `payment_orders`.
6. Approve the order from the admin flow.
7. Confirm the subscription plan updates and the tenant can load from its subdomain.
