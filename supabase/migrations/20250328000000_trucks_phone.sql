-- Customer-facing call number per truck (stable). One per fleet vehicle; not tied to setup codes or tablet registrations.
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS phone TEXT;
