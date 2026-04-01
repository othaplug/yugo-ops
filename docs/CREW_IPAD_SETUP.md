# Crew iPad setup (truck + team)

This is the correct sequence so the crew app can resolve **which truck** the team is using for equipment checks and related flows.

## 1. Fleet and catalog (admin)

- **Equipment catalog** (Platform → Settings → **Devices** → Equipment catalog): define master items (name, category, default quantity, cost). These are the building blocks.
- **Truck onboarding** (same tab, **Start truck onboarding**): creates a **fleet vehicle**, assigns **catalog lines** to that truck (`truck_equipment`), links a **default crew team**, sets **today’s truck assignment**, and generates an **iPad setup code** in one flow.
- Alternatively, use **Fleet vehicles**, **Equipment status**, **iPad setup codes**, and **Truck assignments** separately; the result must be the same data.

## 2. What must exist in the database

1. **`fleet_vehicles`** row for the physical truck.
2. **`truck_equipment`** rows for that truck (what is on the truck and quantities). Empty means no lines for crew to count until you assign equipment.
3. **`device_setup_codes`** redeemed with **both** `truck_id` and `default_team_id` when you want the tablet itself to carry the truck link.
4. **`registered_devices`** row created when the crew enters the code on **`/crew/setup`** (stores `device_id`, `truck_id`, `default_team_id`).
5. **Optional but recommended:** **`truck_assignments`** for **today’s date** linking the same `team_id` and `truck_id`. The API uses this as a **fallback** if the device row has no truck (e.g. old code was team-only).

## 3. On the iPad

1. Open **`/crew/setup`** (same origin as production, e.g. your ops domain).
2. Enter the **setup code** from admin (and optional device label).
3. On success, open **`/crew/login`** and sign in with the **team phone + PIN** as usual.

If the code had **no truck**, the app still registers the team but shows a notice: truck equipment may not resolve until you use a new code with a truck or dispatch sets today’s assignment.

## 4. How the server picks a truck for equipment check

Order:

1. Latest **active** `registered_devices` row for the logged-in **team** with a non-null **`truck_id`**.
2. Else **`truck_assignments`** for **today** for that **team**.

So: **best practice** is setup code with **truck + team**, plus **today’s assignment** aligned when dispatch runs the board.
