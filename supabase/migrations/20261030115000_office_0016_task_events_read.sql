-- Work room: task events readable through office_list (client-scoped like task_runs)
insert into office.read_entities(entity, table_name, client_col, project_col, admin_only, hidden_cols, default_order)
values ('task_events','task_events','client_id',null,false,'{}','created_at desc') on conflict (entity) do nothing;
