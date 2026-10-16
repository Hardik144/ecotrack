# EcoTrack Carbon Footprint Calculation Methodology & Emission Factors

EcoTrack uses a deterministic, auditable carbon accounting engine implemented in [`src/constants/emissionFactors.ts`](src/constants/emissionFactors.ts) and [`src/utils/carbonCalculator.ts`](src/utils/carbonCalculator.ts). AI is **never** used to estimate or fabricate numerical emission factors.

---

## Core Calculation Equation

Every line item is converted to canonical physical units and evaluated with:

$$\text{CO}_2\text{e (kg)} = \text{Activity amount (canonical unit)} \times \text{Emission factor (kg CO}_2\text{e / unit)}$$

Results are rounded to `3` decimal places in the engine/database (`numeric(10,3)`) so low-intensity inputs (such as residential water liters) retain gram-level accuracy without collapsing to `0`.

---

## Canonical Unit Conversions

| Input Unit | Canonical Target | Exact Factor |
|---|---|---|
| Miles (`mi`) | Kilometers (`km`) | `1 mi = 1.609344 km` |
| Grams (`g`) | Kilograms (`kg`) | `1 kg = 1,000 g` |
| Pounds (`lb`) | Kilograms (`kg`) | `1 lb = 0.45359237 kg` |
| Short tons | Kilograms (`kg`) | `1 short ton = 907.18474 kg` |
| Cubic meters (`m³`) | Liters (`L`) | `1 m³ = 1,000 L` |
| US Gallons (`gal`) | Liters (`L`) | `1 US gal = 3.785411784 L` |
| Monthly billing period | Daily average | `1 standard month = 30 days` |

---

## 1. Transportation Emission Factors

Primary dataset: **UK Department for Energy Security and Net Zero (DESNZ) Greenhouse Gas Reporting Conversion Factors (2024)**.

| Mode | Variant / Subtype | Factor (`kg CO₂e / km`) | Key Assumptions & Methodology |
|---|---|---|---|
| **Car** | Petrol (average, unknown size) | `0.1645` per vehicle-km ÷ passengers | Divided evenly by occupancy (`1..6` passengers) to produce per-passenger-km rate. |
| **Car** | Diesel (average) | `0.1698` per vehicle-km ÷ passengers | Direct CO₂, CH₄, and N₂O tailpipe factors split by passengers. |
| **Car** | Hybrid (average) | `0.1261` per vehicle-km ÷ passengers | Conventional non-plug-in hybrid vehicle baseline. |
| **Car** | Battery Electric (EV) | `0.18 kWh/km × Grid Factor ÷ passengers` | Uses `0.18 kWh/km` (`18 kWh / 100 km` incl. charging losses) multiplied by the user's selected regional electricity factor. |
| **Motorcycle** | Average Petrol | `0.1137` | Fleet-weighted petrol motorcycle factor (`UK DESNZ 2024`). |
| **Motorcycle** | Small (≤125cc) / Medium / Large (>500cc) | `0.0830` / `0.1010` / `0.1340` | Tailored engine displacement tiers from `UK DESNZ 2024`. |
| **Bus** | City / Local Bus | `0.1085` | Per passenger-km (`UK DESNZ 2024 Average Local Bus`). |
| **Bus** | Intercity Coach | `0.0272` | High-occupancy long-distance coach (`UK DESNZ 2024 Coach`). |
| **Train** | National / Commuter Rail | `0.0355` | Per passenger-km (`UK DESNZ 2024 National Rail`). |
| **Train** | Metro / Light Rail / Tram | `0.0286` | Per passenger-km (`UK DESNZ 2024 Light Rail & Tram`). |
| **Train** | High-Speed Electric Rail | `0.0045` | International electric rail baseline (`UK DESNZ 2024`). |
| **Air Travel** | Domestic (with RF) | `0.2293` | Includes non-CO₂ high-altitude Radiative Forcing (`RF`) multiplier; round-trip doubles distance. |
| **Air Travel** | Short-Haul Economy / Business (with RF) | `0.1258` / `0.1886` | Flights ~500–3,700 km (`UK DESNZ 2024`, with RF). |
| **Air Travel** | Long-Haul Economy / Business (with RF) | `0.1170` / `0.3394` | Intercontinental cruise seating allocation (`UK DESNZ 2024`, with RF). |
| **Walking** | Direct / Car-Swap Offset | `0.0000` (emission) / `0.1645` (offset) | Human-powered walking emits zero direct GHG; optional swap logs avoided solo petrol car emissions. |
| **Cycling** | Regular Bike / E-Bike | `0.0000` / `0.008 kWh/km × Grid Factor` | Regular cycling is 0 direct GHG; E-bike uses `0.8 kWh / 100 km` grid draw. Car-swap offset subtracts e-bike grid draw from `0.1645 kg/km`. |

---

## 2. Electricity Regional Emission Factors

Users can configure a default regional grid in **Profile → Regional Grid & Units** or override it per calculation, including entering a custom utility factor (`0.0000` to `2.5000 kg CO₂e/kWh`). Monthly electricity bills support both **Full Monthly Total** and **Daily Average (`÷ 30 days`)**, as well as dividing shared household usage across occupants (`1..20`).

| Region Code | Region / Grid | Factor (`kg CO₂e / kWh`) | Primary Source |
|---|---|---|---|
| `global` | Global Average | `0.4450` | IEA Global Electricity Tracking Benchmark (2024) |
| `us-avg` | United States National Avg | `0.3410` | US EPA eGRID2024 (`747.9 lb CO₂e / MWh`) |
| `us-camx` | USA — California (CAMX) | `0.1840` | US EPA eGRID2024 WECC California Subregion |
| `uk` | United Kingdom | `0.2254` | UK DESNZ 2024 (`0.20705` gen + `0.01830` T&D losses) |
| `eu` | European Union Average | `0.2200` | European Environment Agency (EEA) EU-27 benchmark |
| `de` | Germany National Grid | `0.3300` | EEA / Ember Germany Grid Intensity (2024) |
| `fr` | France National Grid | `0.0500` | RTE France / Ember (nuclear + hydro mix) |
| `in` | India National Grid | `0.7270` | CEA India CO₂ Baseline Database v20.0 (FY 2023-24, incl. RES) |
| `cn` | China National Grid | `0.5500` | Ember / National Grid Carbon Intensity (2024) |
| `ca` | Canada National Average | `0.1150` | ECCC / Ember hydro-dominant national average |
| `au` | Australia National Grid | `0.6400` | DCCEEW / Ember Australia Carbon Intensity (2024) |
| `jp` | Japan National Grid | `0.4750` | MOE / Ember Japan Carbon Intensity (2024) |
| `custom` | Custom Regional Factor | User-defined | Validated local utility / green tariff factor (`0–2.5`) |

---

## 3. Food Emission Factors

Primary datasets: **Poore & Nemecek (*Science*, 2018)**, **Scarborough et al. (*Nature Food*, 2023)**, **US EPA WARM v16**, and **UK DESNZ 2024**.

| Component | Variant | Factor | Unit | Notes |
|---|---|---|---|---|
| **Vegetarian Meals** | Dairy/Egg Vegetarian | `1.2500` | `meals` | Standard ~500 g meal (`~4.16 kg/day ÷ 3` cohort basis) |
| **Vegetarian Meals** | Whole-Plant / Vegan | `0.8200` | `meals` | Scarborough et al. (2023) `2.47 kg/day ÷ 3 meals` |
| **Non-Veg Meals** | Mixed Meat | `3.4000` | `meals` | Mixed omnivorous protein weighting |
| **Non-Veg Meals** | Poultry / Fish | `2.1000` | `meals` | 120 g poultry/fish (`~9.87 kg/kg retail`) + grains/veg sides |
| **Non-Veg Meals** | Pork | `2.4500` | `meals` | 120 g pork (`~12.31 kg/kg retail`) + sides |
| **Non-Veg Meals** | Beef / Red Meat | `6.2000` | `meals` | 100 g beef protein retail LCA + sides |
| **Dairy** | Milk (`250 ml` glass) | `0.7900` | `servings` | `3.15 kg CO₂e/kg × 0.25 L` (Poore & Nemecek 2018) |
| **Dairy** | Cheese (`40 g` slice) | `0.9600` | `servings` | `23.88 kg CO₂e/kg × 0.04 kg` (Poore & Nemecek 2018) |
| **Dairy** | Mixed Dairy (Yogurt/Butter) | `0.6500` | `servings` | Composite dairy portion benchmark |
| **Food Waste** | Landfill Disposal | `0.5781` | `kg` | US EPA WARM v16: `0.5244 MTCO₂e/short ton ÷ 0.907185` |
| **Food Waste** | Composted / Anaerobic Digestion | `0.0090` | `kg` | UK DESNZ 2024 organics treatment (`~9 kg/tonne`) |

---

## 4. Lifestyle Emission & Recycling Offset Factors

Primary datasets: **UK DESNZ 2024** and **US EPA WARM v16**.

| Component | Variant | Direction | Factor | Notes & Assumptions |
|---|---|---|---|---|
| **Water** | Cold Tap / Municipal | Emission | `0.000339 / L` | UK DESNZ 2024: `0.15311` supply + `0.18574` sewage treatment (`0.33885 kg/m³`) |
| **Water** | Hot Water (Electric Heater) | Emission | `0.000339 + 0.0323 × GridFactor / L` | Specific heat `4.184 kJ/(kg·°C)` × `25°C` rise ÷ `3600` ÷ `0.90` heater efficiency |
| **Water** | Hot Water (Gas Boiler) | Emission | `0.007039 / L` | `0.000339` supply/treatment + `0.0067` natural gas water heating |
| **Waste** | Household Municipal Landfill | Emission | `0.4970 / kg` | UK DESNZ 2024 household/municipal landfill (`497.04 kg/tonne`) |
| **Recycling** | Mixed Dry Recyclables | Offset | `3.1200 / kg` | US EPA WARM v16 `-2.83 MTCO₂e/short ton` avoided credit (`0.0064 kg/kg` DESNZ collection noted) |
| **Recycling** | Paper & Cardboard | Offset | `3.4200 / kg` | US EPA WARM v16 `-3.1 MTCO₂e/short ton` conservative bound |
| **Recycling** | Plastic (PET / HDPE) | Offset | `1.6500 / kg` | US EPA WARM v16 `-1.5 MTCO₂e/short ton` conservative bound |
| **Recycling** | Glass Bottles & Jars | Offset | `0.3300 / kg` | US EPA WARM v16 `-0.3 MTCO₂e/short ton` conservative bound |
| **Recycling** | Aluminum Cans | Offset | `10.0600 / kg` | US EPA WARM v16 `-9.13 MTCO₂e/short ton` avoided primary smelting |

---

## Sample Manual Verification Cases (Tested in [`scripts/testCalculationEngine.mjs`](scripts/testCalculationEngine.mjs))

1. **Carpool Petrol Drive (Imperial)**: `10 mi`, `2` passengers → `16.093 km × (0.1645 ÷ 2 = 0.08225 kg/km) = 1.324 kg CO₂e`.
2. **Electric Car on India Grid**: `20 km`, `1` passenger, region `in` (`0.727 kg/kWh`) → `20 km × (0.18 × 0.727 = 0.13086 kg/km) = 2.617 kg CO₂e`.
3. **Round-Trip Short-Haul Economy Flight**: `600 km` one-way, round-trip → `1,200 km × 0.1258 = 150.960 kg CO₂e`.
4. **Walking & Cycling**:
   - Direct walking `5 km`: `5 × 0 = 0.000 kg CO₂e`.
   - Regular bike car-replacement offset `5 km`: `5 × 0.1645 = 0.823 kg saved`.
   - E-bike car-replacement offset on California grid (`0.184 kg/kWh`), `10 km`: `10 × (0.1645 - 0.008 × 0.184 = 0.163028) = 1.630 kg saved`.
5. **Monthly Electricity (California CAMX, Daily Avg, 2 Occupants)**: `300 kWh/month` ÷ `30 days` ÷ `2 occupants` = `5 kWh` × `0.1840 kg/kWh` = `0.920 kg CO₂e`.
6. **Custom Electricity Utility Factor (Full Month)**: `450 kWh` × `0.2500 kg/kWh` = `112.500 kg CO₂e`.
7. **Multi-Item Food Calculation**: `1` Vegetarian meal (`1.25`) + `1` Beef meal (`6.20`) + `2` Milk servings (`1.58`) + `500 g` (`0.5 kg`) landfilled food waste (`0.289`) = `9.319 kg CO₂e` (`9.32 kg` net).
8. **Multi-Item Lifestyle Calculation**: `150 L` cold water (`0.051`) + `2 kg` landfill waste (`0.994`) − `1 kg` mixed recycling offset (`3.120`) = `1.045` emissions − `3.120` offsets = **`-2.08 kg` net CO₂e**.
9. **Invalid / Missing Edge Cases Rejected**: `""`, `"abc"`, `NaN`, `-5`, `0`, `1.2.3`, out-of-range custom grid factor (`3.5 kg/kWh`), all-zero Food/Lifestyle submissions.
