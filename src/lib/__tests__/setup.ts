// ─── Global Test Setup ────────────────────────────────────────────────────────
// Registered in vitest.config.ts via `setupFiles`. Runs before every test file.

// Set env vars that services check at import time
process.env.AI_MODEL_PRIMARY = 'claude-sonnet-4-20250514';
process.env.AI_MODEL_FAST = 'claude-haiku-4-5-20251001';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJ_test_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ_test_service_role';
process.env.ATTOM_API_KEY = 'test_attom_key';
process.env.RESEND_API_KEY = 're_test_fake';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test_gmaps_key';
process.env.GOOGLE_MAPS_SERVER_KEY = 'test_gmaps_server_key';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
