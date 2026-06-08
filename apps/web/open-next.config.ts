import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Minimal config: no persistent incremental cache (R2/KV). The app is
// cookie-gated SSR, so a shared cache adds bindings/setup we don't need for
// the initial Workers deployment. Revisit if ISR/PPR caching becomes relevant.
export default defineCloudflareConfig({});
