-- applied migration: office_0008_draft_requeue_version (version 20261030075844)
create or replace function office.draft_touch() returns trigger language plpgsql set search_path = office, public as $$
begin
  if tg_op = 'UPDATE' and (new.body is distinct from old.body or new.recipient_e164 is distinct from old.recipient_e164
     or new.attachments is distinct from old.attachments or new.sender_connection_id is distinct from old.sender_connection_id
     or new.template_name is distinct from old.template_name or new.template_params is distinct from old.template_params
     or new.contact_id is distinct from old.contact_id or new.conversation_id is distinct from old.conversation_id) then
    if old.status in ('sending','accepted','delivered','read') then raise exception 'draft_locked_after_send'; end if;
    new.draft_version := old.draft_version + 1;
  elsif tg_op = 'UPDATE' and new.status = 'pending_approval' and old.status <> 'pending_approval' and old.status <> 'draft' then
    -- re-entering the queue after review/abort/failure = a new version; an old approval can never be reused
    new.draft_version := old.draft_version + 1;
  end if;
  new.snapshot_hash := office.draft_hash(new);
  new.updated_at := now();
  return new;
end $$;
