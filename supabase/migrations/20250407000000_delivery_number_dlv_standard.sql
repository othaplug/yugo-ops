-- Standardize delivery_number to DLV-xxxx format globally.
-- Migrates PJxxxx (legacy) to DLV-xxxx to match generateDeliveryNumber() and invoice format.

UPDATE public.deliveries
SET delivery_number = 'DLV-' || LPAD(COALESCE(SUBSTRING(delivery_number FROM '[0-9]+'), '0'), 4, '0')
WHERE delivery_number ~ '^PJ[0-9]{4}$';
