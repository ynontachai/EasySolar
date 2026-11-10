BEGIN;

DO $$
DECLARE
  engineering_owner_id uuid;
  engineering_owner_count integer;
  target record;
  old_spec jsonb;
  derived_beta_vmp numeric(12, 8);
  derivation_note constant text :=
    'Engineering override: beta Vmp derived as gamma Pmax minus alpha Isc because the manufacturer Datasheet does not publish beta Vmp.';
  approval_note constant text :=
    'Super Admin approved the conservative beta Vmp derivation for preliminary DC string sizing.';
BEGIN
  SELECT count(*), min(user_id::text)::uuid
  INTO engineering_owner_count, engineering_owner_id
  FROM role_assignment
  WHERE role_code = 'super_admin'
    AND (expires_at IS NULL OR expires_at > now());

  IF engineering_owner_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one active Super Admin for beta Vmp approval; found %',
      engineering_owner_count;
  END IF;

  FOR target IN
    SELECT
      spec.datasheet_revision_id,
      product.exact_model,
      spec.beta_vmp_per_c,
      spec.beta_vmp_source,
      spec.gamma_pmax_per_c,
      spec.alpha_isc_per_c
    FROM pv_module_spec AS spec
    JOIN datasheet_revision AS revision
      ON revision.id = spec.datasheet_revision_id
    JOIN product_model AS product
      ON product.id = revision.product_model_id
    WHERE revision.state = 'published'
      AND (
        (
          spec.beta_vmp_per_c IS NULL
          AND spec.gamma_pmax_per_c IS NOT NULL
          AND spec.alpha_isc_per_c IS NOT NULL
        )
        OR (
          spec.beta_vmp_source = 'derived'
          AND spec.beta_vmp_approved_at IS NULL
        )
      )
    FOR UPDATE OF spec
  LOOP
    SELECT to_jsonb(spec)
    INTO old_spec
    FROM pv_module_spec AS spec
    WHERE spec.datasheet_revision_id = target.datasheet_revision_id;

    derived_beta_vmp := COALESCE(
      target.beta_vmp_per_c,
      target.gamma_pmax_per_c - target.alpha_isc_per_c
    );

    UPDATE pv_module_spec
    SET
      beta_vmp_per_c = derived_beta_vmp,
      beta_vmp_source = 'derived',
      beta_vmp_derivation = COALESCE(beta_vmp_derivation, derivation_note),
      beta_vmp_approved_by = engineering_owner_id,
      beta_vmp_approved_at = now(),
      beta_vmp_approval_note = approval_note
    WHERE datasheet_revision_id = target.datasheet_revision_id;

    UPDATE datasheet_revision
    SET
      spec_source_pages = spec_source_pages || jsonb_build_object(
        'betaVmpPercentPerC',
        'Derived from Datasheet gamma Pmax and alpha Isc'
      ),
      verified_at = now(),
      verified_by = engineering_owner_id,
      review_note = concat_ws(
        ' ',
        NULLIF(trim(review_note), ''),
        'Super Admin approved derived beta Vmp for preliminary DC string sizing.'
      )
    WHERE id = target.datasheet_revision_id;

    INSERT INTO verification_event (
      datasheet_revision_id,
      field_path,
      old_value,
      new_value,
      reason,
      actor_id
    ) VALUES (
      target.datasheet_revision_id,
      'beta_vmp_per_c',
      old_spec,
      jsonb_build_object(
        'model', target.exact_model,
        'betaVmpPerC', derived_beta_vmp,
        'betaVmpSource', 'derived',
        'formula', 'gammaPmaxPerC - alphaIscPerC',
        'gammaPmaxPerC', target.gamma_pmax_per_c,
        'alphaIscPerC', target.alpha_isc_per_c,
        'approvedBy', engineering_owner_id
      ),
      approval_note,
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
      'revision.approve_derived_beta_vmp',
      'datasheet_revision',
      target.datasheet_revision_id,
      old_spec,
      jsonb_build_object(
        'model', target.exact_model,
        'betaVmpPerC', derived_beta_vmp,
        'betaVmpSource', 'derived',
        'approval', 'super_admin'
      )
    );
  END LOOP;
END $$;

COMMIT;
