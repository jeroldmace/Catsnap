-- Owners may correct a snap's pin when editing (accuracy over fixed locations).
-- Row level security still limits updates to your own snaps.
grant update (lat, lng) on public.snaps to authenticated;
