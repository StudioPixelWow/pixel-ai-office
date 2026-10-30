-- Step-level instruction/max_tokens in task inputs + client_research split (dossier → library → save)
do $$ declare d text; begin
d := pg_get_functiondef('office.instantiate_workflow'::regproc);
d := replace(d, $x$jsonb_build_object('kind', s->>'kind', 'output_kind', s->>'output_kind', 'params', coalesce(p_params,'{}'::jsonb))$x$,
 $x$jsonb_strip_nulls(jsonb_build_object('kind', s->>'kind', 'output_kind', s->>'output_kind', 'instruction', s->>'instruction', 'max_tokens', s->'max_tokens')) || jsonb_build_object('params', coalesce(p_params,'{}'::jsonb))$x$);
execute d; end $$;
-- Template steps were updated in place (see office.workflow_templates key='client_research'):
-- crawl, social, web, gpt → dossier (part A, 9000 tok) → library (part B, 9000 tok) → save (depends crawl, social, dossier, library)
