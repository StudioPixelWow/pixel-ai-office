-- create_lead stores the client's field of business (leads.industry). Patched in place on the deployed act_crm.
do $$ declare d text; n text; begin
  d := pg_get_functiondef('office.act_crm(office.memberships,text,jsonb)'::regprocedure);
  if position('nullif(p->>''industry''' in d) > 0 then return; end if;
  n := replace(d, 'contact_phone_e164, contact_email, need, goals, requested_services,', 'contact_phone_e164, contact_email, industry, need, goals, requested_services,');
  n := replace(n, '      p->>''need'', p->>''goals'', coalesce(array(select jsonb_array_elements_text(coalesce(p->''requested_services'',''[]''))),''{}''),', '      nullif(p->>''industry'',''''), p->>''need'', p->>''goals'', coalesce(array(select jsonb_array_elements_text(coalesce(p->''requested_services'',''[]''))),''{}''),');
  if n = d then raise exception 'patch_not_applied'; end if;
  execute n;
end $$;
