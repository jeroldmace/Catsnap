-- Free-form tags: bound how many and how long, so tags can't be abused to
-- store large amounts of text. (The app enforces 10 tags of 24 characters.)
alter table public.snaps
  add constraint snaps_tags_limits check (
    cardinality(tags) <= 10
    and char_length(array_to_string(tags, '')) <= 240
  );
