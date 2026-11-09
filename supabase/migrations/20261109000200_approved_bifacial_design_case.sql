BEGIN;

ALTER TABLE pv_module_spec
  ADD COLUMN IF NOT EXISTS beta_vmp_source text,
  ADD COLUMN IF NOT EXISTS beta_vmp_derivation text;

ALTER TABLE pv_module_spec
  ADD CONSTRAINT pv_module_beta_vmp_source_valid
  CHECK (beta_vmp_source IS NULL OR beta_vmp_source IN ('datasheet', 'derived'))
  NOT VALID;

CREATE TABLE IF NOT EXISTS pv_bifacial_design_case (
  datasheet_revision_id uuid PRIMARY KEY REFERENCES pv_module_spec(datasheet_revision_id) ON DELETE CASCADE,
  rear_gain_fraction numeric(8, 5) NOT NULL CHECK (rear_gain_fraction > 0 AND rear_gain_fraction <= 1),
  pmax_wp numeric(12, 3) NOT NULL CHECK (pmax_wp > 0),
  voc_v numeric(12, 4) NOT NULL CHECK (voc_v > 0),
  vmp_v numeric(12, 4) NOT NULL CHECK (vmp_v > 0 AND vmp_v < voc_v),
  isc_a numeric(12, 4) NOT NULL CHECK (isc_a > 0),
  imp_a numeric(12, 4) NOT NULL CHECK (imp_a > 0 AND imp_a < isc_a),
  source_page text NOT NULL CHECK (length(trim(source_page)) > 0),
  approval_note text NOT NULL CHECK (length(trim(approval_note)) >= 10),
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pv_bifacial_design_case ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE pv_bifacial_design_case FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  engineering_owner_id uuid;
  engineering_owner_count integer;
  target_revision_id constant uuid := 'd0aa8216-4bc4-419c-a597-9b9023aea741';
  target_inverter_revision_id constant uuid := '75e5da3f-264a-462c-96db-7647817add9b';
  old_spec jsonb;
  old_inverter_spec jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM datasheet_revision WHERE id = target_revision_id) THEN
    RETURN;
  END IF;

  SELECT count(*), min(user_id::text)::uuid
  INTO engineering_owner_count, engineering_owner_id
  FROM role_assignment
  WHERE role_code = 'super_admin'
    AND (expires_at IS NULL OR expires_at > now());

  IF engineering_owner_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one active Super Admin for engineering approval; found %', engineering_owner_count;
  END IF;

  SELECT to_jsonb(pv_module_spec)
  INTO old_spec
  FROM pv_module_spec
  WHERE datasheet_revision_id = target_revision_id
  FOR UPDATE;

  IF old_spec IS NULL THEN
    RAISE EXCEPTION 'Approved LONGi revision has no PV module spec';
  END IF;

  UPDATE pv_module_spec
  SET
    beta_vmp_per_c = -0.00310000,
    beta_vmp_source = 'derived',
    beta_vmp_derivation = 'Engineering owner approved conservative derivation: gamma Pmax (-0.260%/C) minus alpha Isc (+0.050%/C).',
    gamma_pmax_per_c = -0.00260000,
    max_series_fuse_a = 30
  WHERE datasheet_revision_id = target_revision_id;

  INSERT INTO pv_bifacial_design_case (
    datasheet_revision_id,
    rear_gain_fraction,
    pmax_wp,
    voc_v,
    vmp_v,
    isc_a,
    imp_a,
    source_page,
    approval_note,
    approved_by
  ) VALUES (
    target_revision_id,
    0.25000,
    808,
    53.80,
    44.66,
    18.96,
    18.10,
    '2',
    'Engineering owner approved the manufacturer 25% rear-gain design case on 2026-11-09.',
    engineering_owner_id
  )
  ON CONFLICT (datasheet_revision_id) DO UPDATE
  SET
    rear_gain_fraction = EXCLUDED.rear_gain_fraction,
    pmax_wp = EXCLUDED.pmax_wp,
    voc_v = EXCLUDED.voc_v,
    vmp_v = EXCLUDED.vmp_v,
    isc_a = EXCLUDED.isc_a,
    imp_a = EXCLUDED.imp_a,
    source_page = EXCLUDED.source_page,
    approval_note = EXCLUDED.approval_note,
    approved_by = EXCLUDED.approved_by,
    approved_at = now();

  UPDATE datasheet_revision
  SET
    spec_source_pages = spec_source_pages || jsonb_build_object(
      'betaVmpPercentPerC', '2 (derived from gamma Pmax and alpha Isc)',
      'bifacialDesignCase', '2'
    ),
    verified_at = now(),
    verified_by = engineering_owner_id,
    review_note = 'Re-verified by engineering owner: approved 25% rear-gain design case and derived beta Vmp -0.310%/C.'
  WHERE id = target_revision_id;

  INSERT INTO verification_event (
    datasheet_revision_id,
    field_path,
    old_value,
    new_value,
    reason,
    actor_id
  ) VALUES (
    target_revision_id,
    'bifacial_design_case',
    old_spec,
    jsonb_build_object(
      'betaVmpPerC', -0.0031,
      'betaVmpSource', 'derived',
      'rearGainFraction', 0.25,
      'pmaxWp', 808,
      'vocV', 53.8,
      'vmpV', 44.66,
      'iscA', 18.96,
      'impA', 18.10,
      'sourcePage', '2'
    ),
    'Engineering owner approval recorded on 2026-11-09 for the production golden calculation.',
    engineering_owner_id
  );

  INSERT INTO audit_event (
    actor_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json
  ) VALUES (
    engineering_owner_id,
    NULL,
    'revision.reverify_bifacial_design_case',
    'datasheet_revision',
    target_revision_id,
    old_spec,
    jsonb_build_object(
      'state', 'published',
      'betaVmpPerC', -0.0031,
      'rearGainFraction', 0.25,
      'approval', 'engineering_owner'
    )
  );

  IF EXISTS (SELECT 1 FROM datasheet_revision WHERE id = target_inverter_revision_id) THEN
    SELECT to_jsonb(inverter_spec)
    INTO old_inverter_spec
    FROM inverter_spec
    WHERE datasheet_revision_id = target_inverter_revision_id
    FOR UPDATE;

    IF old_inverter_spec IS NULL THEN
      RAISE EXCEPTION 'Approved Deye revision has no inverter spec';
    END IF;

    UPDATE datasheet_revision
    SET
      spec_source_pages = spec_source_pages || jsonb_build_object(
        'maxDcPowerWp', '2',
        'ratedAcKw', '2',
        'maxDcVoltageV', '2',
        'mpptRange', '2',
        'mpptCurrent', '2',
        'startupVoltageV', '2'
      ),
      verified_at = now(),
      verified_by = engineering_owner_id,
      review_note = 'Re-verified by engineering owner against Deye Datasheet page 2 for the production golden calculation.'
    WHERE id = target_inverter_revision_id;

    INSERT INTO verification_event (
      datasheet_revision_id,
      field_path,
      old_value,
      new_value,
      reason,
      actor_id
    ) VALUES (
      target_inverter_revision_id,
      'critical_fields',
      old_inverter_spec,
      jsonb_build_object(
        'maxDcPowerWp', 19200,
        'ratedAcKw', 12,
        'maxDcVoltageV', 500,
        'mpptRangeV', jsonb_build_array(150, 425),
        'maxOperatingCurrentPerMpptA', 26,
        'maxShortCircuitCurrentPerMpptA', 44,
        'startupVoltageV', 125,
        'sourcePage', '2'
      ),
      'Engineering owner re-verified Deye critical fields on 2026-11-09 for the production golden calculation.',
      engineering_owner_id
    );

    INSERT INTO audit_event (
      actor_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      before_json,
      after_json
    ) VALUES (
      engineering_owner_id,
      NULL,
      'revision.reverify_critical_fields',
      'datasheet_revision',
      target_inverter_revision_id,
      old_inverter_spec,
      jsonb_build_object(
        'state', 'published',
        'criticalFields', 'confirmed',
        'sourcePage', '2',
        'approval', 'engineering_owner'
      )
    );
  END IF;
END $$;

COMMIT;
