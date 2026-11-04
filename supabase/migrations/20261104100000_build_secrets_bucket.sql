-- Private bucket for the app's release signing key (used by build sessions only,
-- via the build-key edge function). No policies: only server code can access it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('build-secrets', 'build-secrets', false, 1048576, array['application/json']);
