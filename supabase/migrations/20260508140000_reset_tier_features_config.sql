-- Reset stored tier features config so tier cards fall back to the corrected code defaults.
--
-- Background: platform_config stores a JSON blob under 'quote_residential_tier_features'.
-- That blob had old tier card text ("Protective wrapping for key furniture",
-- "Standard valuation coverage", old Signature/Estate additions). Clearing it forces
-- buildResidentialTierFeatureBundle() to use DEFAULT_RESIDENTIAL_TIER_FEATURES_STORAGE
-- from code, which was already updated with the correct copy.
--
-- After this migration runs, the Platform Settings > Quote Display page will show the
-- corrected defaults. If a coordinator edits and saves from that page the new correct
-- values will be re-persisted to platform_config.

DELETE FROM public.platform_config
WHERE key = 'quote_residential_tier_features';
