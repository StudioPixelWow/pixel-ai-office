-- applied migration: office_0004d_system_steps (version 20261030073052)
create or replace function public.office_worker_system_step(p_secret text, p_task uuid, p_lease uuid, p_input jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs; k text; v_unit text; en office.engagements; sp office.service_periods; e office.service_entitlements;
  v_have int; v_need int; i int; v_ci uuid; v_due timestamptz; v_days int; pr office.proposals; v_n int; pv uuid; v_doc jsonb; it jsonb;
  v_out jsonb := '{}'::jsonb; v_sum numeric; v_month date; v_wf uuid; v_cname text; v_reject boolean := false; v_items int := 0;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  k := t.inputs->>'kind';
  if k = 'system:open_period' then
    v_month := coalesce(nullif(t.inputs->'params'->>'month','')::date, office.next_month_start());
    select * into en from office.engagements where id = nullif(t.inputs->'params'->>'engagement_id','')::uuid;
    if en.id is null or en.status <> 'active' then
      return public.office_worker_block(p_secret, p_task, p_lease, 'waiting_input', 'אין התקשרות פעילה ללקוח — לא נפתחת עבודה שוטפת לפני אישור התקשרות ותנאי התחלה');
    end if;
    insert into office.service_periods(org_id, engagement_id, client_id, period_start, period_end)
    values (en.org_id, en.id, en.client_id, date_trunc('month', v_month)::date, (date_trunc('month', v_month) + interval '1 month - 1 day')::date)
    on conflict (engagement_id, period_start) do nothing;
    select * into sp from office.service_periods where engagement_id = en.id and period_start = date_trunc('month', v_month)::date;
    v_out := jsonb_build_object('period_id', sp.id, 'period_start', sp.period_start, 'period_end', sp.period_end, 'engagement_id', en.id);
    if en.rollover_policy is null or en.partial_month_policy is null then
      v_out := v_out || jsonb_build_object('decision_needed', 'לא הוגדר כלל לגלגול יתרות/חודש חלקי — מסומן להחלטתך; לא הומצאה מדיניות');
    end if;
  elsif k = 'system:gantt' then
    select nullif(d.outputs->>'period_id','')::uuid into v_ci from office.task_runs d where d.workflow_run_id = t.workflow_run_id and d.step_key = 'period';
    select * into sp from office.service_periods where id = v_ci;
    if sp.id is null then return public.office_worker_block(p_secret, p_task, p_lease, 'waiting_input', 'לא נמצאה תקופת שירות פתוחה'); end if;
    select name into v_cname from office.clients where id = sp.client_id;
    v_days := (sp.period_end - sp.period_start) + 1;
    for e in select * from office.service_entitlements where engagement_id = sp.engagement_id and active
             and unit in ('post','video','reel','story','article','carousel','newsletter') and quantity_per_period >= 1 loop
      select count(*) into v_have from office.content_items where period_id = sp.id and entitlement_id = e.id and archived_at is null;
      v_need := floor(e.quantity_per_period)::int - v_have;
      for i in 1..greatest(v_need,0) loop
        v_due := ((sp.period_start + ((v_have + i - 0.5) * v_days / floor(e.quantity_per_period))::int)::timestamp + time '10:00') at time zone 'Asia/Jerusalem';
        insert into office.content_items(org_id, client_id, period_id, entitlement_id, topic, format, channel, due_at, production_status, sort, owner_agent)
        values (sp.org_id, sp.client_id, sp.id, e.id, e.title||' #'||(v_have+i), e.unit, coalesce(nullif(e.included_deliverables,''),'social'), v_due, 'planned', v_have + i,
                case when e.unit in ('video','reel') then 'video_editor' when e.unit = 'article' then 'article_writer' else 'creator' end) returning id into v_ci;
        insert into office.quota_allocations(period_id, entitlement_id, content_item_id) values (sp.id, e.id, v_ci) on conflict do nothing;
        v_items := v_items + 1;
      end loop;
    end loop;
    for v_ci in select id from office.content_items where period_id = sp.id and archived_at is null loop
      select e2.unit into v_unit from office.content_items ci join office.service_entitlements e2 on e2.id = ci.entitlement_id where ci.id = v_ci;
      v_wf := office.instantiate_workflow(sp.org_id, t.request_id,
        case when v_unit in ('video','reel') then 'video_production' when v_unit = 'article' then 'single_agent' else 'content_item' end,
        sp.client_id, null, jsonb_build_object('content_item_id', v_ci, 'instruction', 'הפק את פריט התוכן לפי הגאנט, הבריף והמכסה', 'period_id', sp.id),
        'ci:'||v_ci, v_ci, case when v_unit = 'article' then 'article_writer' end, (select topic from office.content_items where id = v_ci));
    end loop;
    v_out := jsonb_build_object('period_id', sp.id, 'created_items', v_items, 'client', v_cname,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'topic', topic, 'due_at', due_at) order by due_at), '[]'::jsonb) from office.content_items where period_id = sp.id));
  elsif k = 'system:proposal_version' then
    select * into pr from office.proposals where id = nullif(t.inputs->'params'->>'proposal_id','')::uuid for update;
    if pr.id is null then return public.office_worker_block(p_secret, p_task, p_lease, 'waiting_input', 'לא נבחרה הצעה'); end if;
    if pr.price_locked_at is null then return public.office_worker_block(p_secret, p_task, p_lease, 'waiting_input', 'חסר המחיר שאתה קובע — מלא מחיר בהצעה כדי להמשיך'); end if;
    select av.data into v_doc from office.task_runs d join office.artifacts ar on ar.id = any(d.output_artifact_ids)
      join office.artifact_versions av on av.artifact_id = ar.id and av.version_no = ar.current_version
      where d.workflow_run_id = t.workflow_run_id and d.step_key = 'draft' limit 1;
    update office.proposals set current_version = current_version + 1, status = 'in_review', updated_at = now() where id = pr.id returning current_version into v_n;
    update office.proposal_versions set review_status = 'superseded' where proposal_id = pr.id and review_status <> 'approved';
    insert into office.proposal_versions(proposal_id, version_no, content, price_snapshot, totals, change_summary, created_by_agent, review_status)
    values (pr.id, v_n, coalesce(v_doc - 'items', '{}'::jsonb),
      jsonb_build_object('setup', pr.locked_setup, 'monthly', pr.locked_monthly, 'media', pr.locked_media_budget, 'locked_at', pr.price_locked_at),
      office.proposal_totals(pr.locked_setup, pr.locked_monthly, pr.locked_media_budget, pr.terms_template_id),
      'גרסה שהוכנה ע״י בונה ההצעות', 'proposal_builder', 'in_review') returning id into pv;
    select coalesce(sum(nullif(x->>'unit_price','')::numeric * coalesce(nullif(x->>'quantity','')::numeric,1)),0) into v_sum
      from jsonb_array_elements(coalesce(v_doc->'items','[]'::jsonb)) x where x->>'kind' = 'setup';
    if v_sum > 0 and v_sum <> coalesce(pr.locked_setup,0) then v_reject := true; end if;
    select coalesce(sum(nullif(x->>'unit_price','')::numeric * coalesce(nullif(x->>'quantity','')::numeric,1)),0) into v_sum
      from jsonb_array_elements(coalesce(v_doc->'items','[]'::jsonb)) x where x->>'kind' = 'retainer';
    if v_sum > 0 and v_sum <> coalesce(pr.locked_monthly,0) then v_reject := true; end if;
    i := 0;
    for it in select * from jsonb_array_elements(coalesce(v_doc->'items','[]'::jsonb)) loop
      i := i + 1;
      insert into office.proposal_items(proposal_version_id, kind, title, description, quantity, unit_price, is_split_suggestion, sort)
      values (pv, case when it->>'kind' in ('setup','retainer','addon','media') then it->>'kind' else 'retainer' end, coalesce(it->>'title','סעיף'), it->>'description',
        coalesce(nullif(it->>'quantity','')::numeric,1), case when v_reject then null else nullif(it->>'unit_price','')::numeric end, true, i);
    end loop;
    if v_reject then perform office.audit(t.org_id,'agent',t.agent_id,'agent_price_change_rejected','proposal',pr.id::text,null,jsonb_build_object('locked_setup',pr.locked_setup,'locked_monthly',pr.locked_monthly)); end if;
    v_out := jsonb_build_object('proposal_version_id', pv, 'version_no', v_n, 'agent_prices_rejected', v_reject);
  elsif k = 'system:price_check' then
    select * into pr from office.proposals where id = nullif(t.inputs->'params'->>'proposal_id','')::uuid;
    select jsonb_build_object('version_no', v.version_no,
       'snapshot_matches_lock', (v.price_snapshot->>'setup')::numeric is not distinct from pr.locked_setup and (v.price_snapshot->>'monthly')::numeric is not distinct from pr.locked_monthly
                               and (v.price_snapshot->>'media')::numeric is not distinct from pr.locked_media_budget,
       'media_separate', true, 'totals', v.totals) into v_out
    from office.proposal_versions v where v.proposal_id = pr.id and v.version_no = pr.current_version;
    if not coalesce((v_out->>'snapshot_matches_lock')::boolean, false) then
      return public.office_worker_block(p_secret, p_task, p_lease, 'waiting_input', 'המחיר בגרסה אינו תואם את המחיר הנעול — נדרשת גרסה חדשה');
    end if;
  else
    raise exception 'unknown_system_step:%', k;
  end if;
  return public.office_worker_complete(p_secret, p_task, p_lease, jsonb_build_object('outputs', v_out, 'stage', 'הושלם', 'summary', k));
end $$;
