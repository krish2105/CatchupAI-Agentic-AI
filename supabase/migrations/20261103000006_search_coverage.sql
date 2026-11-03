-- Retrieval evidence v2: also return LEXICAL COVERAGE — the share of the query's meaningful (stemmed, non-stopword)
-- terms that appear in the passage. Measured by the evaluation suite: rank alone rejected short relevant
-- questions (one-word queries scored ~0.03 < 0.08) while unrelated queries score exactly 0.
drop function if exists public.search_course_chunks(uuid, text, extensions.vector, integer);

create or replace function public.search_course_chunks(
  p_course_id uuid,
  p_query text,
  p_query_embedding extensions.vector(1536) default null,
  p_limit integer default 6
)
returns table (
  chunk_id uuid,
  document_id uuid,
  filename text,
  page_start integer,
  page_end integer,
  content text,
  lexical_rank real,
  lexical_coverage real,
  vector_similarity double precision,
  score double precision
)
language sql stable security invoker
set search_path = public, extensions
as $$
  with q as (
    select nullif(replace(plainto_tsquery('english', left(coalesce(p_query, ''), 500))::text, '&', '|'), '')::tsquery as tsq,
           array(select distinct lexeme from unnest(to_tsvector('english', left(coalesce(p_query, ''), 500)))) as lexemes
  ),
  scoped as (
    select c.id, c.content_tsv, c.embedding
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where c.course_id = p_course_id
      and c.owner_id = (select auth.uid())
      and d.status = 'ready'
  ),
  lexical as (
    select s.id, ts_rank_cd(s.content_tsv, q.tsq, 1) as rank,
           (select count(*) from unnest(q.lexemes) l where l = any(tsvector_to_array(s.content_tsv)))::real
             / greatest(cardinality(q.lexemes), 1) as coverage,
           row_number() over (order by ts_rank_cd(s.content_tsv, q.tsq, 1) desc) as rn
    from scoped s, q
    where q.tsq is not null and s.content_tsv @@ q.tsq
    order by rank desc
    limit 30
  ),
  semantic as (
    select s.id, (1 - (s.embedding <=> p_query_embedding))::double precision as sim,
           row_number() over (order by s.embedding <=> p_query_embedding) as rn
    from scoped s
    where p_query_embedding is not null and s.embedding is not null
    order by s.embedding <=> p_query_embedding
    limit 30
  ),
  fused as (
    select coalesce(l.id, v.id) as id, l.rank, l.coverage, v.sim,
           coalesce(1.0 / (60 + l.rn), 0) + coalesce(1.0 / (60 + v.rn), 0) as score
    from lexical l
    full outer join semantic v on v.id = l.id
  )
  select c.id, c.document_id, d.filename, c.page_start, c.page_end, c.content,
         f.rank::real, f.coverage::real, f.sim, f.score::double precision
  from fused f
  join public.document_chunks c on c.id = f.id
  join public.documents d on d.id = c.document_id
  order by f.score desc, c.chunk_index
  limit least(greatest(coalesce(p_limit, 6), 1), 6);
$$;

revoke all on function public.search_course_chunks(uuid, text, extensions.vector, integer) from public, anon;
grant execute on function public.search_course_chunks(uuid, text, extensions.vector, integer) to authenticated, service_role;
