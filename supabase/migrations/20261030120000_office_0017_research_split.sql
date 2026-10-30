-- Step-level instruction/max_tokens in task inputs + client_research split (dossier → library → save)
do $$ declare d text; begin
d := pg_get_functiondef('office.instantiate_workflow'::regproc);
d := replace(d, $x$jsonb_build_object('kind', s->>'kind', 'output_kind', s->>'output_kind', 'params', coalesce(p_params,'{}'::jsonb))$x$,
 $x$jsonb_strip_nulls(jsonb_build_object('kind', s->>'kind', 'output_kind', s->>'output_kind', 'instruction', s->>'instruction', 'max_tokens', s->'max_tokens')) || jsonb_build_object('params', coalesce(p_params,'{}'::jsonb))$x$);
execute d; end $$;
-- Template steps were updated in place (see office.workflow_templates key='client_research'):
-- crawl, social, web, gpt → dossier (part A, 9000 tok) → library (part B, 9000 tok) → save (depends crawl, social, dossier, library)

-- Keep the full structured dossier on the client for the visual brand book
do $$ declare d text; begin
d := pg_get_functiondef('public.office_worker_save_dossier(text,uuid,uuid,jsonb,jsonb)'::regprocedure);
if position('''dossier'', d' in d)=0 then
d := replace(d, $x$jsonb_build_object('research_at', now(),$x$, $x$jsonb_build_object('dossier', d, 'dossier_extra', x, 'research_at', now(),$x$);
execute d; end if; end $$;

-- approve_knowledge accepts {ids:[...]} for bulk approval
do $$ declare fn regprocedure; d text; begin
select p.oid::regprocedure into fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='office' and p.proname='act_admin' limit 1;
d := pg_get_functiondef(fn);
d := replace(d, $x$where id = (p->>'id')::uuid and org_id = m.org_id;
  when 'register_file'$x$, $x$where org_id = m.org_id and (id = nullif(p->>'id','')::uuid or id in (select v::uuid from jsonb_array_elements_text(coalesce(p->'ids','[]'::jsonb)) v));
  when 'register_file'$x$);
execute d; end $$;
