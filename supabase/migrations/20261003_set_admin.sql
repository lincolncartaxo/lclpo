-- Migration: Define usuário Lincoln como Admin
-- Execute isso no SQL Editor do Supabase

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
)
WHERE email = 'lclprojetoseireli@gmail.com' -- Substitua pelo seu email de login se for diferente
   OR email = 'contato@lclprojetos.com';
