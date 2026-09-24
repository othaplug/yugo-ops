/**
 * Access-surcharge tests: house-storey pricing, townhouse multiplier, finished
 * basement, and the walk-up high-floor cap lift. Run: npx tsx scripts/test-access-surcharge.ts
 */
import {
  accessProfileSurcharge,
  houseStoreySurcharge,
  walkupHighFloorSurcharge,
  type AccessProfile,
} from "../src/lib/buildings/access-profile";

let failures = 0;
const eq = (got: number, want: number, msg: string) => {
  if (got !== want) {
    failures++;
    console.error(`  ✗ ${msg}: got ${got}, want ${want}`);
  } else {
    console.log(`  ✓ ${msg} = $${got}`);
  }
};
const ge = (got: number, want: number, msg: string) => {
  if (!(got >= want)) {
    failures++;
    console.error(`  ✗ ${msg}: got ${got}, want >= ${want}`);
  } else {
    console.log(`  ✓ ${msg} = $${got} (>= ${want})`);
  }
};

const house = (levels: number, basement = false): AccessProfile => ({
  property_type: "house",
  interior_levels: levels,
  finished_basement: basement,
  entrance_steps_band: "few",
  truck_spot: "driveway",
});
const town = (levels: number): AccessProfile => ({
  property_type: "town",
  interior_levels: levels,
  entrance_steps_band: "few",
  truck_spot: "driveway",
});
const walkup = (floor: number): AccessProfile => ({
  property_type: "walkup",
  unit_floor: floor,
  stair_type: "straight",
  stair_width_band: "standard",
  entrance_steps_band: "few",
  truck_spot: "street",
});

console.log("1) Detached house storeys scale (component only)");
eq(houseStoreySurcharge(house(2)), 0, "2-storey detached");
eq(houseStoreySurcharge(house(3)), 150, "3-storey detached");
eq(houseStoreySurcharge(house(4)), 300, "4-storey detached");

console.log("2) Townhouse costs more than a detached at the same storeys");
eq(houseStoreySurcharge(town(2)), 0, "2-storey townhouse");
ge(houseStoreySurcharge(town(3)), houseStoreySurcharge(house(3)) + 1, "3-storey townhouse > 3-storey detached");
eq(houseStoreySurcharge(town(3)), 200, "3-storey townhouse (150*1.25 -> $25 grid)");
eq(houseStoreySurcharge(town(4)), 375, "4-storey townhouse");

console.log("3) Finished basement adds a storey of carry (house)");
eq(houseStoreySurcharge(house(2, true)), 150, "2-storey + basement = like a 3rd level");
eq(houseStoreySurcharge(house(3, true)), 300, "3-storey + basement");

console.log("4) Walk-up high floors keep climbing past the $300 band ceiling");
eq(walkupHighFloorSurcharge(walkup(5)), 0, "5th floor: no high-floor add");
eq(walkupHighFloorSurcharge(walkup(6)), 75, "6th floor: +$75");
eq(walkupHighFloorSurcharge(walkup(8)), 225, "8th floor: +$225");
// End-to-end: an 8th-floor walk-up must exceed a 5th-floor walk-up.
ge(accessProfileSurcharge(walkup(8)), accessProfileSurcharge(walkup(5)) + 75, "8th-floor total > 5th-floor total");

console.log("5) Non-house / non-walkup types are unaffected by the new adders");
eq(houseStoreySurcharge({ property_type: "condo", unit_floor: 20 }), 0, "condo storey add");
eq(walkupHighFloorSurcharge({ property_type: "house", interior_levels: 4 }), 0, "house high-floor add");
eq(houseStoreySurcharge({ property_type: "ground" }), 0, "ground storey add");

console.log("6) End-to-end accessProfileSurcharge folds band + storeys");
ge(accessProfileSurcharge(house(4)), 300, "4-storey detached total >= storey component");

if (failures === 0) {
  console.log("\n✓ All access-surcharge checks pass.");
  process.exit(0);
} else {
  console.error(`\n✗ ${failures} check(s) failed.`);
  process.exit(1);
}
