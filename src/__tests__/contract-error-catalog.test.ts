// SPDX-License-Identifier: MIT
//
// Issue #717 — Assert every PaymentError variant that exists in the Rust
// contract (contracts/ophirpay/src/lib.rs) has a corresponding entry in the
// TypeScript contract-errors catalog (src/lib/contract-errors.ts).
//
// The Rust-side test (contracts/ophirpay/tests/error_uniqueness.rs) guards
// against duplicate discriminants. This test guards the TS → Rust mapping.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(root, relPath), "utf8");
}

describe("Contract error catalog completeness — #717", () => {
  const rustSource = read("contracts/ophirpay/src/lib.rs");
  const tsSource = read("src/lib/contract-errors.ts");

  // Extract all `VariantName = N,` lines from the Rust PaymentError enum.
  const rustVariants = (() => {
    const enumMatch = rustSource.match(
      /pub enum PaymentError \{([\s\S]*?)\n\}/
    );
    if (!enumMatch) return [];

    const body = enumMatch[1];
    const re = /^\s*(\w+)\s*=\s*(\d+)/gm;
    const results: { name: string; code: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      results.push({ name: m[1], code: parseInt(m[2], 10) });
    }
    return results;
  })();

  // Extract all `"N": "..."` entries from the TS CONTRACT_ERROR_MAP.
  const tsCodes = (() => {
    const re = /"(\d+)":\s*"/g;
    const codes: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(tsSource)) !== null) {
      codes.push(parseInt(m[1], 10));
    }
    return codes;
  })();

  it("Rust PaymentError enum is non-empty and parseable", () => {
    expect(rustVariants.length).toBeGreaterThan(100);
  });

  it("TS catalog is non-empty and parseable", () => {
    expect(tsCodes.length).toBeGreaterThan(100);
  });

  it("every Rust variant code has a matching TS catalog entry", () => {
    const tsSet = new Set(tsCodes);
    const missing = rustVariants.filter((v) => !tsSet.has(v.code));

    expect(missing).toEqual(
      [],
    );
  });

  it("TS catalog has no codes that do not exist in Rust", () => {
    const rustSet = new Set(rustVariants.map((v) => v.code));
    const extra = tsCodes.filter((c) => !rustSet.has(c));
    expect(extra).toEqual([]);
  });

  it("Rust discriminants are unique (cross-check)", () => {
    const seen = new Map<number, string>();
    const duplicates: string[] = [];

    for (const { name, code } of rustVariants) {
      const existing = seen.get(code);
      if (existing) {
        duplicates.push(`code ${code} shared by '${existing}' and '${name}'`);
      } else {
        seen.set(code, name);
      }
    }

    expect(duplicates).toEqual([]);
  });
});
