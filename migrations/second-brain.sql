-- Tools Digital V5 — Second Brain
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'concept',
  ADD COLUMN IF NOT EXISTS properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT notes_type_check CHECK (type IN ('book','event','concept','project','moc'));
CREATE TABLE IF NOT EXISTS public.note_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL,
 source_note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
 target_note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT note_links_distinct CHECK(source_note_id<>target_note_id),
 CONSTRAINT note_links_unique_pair UNIQUE(source_note_id,target_note_id)
);
CREATE INDEX IF NOT EXISTS note_links_owner_source_idx ON public.note_links(owner_id,source_note_id);
CREATE INDEX IF NOT EXISTS note_links_owner_target_idx ON public.note_links(owner_id,target_note_id);
CREATE INDEX IF NOT EXISTS notes_owner_type_idx ON public.notes(owner_id,type);
CREATE INDEX IF NOT EXISTS notes_tags_gin_idx ON public.notes USING gin(tags);
CREATE INDEX IF NOT EXISTS notes_search_idx ON public.notes USING gin(to_tsvector('simple',coalesce(title,'')||' '||coalesce(body,'')));
ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_links_owner_all ON public.note_links FOR ALL USING(owner_id=auth.user_id()) WITH CHECK(owner_id=auth.user_id() AND EXISTS(SELECT 1 FROM public.notes n WHERE n.id=source_note_id AND n.owner_id=auth.user_id()) AND EXISTS(SELECT 1 FROM public.notes n WHERE n.id=target_note_id AND n.owner_id=auth.user_id()));
