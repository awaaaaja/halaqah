-- RPC: Lookup email by NIM for login
-- Security definer agar bisa diakses sebelum auth (login page)
CREATE OR REPLACE FUNCTION public.get_email_by_nim(p_nim text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email FROM public.profiles WHERE nim = p_nim LIMIT 1;
$$;
