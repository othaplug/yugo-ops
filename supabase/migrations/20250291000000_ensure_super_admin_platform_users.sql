-- Ensure super admin accounts have platform_users rows.
-- Previous migrations only did UPDATE which matched zero rows if the INSERT never happened.

INSERT INTO public.platform_users (user_id, email, name, role)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), 'owner'
FROM auth.users u
WHERE u.email IN ('othaplug@gmail.com', 'oche@helloyugo.com')
ON CONFLICT (user_id) DO UPDATE SET role = 'owner';
