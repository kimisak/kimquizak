begin;

grant delete on public.quiz_snapshots to authenticated;

drop policy if exists "Owner deletes own snapshots" on public.quiz_snapshots;
create policy "Owner deletes own snapshots" on public.quiz_snapshots
  for delete to authenticated
  using ((select private.is_quiz_owner()) and owner_id = (select auth.uid()));

commit;
