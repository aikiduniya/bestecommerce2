-- Run ONCE as the postgres superuser on an EMPTY PostgreSQL 15+ database, before starting GoTrue/Storage/PostgREST.
-- Replace the three passwords below.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login password 'CHANGE_ME_AUTHENTICATOR' noinherit;
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login password 'CHANGE_ME_AUTH_ADMIN' createrole noinherit;
create role supabase_storage_admin login password 'CHANGE_ME_STORAGE_ADMIN' createrole noinherit;
grant anon, authenticated, service_role to supabase_storage_admin;
create schema auth authorization supabase_auth_admin;
create schema storage authorization supabase_storage_admin;
create schema extensions;
create extension pgcrypto schema extensions;
create extension "uuid-ossp" schema extensions;
grant usage on schema public, extensions to anon, authenticated, service_role;
grant usage on schema auth, storage to anon, authenticated, service_role;
grant create on database postgres to supabase_auth_admin, supabase_storage_admin;
alter role supabase_auth_admin set search_path = auth;
alter database postgres set search_path = "$user", public, extensions;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role, authenticated, anon;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
