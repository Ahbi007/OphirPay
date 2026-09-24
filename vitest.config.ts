import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Tests are collected only from the sanctioned test roots. A narrow glob
    // means a stray `*.test.ts` colocated inside shipped source (src/lib,
    // src/app, …) can no longer be collected silently. `src/__tests__` is the
    // documented convention (see docs/API_GUIDE.md → "Testing your endpoint");
    // `scripts` holds unit tests for build tooling and `tests` is reserved for
    // non-Vitest (Playwright) suites.
    // Guarded against regression by src/__tests__/repo-hygiene.test.ts.
    include: [
      "src/__tests__/**/*.test.{ts,tsx}",
      "scripts/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
    ],
    env: {
      NEXT_PUBLIC_CONTRACT_ID: "CCQGGUJRRVXMHNEX2RYPODGJE2YRMYY4Y7A3KTJH3QP2LWZLTCOPRPET",
      NEXT_PUBLIC_EMITTER_CONTRACT_ID: "CDAVU2XJ7C2Y52GRJZKRG3HDI7AJ2K2FHAFH5FPDTSUQAV7XNBQNNVAN",
      NEXT_PUBLIC_CHAIN_READ_SOURCE: "GACNKEDGJYLLVQDXWYEEPB47Y3JEV5JNZ3RQANTJIVKKEOXX4NC4YWHU",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/components/ui/**", "src/hooks/**", "src/app/api/**"],
      exclude: [
        "src/__tests__/**",
        // Defensive: a test file must never be measured as production source,
        // whichever root it is collected from. `coverage.include` covers
        // `src/lib/**`, so this keeps a future colocated test from re-entering
        // the production coverage denominator (#688).
        "**/*.test.{ts,tsx}",
        "src/types/**", // Types
        "**/*.d.ts", // Types
        "src/lib/wallets/**", // Browser-only
        "src/lib/index.ts", // Re-export index
        "src/lib/contracts.ts", // E2E-only
        "src/lib/contract-advanced.ts", // E2E-only
        "src/lib/contract-events.ts", // E2E-only
        "src/lib/stellar.ts", // E2E-only
        "src/lib/rpc-failover.ts", // E2E-only
        "src/lib/events/event-source.ts", // E2E-only
        // Sharded database support is exercised by the Playwright E2E suite;
        // excluding its in-memory fixtures keeps unit coverage meaningful.
        "src/lib/db/**", // E2E-only
        "src/lib/api-auth.ts", // E2E-only
        "src/lib/api-client.ts", // E2E-only
        "src/lib/rate-limit.ts", // E2E-only
        "src/lib/webhook-dispatcher.ts", // E2E-only
        "src/lib/webhook-deliver.ts", // E2E-only
        "src/lib/demo-mode.ts", // E2E-only
        "src/instrumentation.ts", // Next.js entrypoint
        "src/lib/startup.ts", // Next.js entrypoint
        "src/lib/sentry.ts", // 3rd party integration
        "src/lib/deploy-verify.ts", // E2E-only
        "src/hooks/useMultiWallet.tsx", // Browser-only
        "src/hooks/useFreighter.tsx", // Browser-only
        "src/hooks/useTheme.tsx", // Browser-only
        "src/hooks/useRetry.ts", // Browser-only
        "src/hooks/useApiQuery.ts", // Browser-only
        "src/hooks/useNetworkChange.ts", // Browser-only
        "src/hooks/useErrorTracker.ts", // Browser-only
        "src/hooks/useKeyboardShortcuts.ts", // Browser-only
        "src/hooks/useLocalStorage.ts", // Browser-only
        "src/lib/ab-test.ts", // E2E-only
        "src/lib/address-book.ts", // Browser-only
        "src/lib/api-cache.ts", // E2E-only
        "src/lib/audit.ts", // E2E-only
        "src/lib/batch-validator.ts", // E2E-only
        "src/lib/chart-data.ts", // E2E-only
        "src/lib/client-auth.ts", // E2E-only
        "src/lib/client-version.ts", // E2E-only
        "src/lib/csv-import.ts", // Browser-only
        "src/lib/payment-link.ts", // E2E-only
        "src/lib/prisma-logger.ts", // E2E-only
        "src/lib/query-params.ts", // Browser-only
        "src/lib/soft-delete.ts", // E2E-only
        "src/components/ui/index.ts", // Re-export index
        "src/hooks/index.ts", // Re-export index
        "src/lib/test-factory.ts", // Test utilities
        "src/lib/time.ts", // Browser-only
        "src/lib/trustline.ts", // E2E-only
        "src/lib/version-script.ts", // Build script
        "src/lib/web-vitals.ts", // 3rd party integration
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
