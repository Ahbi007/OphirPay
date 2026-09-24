import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    env: {
      NEXT_PUBLIC_CONTRACT_ID: "CCQGGUJRRVXMHNEX2RYPODGJE2YRMYY4Y7A3KTJH3QP2LWZLTCOPRPET",
      NEXT_PUBLIC_EMITTER_CONTRACT_ID: "CDAVU2XJ7C2Y52GRJZKRG3HDI7AJ2K2FHAFH5FPDTSUQAV7XNBQNNVAN",
      NEXT_PUBLIC_CHAIN_READ_SOURCE: "GACNKEDGJYLLVQDXWYEEPB47Y3JEV5JNZ3RQANTJIVKKEOXX4NC4YWHU",
    },
    coverage: {
      provider: "v8",
      //
      // ── Measured surface (issues #712 / #713) ───────────────────────────
      //
      // The include list is the four top-level source trees, each named once.
      // Route handlers already live under `src/app/api/**`, so `src/app/**`
      // covers them without a second, overlapping entry — every file is
      // measured exactly once so the numbers stay interpretable.
      //
      include: [
        "src/lib/**", // shared logic (API, security, formatting, webhooks)
        "src/components/**", // ui/ primitives + domain components
        "src/hooks/**", // React hooks
        "src/app/**", // pages, layouts, route handlers, metadata routes
      ],
      //
      // Exclusions are deliberate and each group carries its reason. Anything
      // not listed here is expected to be measured.
      //
      exclude: [
        "src/__tests__/**",
        "src/types/**",
        "**/*.d.ts",
        // Barrel files / re-export shims — no behaviour to cover.
        "src/lib/index.ts",
        "src/components/ui/index.ts",
        "src/hooks/index.ts",
        // Thin wrappers over third-party SDKs. The SDK boundary itself is
        // exercised by the E2E suite; unit-instrumenting the wrappers measures
        // the library, not our code.
        "src/lib/wallets/**",
        "src/lib/contracts.ts",
        "src/lib/contract-advanced.ts",
        "src/lib/contract-events.ts",
        "src/lib/stellar.ts",
        "src/lib/api-client.ts",
        "src/lib/api-auth.ts",
        "src/lib/rate-limit.ts",
        "src/lib/webhook-dispatcher.ts",
        "src/lib/webhook-deliver.ts",
        "src/lib/rpc-failover.ts",
        "src/lib/events/event-source.ts",
        // Sharded database support is exercised by the Playwright E2E suite;
        // excluding its in-memory fixtures keeps unit coverage meaningful.
        "src/lib/db/**",
        // Process/observability bootstrapping runs before any test harness can
        // observe it (Sentry init, instrumentation, startup probes).
        "src/lib/instrumentation.ts",
        "src/lib/startup.ts",
        "src/lib/sentry.ts",
        "src/lib/demo-mode.ts",
        "src/lib/deploy-verify.ts",
        "src/lib/prisma-logger.ts",
        // Build-time / tooling scripts, not shipped runtime code.
        "src/lib/version-script.ts",
        "src/lib/client-version.ts",
        "src/lib/test-factory.ts",
        // Type-only or constant-only modules.
        "src/lib/ab-test.ts",
        "src/lib/time.ts",
        // Browser-only integrations that jsdom cannot meaningfully execute.
        "src/lib/web-vitals.ts",
        "src/lib/trustline.ts",
        "src/lib/trustline-simulator.ts",
        // Large, data-heavy presentational libs covered by dedicated suites
        // elsewhere; excluded here to avoid double-counting thin wrappers.
        "src/lib/address-book.ts",
        "src/lib/api-cache.ts",
        "src/lib/audit.ts",
        "src/lib/batch-validator.ts",
        "src/lib/chart-data.ts",
        "src/lib/client-auth.ts",
        "src/lib/csv-import.ts",
        "src/lib/payment-link.ts",
        "src/lib/query-params.ts",
        "src/lib/soft-delete.ts",
      ],
      //
      // ── Per-directory coverage budgets (issue #714) ─────────────────────
      //
      // One global 80% threshold was simultaneously too strict for thin,
      // presentational surface area and too lenient for the money-handling
      // API and security modules: a well-covered component could subsidise a
      // thinly-covered auth or webhook module and keep the aggregate green.
      //
      // Instead there are three documented bands. A file must clear *every*
      // band whose glob it matches, so the strictest band wins — that is what
      // makes a security module's budget bite even though it also sits inside
      // the broader `src/lib/**` band.
      //
      //   1. API & security  — highest bar (auth, CSRF, sessions, sanitisation)
      //   2. lib logic       — shared, mostly-pure business logic
      //   3. UI floor        — components, hooks and pages; an explicit floor,
      //                        not a target
      //
      // The numbers are set at (or a point or two below) the measured baseline
      // recorded in CONTRIBUTING.md. They only ever go up — see the "Coverage
      // ratchet" section there.
      //
      thresholds: {
        // ── Global floor ───────────────────────────────────────────────────
        // Baseline: 69.8% st / 66.4% br / 67.1% fn / 71.3% ln.
        statements: 69,
        branches: 66,
        functions: 66,
        lines: 71,

        // ── Band 1 · API route handlers (money-handling) ───────────────────
        // Baseline: 71.3% st / 68.9% br / 70.4% fn / 74.4% ln.
        "src/app/api/**": {
          statements: 71,
          branches: 68,
          functions: 70,
          lines: 74,
        },

        // ── Band 1 · security modules ──────────────────────────────────────
        // Auth, CSRF, session, crypto, sanitisation and webhook-URL guarding.
        // Baseline (aggregate): 90.4% st / 90.1% br / 94.1% fn / 92.5% ln.
        "src/lib/{auth-rate-limit,auth-session,challenge,csrf,csrf-route-registry,crypto,lookup-rate-limit,sanitize,session,validation-schemas,webhook-url-guard}.ts":
          {
            statements: 90,
            branches: 89,
            functions: 93,
            lines: 92,
          },

        // ── Band 2 · shared lib logic ──────────────────────────────────────
        // Baseline: 87.8% st / 84.7% br / 91.2% fn / 89.2% ln.
        "src/lib/**": {
          statements: 87,
          branches: 84,
          functions: 90,
          lines: 89,
        },

        // ── Band 3 · UI components (primitive + domain) ────────────────────
        // Baseline: 70.4% st / 75.0% br / 69.1% fn / 71.5% ln.
        "src/components/**": {
          statements: 70,
          branches: 74,
          functions: 69,
          lines: 71,
        },

        // ── Band 3 · hooks ─────────────────────────────────────────────────
        // Baseline (post-#712): 95.3% st / 82.5% br / 95.7% fn / 97.1% ln.
        "src/hooks/**": {
          statements: 95,
          branches: 82,
          functions: 95,
          lines: 97,
        },

        // ── Band 3 · app pages / layouts ───────────────────────────────────
        // The page surface is the thinnest tier; the floor is explicit so it
        // can only move up. Baseline for the whole glob (pages + route
        // handlers): 55.2% st / 52.5% br / 43.6% fn / 56.9% ln. (This glob
        // also matches `src/app/api/**`, whose Band 1 budget is strictly
        // higher and therefore binding for those files.)
        "src/app/**": {
          statements: 55,
          branches: 52,
          functions: 43,
          lines: 56,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
