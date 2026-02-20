-- Ensure PostgREST can see public schema objects for anon/authenticated roles.
grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all privileges on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all privileges on sequences to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;

do $$
begin
  begin
    alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public';
  exception
    when undefined_object then
      null;
  end;
end;
$$;

select pg_notify('pgrst', 'reload config');
select pg_notify('pgrst', 'reload schema');
