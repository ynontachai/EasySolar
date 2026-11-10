# EasySolar delivery status

Updated: 2026-11-10

## Done

- Audited the inverter and PV module fields against every Datasheet PDF in the repository.
- Displayed every required specification with its source status: Datasheet, approved derived value, or missing.
- Corrected bifacial current checks so Imp and Isc use the same approved design case.
- Added partial temperature calculations without substituting βVoc for a missing βVmp.
- Added complete String-to-MPPT connection diagrams and responsive layouts.
- Updated the PV spec form to capture βVoc, γPmax, αIsc, and the βVmp source.
- Added server-side βVmp derivation using `γPmax − αIsc`.
- Required Super Admin approval, a reason, and an audit record for derived βVmp values.
- Updated the inverter spec form to accept either recommended PV power, maximum PV input power, or both.
- Split MPPT source references into voltage range, operating current, short-circuit current, and topology.
- Added database migrations and backfill rules for the Datasheet values already extracted from AIKO, LONGi, and LP210 PDFs.
- Updated the bulk import script and verification checklist to match the new data rules.
- Passed type checking, 78 unit tests, lint, production build, and responsive checks at 390px, 768px, and 1440px.

## TODO

- Apply `supabase/migrations/20261110000100_datasheet_spec_input_alignment.sql` to the Production Supabase project.
- Re-open affected draft or unverified revisions and confirm the new page references.
- Have a Super Admin approve each derived βVmp value before publishing its revision.
- Smoke-test the Production spec form, review queue, Datasheet download, and sizing result after the migration.
- Confirm that the Production deployment uses engine version `0.3.1`.
