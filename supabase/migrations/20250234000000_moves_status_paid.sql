-- Rename final_payment_received to paid for moves.status
UPDATE public.moves SET status = 'paid' WHERE status = 'final_payment_received';
