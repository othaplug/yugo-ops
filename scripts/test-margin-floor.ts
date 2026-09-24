/**
 * Invariant test for the enforced true-margin floor solver.
 *
 * The engine promises: after enforcement, every residential tier's TRUE margin
 * is at least its configured floor. This proves the solver that backs that
 * promise — for a wide range of cost stacks and floors, the price it returns
 * actually clears the floor (allowing for the ceil-to-$rounding rounding, which
 * only ever pushes the price UP, i.e. margin up).
 *
 * Run: npx tsx scripts/test-margin-floor.ts
 */
import {
  trueMarginFloorPrice,
  trueMarginFloorsFromConfig,
  isTrueMarginFloorEnforced,
  DEFAULT_TRUE_MARGIN_FLOORS,
} from "../src/lib/pricing/true-margin-floor";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    console.error("  ✗ " + msg);
  }
};

// The realised true margin at a given price.
const trueMarginAt = (
  price: number,
  directCost: number,
  ohShare: number,
  claimsPct: number,
) => (price - directCost - ohShare - price * claimsPct) / price;

console.log("1) Solver clears the floor across a cost/floor sweep");
const claimsSweep = [0, 0.005, 0.01];
const roundingSweep = [1, 25, 50];
const floorSweep = [0.35, 0.5, 0.55, 0.62, 0.7, 0.8];
const directSweep = [150, 300, 427, 800, 1500, 3000];
const ohSweep = [0, 30, 56, 120, 300];
let checked = 0;
for (const claimsPct of claimsSweep)
  for (const rounding of roundingSweep)
    for (const floorFrac of floorSweep)
      for (const directCost of directSweep)
        for (const ohShare of ohSweep) {
          const price = trueMarginFloorPrice({ directCost, ohShare, claimsPct, floorFrac, rounding });
          if (price <= 0) continue; // degenerate guard (floor+claims too high)
          const realised = trueMarginAt(price, directCost, ohShare, claimsPct);
          // Rounding up only raises the margin, so realised must be >= floor
          // (tiny epsilon for float noise).
          ok(
            realised >= floorFrac - 1e-9,
            `floor ${floorFrac} dc ${directCost} oh ${ohShare} claims ${claimsPct} r ${rounding}: realised ${(realised * 100).toFixed(2)}% < floor`,
          );
          checked++;
        }
console.log(`   checked ${checked} combinations`);

console.log("2) Rounding lands on the grid");
for (const rounding of [25, 50]) {
  const p = trueMarginFloorPrice({ directCost: 427, ohShare: 56, claimsPct: 0.005, floorFrac: 0.55, rounding });
  ok(p % rounding === 0, `price ${p} not a multiple of ${rounding}`);
}

console.log("3) Degenerate floors return 0 (no clamp)");
ok(trueMarginFloorPrice({ directCost: 400, ohShare: 50, claimsPct: 0.005, floorFrac: 0.98, rounding: 50 }) === 0, "floor 0.98 should be unsolvable");
ok(trueMarginFloorPrice({ directCost: 0, ohShare: 0, claimsPct: 0, floorFrac: 0.55, rounding: 50 }) === 0, "zero cost should return 0");

console.log("4) A worked example matches the screenshot shape");
// Essential: direct ~427, OH ~56, claims 0.5%, floor 55% → price s.t. margin ≥ 55%.
const ess = trueMarginFloorPrice({ directCost: 427, ohShare: 56, claimsPct: 0.005, floorFrac: 0.55, rounding: 50 });
const essMargin = trueMarginAt(ess, 427, 56, 0.005);
console.log(`   Essential floor price = $${ess} → true margin ${(essMargin * 100).toFixed(1)}% (target 55%)`);
ok(essMargin >= 0.55 - 1e-9, "worked example below floor");
ok(ess > 700, `expected the floor price to exceed the underpriced $700 example, got ${ess}`);

console.log("5) Config parsing: percent, fraction, defaults, kill switch");
const asPct = trueMarginFloorsFromConfig(new Map([["true_margin_floor_essential", "60"]]));
ok(Math.abs(asPct.essential - 0.6) < 1e-9, `percent 60 should parse to 0.60, got ${asPct.essential}`);
const asFrac = trueMarginFloorsFromConfig(new Map([["true_margin_floor_signature", "0.66"]]));
ok(Math.abs(asFrac.signature - 0.66) < 1e-9, `fraction 0.66 should stay 0.66, got ${asFrac.signature}`);
const defs = trueMarginFloorsFromConfig(new Map());
ok(defs.estate === DEFAULT_TRUE_MARGIN_FLOORS.estate, "empty config should use default estate floor");
ok(isTrueMarginFloorEnforced(new Map()) === true, "enforcement defaults ON");
ok(isTrueMarginFloorEnforced(new Map([["enforce_true_margin_floor", "false"]])) === false, "'false' disables");
ok(isTrueMarginFloorEnforced(new Map([["enforce_true_margin_floor", "0"]])) === false, "'0' disables");
ok(isTrueMarginFloorEnforced(new Map([["enforce_true_margin_floor", "true"]])) === true, "'true' enables");

if (failures === 0) {
  console.log("\n✓ All margin-floor invariants hold.");
  process.exit(0);
} else {
  console.error(`\n✗ ${failures} assertion(s) failed.`);
  process.exit(1);
}
