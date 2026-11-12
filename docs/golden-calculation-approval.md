# Golden calculation approval: LONGi LR7-72HVD-645M + Deye SUN-12K-SG02LP1-EU-AM3

Status: **Approved by the EasySolar engineering owner on 2026-11-09.**

## Scope

This calculation checks the DC-side limits implemented by EasySolar engine `0.3.0`. It does not cover cable sizing, fuses, connectors, isolators, SPD, earthing, structures, AC design, grid code, or site-specific approval.

Equipment records:

- PV model ID: `98eaa963-a611-49e6-a8df-f0354f09be7a`
- PV revision ID: `d0aa8216-4bc4-419c-a597-9b9023aea741`
- Inverter model ID: `23c710e2-6612-4be5-a315-d8d45daad33e`
- Inverter revision ID: `75e5da3f-264a-462c-96db-7647817add9b`

## Manufacturer values

LONGi Datasheet page 2 gives these values for `LR7-72HVD-645M`:

| Field | Front-side STC | 25% rear-side power gain |
| --- | ---: | ---: |
| Pmax | 645 W | 808 W |
| Voc | 53.70 V | 53.80 V |
| Isc | 15.17 A | 18.96 A |
| Vmp | 44.56 V | 44.66 V |
| Imp | 14.48 A | 18.10 A |

The same page gives `βVoc = -0.200%/°C`, `γPmax = -0.260%/°C`, `αIsc = +0.050%/°C`, maximum system voltage 1,500 V, and bifaciality `70±5%`. It does not publish `βVmp`.

Deye Datasheet page 2 gives these limits for `SUN-12K-SG02LP1-EU-AM3`:

| Field | Value |
| --- | ---: |
| Maximum PV access power | 24,000 W |
| Maximum PV input power | 19,200 W |
| Maximum PV input voltage | 500 V |
| Startup voltage | 125 V |
| MPPT voltage range | 150–425 V |
| MPPT count | 3 |
| Maximum operating current per MPPT | 26 A |
| Maximum short-circuit current per MPPT | 44 A |
| Physical inputs per MPPT | 2 |

Sources:

- [LONGi Datasheet](./DataSheet/panel/LR_7_72_HVD_625_645_M_30_30_and_15_Explorer_V01_EN_6fa071867c.pdf)
- [Deye Datasheet](<./DataSheet/inverter/【b】datasheet_sun-7.6-12k-sg02lp1-eu-am2_30240102201653_20250520_en.pdf>)
- [LONGi official copy](https://static.longi.com/LR_7_72_HVD_625_645_M_30_30_and_15_Explorer_V01_EN_6fa071867c.pdf)

## Engineering decision

The engineering owner approved both assumptions below on 2026-11-09:

1. Use 25% rear-side power gain as the design case because the Datasheet publishes complete electrical values for that case.
2. Use `βVmp = γPmax − αIsc = -0.260%/°C − 0.050%/°C = -0.310%/°C` as a conservative modeled coefficient. The manufacturer does not publish `βVmp`; the database and UI must label this value as derived, not measured.

Other bifacial revisions use the Front-side-only system override until the engineering owner approves a revision-specific rear-side design case. The override uses the published front-side Pmax, Voc, Vmp, Isc and Imp and excludes rear-irradiance gain.

## Golden assumptions

| Assumption | Value |
| --- | ---: |
| Minimum cell temperature | -10°C |
| Maximum cell temperature | 70°C |
| Isc safety factor | 1.25 |
| Target front-side DC power | 11,000 Wp |
| Rear-side power gain | 25% |
| Proposed layout | MPPT 1: 6S1P; MPPT 2: 6S1P; MPPT 3: 5S1P |

## Expected calculations

Use the 25% rear-gain values `Vmp = 44.66 V`, `Voc = 53.80 V`, `Imp = 18.10 A`, and `Isc = 18.96 A`.

Per-module temperature-adjusted voltages:

- Hot Vmp = `44.66 × [1 + (-0.00310 × (70 - 25))]` = **38.43 V**
- Cold Vmp = `44.66 × [1 + (-0.00310 × (-10 - 25))]` = **49.51 V**
- Cold Voc = `53.80 × [1 + (-0.00200 × (-10 - 25))]` = **57.57 V**

String checks:

| Layout | Hot Vmp | Cold Vmp | Cold Voc | Result |
| --- | ---: | ---: | ---: | --- |
| 5S1P | 192.15 V | 247.53 V | 287.83 V | Passes startup, MPPT, and maximum voltage limits |
| 6S1P | 230.58 V | 297.03 V | 345.40 V | Passes startup, MPPT, and maximum voltage limits |

Current checks per MPPT:

- Operating current = `1 × 18.10` = **18.10 A ≤ 26 A**
- Design short-circuit current = `1 × 18.96 × 1.25` = **23.70 A ≤ 44 A**
- Two parallel strings fail: `36.20 A > 26 A` and `47.40 A > 44 A`

Power checks for 17 modules:

- Front-side DC power = `17 × 645` = **10,965 Wp**
- 25% rear-gain design power = `17 × 808` = **13,736 W**
- Front-side DC/AC ratio = `10,965 ÷ 12,000` = **0.914**
- Rear-gain DC/AC ratio = `13,736 ÷ 12,000` = **1.145**
- Rear-gain design power remains below the inverter's 19,200 W maximum PV input power.

## Approval criteria

The engineering owner approves this fixture only if all statements below are true:

- The 25% rear-gain case is suitable as the maximum design case for the intended installation boundary.
- The derived `βVmp = -0.310%/°C` is acceptable for preliminary DC sizing.
- `-10°C`, `70°C`, and `1.25 × Isc` are acceptable default assumptions for this fixture.
- The expected layout is `6S1P + 6S1P + 5S1P` and both front-side and rear-gain power checks must pass.
- EasySolar continues to label the result preliminary and keeps all out-of-scope electrical and structural checks visible.

Approval record:

- Engineering owner: EasySolar engineering owner with Super Admin authority
- Decision: Approved
- Date: 2026-11-09
- Notes: Approved the 25% manufacturer rear-gain case and derived `βVmp = -0.310%/°C` for this golden fixture.
