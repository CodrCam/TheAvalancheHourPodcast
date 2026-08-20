-- Season Mastermind planning schema for Aurora PostgreSQL 17.
-- UUID primary keys are supplied by the future application; no extensions are required.

BEGIN;

CREATE SCHEMA IF NOT EXISTS season_mastermind;
REVOKE ALL ON SCHEMA season_mastermind FROM PUBLIC;

CREATE TABLE IF NOT EXISTS season_mastermind.planning_season (
  season_id uuid PRIMARY KEY,
  label varchar(80) NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'planning',
  planning_goal text NOT NULL DEFAULT '',
  created_by_person_id varchar(180),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT planning_season_label_valid CHECK (
    label = btrim(label)
    AND char_length(label) BETWEEN 2 AND 80
  ),
  CONSTRAINT planning_season_dates_valid CHECK (
    ends_on >= starts_on
    AND ends_on <= starts_on + 550
  ),
  CONSTRAINT planning_season_status_valid CHECK (
    status IN ('planning', 'active', 'complete', 'archived')
  ),
  CONSTRAINT planning_season_goal_valid CHECK (
    char_length(planning_goal) <= 2400
  ),
  CONSTRAINT planning_season_creator_valid CHECK (
    created_by_person_id IS NULL
    OR (
      created_by_person_id = btrim(created_by_person_id)
      AND char_length(created_by_person_id) BETWEEN 1 AND 180
    )
  ),
  CONSTRAINT planning_season_revision_valid CHECK (revision >= 1)
);

CREATE TABLE IF NOT EXISTS season_mastermind.episode_plan (
  episode_plan_id uuid PRIMARY KEY,
  season_id uuid NOT NULL,
  working_title varchar(180) NOT NULL,
  premise text NOT NULL,
  listener_takeaway text NOT NULL DEFAULT '',
  episode_type varchar(24) NOT NULL DEFAULT 'regular',
  status varchar(24) NOT NULL DEFAULT 'idea',
  target_air_date date,
  source_intake_item_id varchar(180),
  linked_episode_id varchar(180),
  owner_person_id varchar(180),
  created_by_person_id varchar(180),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT episode_plan_season_fk FOREIGN KEY (season_id)
    REFERENCES season_mastermind.planning_season (season_id)
    ON DELETE RESTRICT,
  CONSTRAINT episode_plan_title_valid CHECK (
    working_title = btrim(working_title)
    AND char_length(working_title) BETWEEN 3 AND 180
  ),
  CONSTRAINT episode_plan_premise_valid CHECK (
    premise = btrim(premise)
    AND char_length(premise) BETWEEN 10 AND 6000
  ),
  CONSTRAINT episode_plan_takeaway_valid CHECK (
    char_length(listener_takeaway) <= 2400
  ),
  CONSTRAINT episode_plan_type_valid CHECK (
    episode_type IN ('regular', 'slabs_and_sluffs', 'special')
  ),
  CONSTRAINT episode_plan_status_valid CHECK (
    status IN (
      'idea',
      'researching',
      'ready',
      'scheduled',
      'recording',
      'published',
      'archived'
    )
  ),
  CONSTRAINT episode_plan_intake_link_valid CHECK (
    source_intake_item_id IS NULL
    OR (
      source_intake_item_id = btrim(source_intake_item_id)
      AND char_length(source_intake_item_id) BETWEEN 1 AND 180
    )
  ),
  CONSTRAINT episode_plan_episode_link_valid CHECK (
    linked_episode_id IS NULL
    OR (
      linked_episode_id = btrim(linked_episode_id)
      AND char_length(linked_episode_id) BETWEEN 1 AND 180
    )
  ),
  CONSTRAINT episode_plan_owner_valid CHECK (
    owner_person_id IS NULL
    OR (
      owner_person_id = btrim(owner_person_id)
      AND char_length(owner_person_id) BETWEEN 1 AND 180
    )
  ),
  CONSTRAINT episode_plan_creator_valid CHECK (
    created_by_person_id IS NULL
    OR (
      created_by_person_id = btrim(created_by_person_id)
      AND char_length(created_by_person_id) BETWEEN 1 AND 180
    )
  ),
  CONSTRAINT episode_plan_revision_valid CHECK (revision >= 1),
  CONSTRAINT episode_plan_intake_link_unique UNIQUE (source_intake_item_id),
  CONSTRAINT episode_plan_episode_link_unique UNIQUE (linked_episode_id)
);

-- Compatibility for a cluster where an earlier copy of this migration already
-- created episode_plan. PostgreSQL 17 adds this constant default without a row-
-- by-row table rewrite, and the bounded table is validated before commit.
ALTER TABLE season_mastermind.episode_plan
  ADD COLUMN IF NOT EXISTS episode_type varchar(24)
  NOT NULL DEFAULT 'regular';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'episode_plan_type_valid'
      AND conrelid = 'season_mastermind.episode_plan'::regclass
  ) THEN
    ALTER TABLE season_mastermind.episode_plan
      ADD CONSTRAINT episode_plan_type_valid
      CHECK (episode_type IN ('regular', 'slabs_and_sluffs', 'special'))
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE season_mastermind.episode_plan
  VALIDATE CONSTRAINT episode_plan_type_valid;

CREATE TABLE IF NOT EXISTS season_mastermind.episode_host (
  episode_host_id uuid PRIMARY KEY,
  episode_plan_id uuid NOT NULL,
  host_person_id varchar(180),
  host_display_name varchar(180) NOT NULL,
  host_role varchar(20) NOT NULL DEFAULT 'host',
  assignment_status varchar(20) NOT NULL DEFAULT 'proposed',
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT episode_host_plan_fk FOREIGN KEY (episode_plan_id)
    REFERENCES season_mastermind.episode_plan (episode_plan_id)
    ON DELETE CASCADE,
  CONSTRAINT episode_host_person_link_valid CHECK (
    host_person_id IS NULL
    OR (
      host_person_id = btrim(host_person_id)
      AND char_length(host_person_id) BETWEEN 1 AND 180
    )
  ),
  CONSTRAINT episode_host_display_name_valid CHECK (
    host_display_name = btrim(host_display_name)
    AND char_length(host_display_name) BETWEEN 2 AND 180
  ),
  CONSTRAINT episode_host_role_valid CHECK (
    host_role IN ('lead_host', 'host', 'co_host', 'guest_host')
  ),
  CONSTRAINT episode_host_assignment_status_valid CHECK (
    assignment_status IN ('proposed', 'confirmed', 'unavailable', 'complete')
  ),
  CONSTRAINT episode_host_sort_valid CHECK (
    sort_order BETWEEN 0 AND 1000
  )
);

CREATE TABLE IF NOT EXISTS season_mastermind.guest_candidate (
  guest_id uuid PRIMARY KEY,
  display_name varchar(180) NOT NULL,
  public_affiliation varchar(240) NOT NULL DEFAULT '',
  public_profile_url text,
  public_context text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT guest_candidate_name_valid CHECK (
    display_name = btrim(display_name)
    AND char_length(display_name) BETWEEN 2 AND 180
  ),
  CONSTRAINT guest_candidate_affiliation_valid CHECK (
    char_length(public_affiliation) <= 240
  ),
  CONSTRAINT guest_candidate_public_url_valid CHECK (
    public_profile_url IS NULL
    OR (
      char_length(public_profile_url) BETWEEN 9 AND 1200
      AND public_profile_url ~ '^https://'
    )
  ),
  CONSTRAINT guest_candidate_context_valid CHECK (
    char_length(public_context) <= 4000
  )
);

CREATE TABLE IF NOT EXISTS season_mastermind.topic (
  topic_id uuid PRIMARY KEY,
  slug varchar(100) NOT NULL,
  label varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT topic_slug_unique UNIQUE (slug),
  CONSTRAINT topic_slug_valid CHECK (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  CONSTRAINT topic_label_valid CHECK (
    label = btrim(label)
    AND char_length(label) BETWEEN 2 AND 120
  )
);

CREATE TABLE IF NOT EXISTS season_mastermind.research_source (
  source_id uuid PRIMARY KEY,
  canonical_url text NOT NULL,
  title varchar(300) NOT NULL,
  publisher varchar(180) NOT NULL DEFAULT '',
  source_kind varchar(24) NOT NULL DEFAULT 'website',
  public_summary text NOT NULL DEFAULT '',
  published_on date,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT research_source_url_unique UNIQUE (canonical_url),
  CONSTRAINT research_source_url_valid CHECK (
    char_length(canonical_url) BETWEEN 9 AND 1600
    AND canonical_url ~ '^https://'
  ),
  CONSTRAINT research_source_title_valid CHECK (
    title = btrim(title)
    AND char_length(title) BETWEEN 2 AND 300
  ),
  CONSTRAINT research_source_publisher_valid CHECK (
    char_length(publisher) <= 180
  ),
  CONSTRAINT research_source_kind_valid CHECK (
    source_kind IN (
      'article',
      'paper',
      'project',
      'video',
      'dataset',
      'website',
      'other'
    )
  ),
  CONSTRAINT research_source_summary_valid CHECK (
    char_length(public_summary) <= 6000
  )
);

CREATE TABLE IF NOT EXISTS season_mastermind.episode_guest (
  episode_plan_id uuid NOT NULL,
  guest_id uuid NOT NULL,
  guest_role varchar(20) NOT NULL DEFAULT 'primary',
  invitation_status varchar(24) NOT NULL DEFAULT 'candidate',
  public_angle varchar(1000) NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (episode_plan_id, guest_id),
  CONSTRAINT episode_guest_plan_fk FOREIGN KEY (episode_plan_id)
    REFERENCES season_mastermind.episode_plan (episode_plan_id)
    ON DELETE CASCADE,
  CONSTRAINT episode_guest_guest_fk FOREIGN KEY (guest_id)
    REFERENCES season_mastermind.guest_candidate (guest_id)
    ON DELETE CASCADE,
  CONSTRAINT episode_guest_role_valid CHECK (
    guest_role IN ('primary', 'co_guest', 'expert', 'backup')
  ),
  CONSTRAINT episode_guest_invitation_status_valid CHECK (
    invitation_status IN (
      'candidate',
      'approved',
      'invite_planned',
      'invited',
      'confirmed',
      'declined',
      'recorded',
      'archived'
    )
  ),
  CONSTRAINT episode_guest_public_angle_valid CHECK (
    char_length(public_angle) <= 1000
  ),
  CONSTRAINT episode_guest_sort_valid CHECK (
    sort_order BETWEEN 0 AND 1000
  )
);

CREATE TABLE IF NOT EXISTS season_mastermind.episode_topic (
  episode_plan_id uuid NOT NULL,
  topic_id uuid NOT NULL,
  relevance_note varchar(1000) NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (episode_plan_id, topic_id),
  CONSTRAINT episode_topic_plan_fk FOREIGN KEY (episode_plan_id)
    REFERENCES season_mastermind.episode_plan (episode_plan_id)
    ON DELETE CASCADE,
  CONSTRAINT episode_topic_topic_fk FOREIGN KEY (topic_id)
    REFERENCES season_mastermind.topic (topic_id)
    ON DELETE CASCADE,
  CONSTRAINT episode_topic_relevance_note_valid CHECK (
    char_length(relevance_note) <= 1000
  ),
  CONSTRAINT episode_topic_sort_valid CHECK (
    sort_order BETWEEN 0 AND 1000
  )
);

CREATE TABLE IF NOT EXISTS season_mastermind.episode_source (
  episode_plan_id uuid NOT NULL,
  source_id uuid NOT NULL,
  use_note varchar(1000) NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (episode_plan_id, source_id),
  CONSTRAINT episode_source_plan_fk FOREIGN KEY (episode_plan_id)
    REFERENCES season_mastermind.episode_plan (episode_plan_id)
    ON DELETE CASCADE,
  CONSTRAINT episode_source_source_fk FOREIGN KEY (source_id)
    REFERENCES season_mastermind.research_source (source_id)
    ON DELETE CASCADE,
  CONSTRAINT episode_source_use_note_valid CHECK (
    char_length(use_note) <= 1000
  ),
  CONSTRAINT episode_source_sort_valid CHECK (
    sort_order BETWEEN 0 AND 1000
  )
);

CREATE TABLE IF NOT EXISTS season_mastermind.sponsor_commitment (
  commitment_id uuid PRIMARY KEY,
  season_id uuid,
  episode_plan_id uuid,
  sponsor_id varchar(180),
  sponsor_read_id varchar(180),
  sponsor_display_name varchar(180) NOT NULL,
  commitment_kind varchar(24) NOT NULL DEFAULT 'sponsor_read',
  placement varchar(24) NOT NULL DEFAULT 'unspecified',
  commitment_status varchar(24) NOT NULL DEFAULT 'proposed',
  due_on date,
  public_copy_note varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sponsor_commitment_season_fk FOREIGN KEY (season_id)
    REFERENCES season_mastermind.planning_season (season_id)
    ON DELETE CASCADE,
  CONSTRAINT sponsor_commitment_episode_fk FOREIGN KEY (episode_plan_id)
    REFERENCES season_mastermind.episode_plan (episode_plan_id)
    ON DELETE CASCADE,
  CONSTRAINT sponsor_commitment_one_scope CHECK (
    (season_id IS NOT NULL AND episode_plan_id IS NULL)
    OR (season_id IS NULL AND episode_plan_id IS NOT NULL)
  ),
  CONSTRAINT sponsor_commitment_sponsor_link_valid CHECK (
    sponsor_id IS NULL
    OR (
      sponsor_id = btrim(sponsor_id)
      AND char_length(sponsor_id) BETWEEN 1 AND 180
    )
  ),
  CONSTRAINT sponsor_commitment_read_link_valid CHECK (
    sponsor_read_id IS NULL
    OR (
      sponsor_read_id = btrim(sponsor_read_id)
      AND char_length(sponsor_read_id) BETWEEN 1 AND 180
    )
  ),
  CONSTRAINT sponsor_commitment_display_name_valid CHECK (
    sponsor_display_name = btrim(sponsor_display_name)
    AND char_length(sponsor_display_name) BETWEEN 2 AND 180
  ),
  CONSTRAINT sponsor_commitment_kind_valid CHECK (
    commitment_kind IN (
      'sponsor_read',
      'host_read_ad',
      'presenting_sponsor',
      'promotion',
      'giveaway',
      'other'
    )
  ),
  CONSTRAINT sponsor_commitment_placement_valid CHECK (
    placement IN (
      'pre_roll',
      'mid_roll',
      'post_roll',
      'episode',
      'season',
      'unspecified'
    )
  ),
  CONSTRAINT sponsor_commitment_status_valid CHECK (
    commitment_status IN (
      'proposed',
      'confirmed',
      'copy_needed',
      'ready',
      'fulfilled',
      'cancelled'
    )
  ),
  CONSTRAINT sponsor_commitment_copy_note_valid CHECK (
    char_length(public_copy_note) <= 1000
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS planning_season_label_unique
  ON season_mastermind.planning_season (lower(label));

CREATE INDEX IF NOT EXISTS planning_season_status_dates_idx
  ON season_mastermind.planning_season (status, starts_on, ends_on);

CREATE INDEX IF NOT EXISTS episode_plan_season_status_date_idx
  ON season_mastermind.episode_plan
  (season_id, status, target_air_date NULLS LAST);

CREATE INDEX IF NOT EXISTS episode_plan_owner_status_idx
  ON season_mastermind.episode_plan (owner_person_id, status)
  WHERE owner_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS episode_plan_search_idx
  ON season_mastermind.episode_plan
  USING gin (
    to_tsvector(
      'english',
      working_title || ' ' || premise || ' ' || listener_takeaway
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS episode_host_person_unique
  ON season_mastermind.episode_host (episode_plan_id, host_person_id)
  WHERE host_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS episode_host_person_status_idx
  ON season_mastermind.episode_host
  (host_person_id, assignment_status, episode_plan_id)
  WHERE host_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS episode_host_display_name_idx
  ON season_mastermind.episode_host (lower(host_display_name));

CREATE INDEX IF NOT EXISTS guest_candidate_name_idx
  ON season_mastermind.guest_candidate (lower(display_name));

CREATE UNIQUE INDEX IF NOT EXISTS topic_label_unique
  ON season_mastermind.topic (lower(label));

CREATE INDEX IF NOT EXISTS research_source_publisher_idx
  ON season_mastermind.research_source (lower(publisher));

CREATE INDEX IF NOT EXISTS episode_guest_guest_idx
  ON season_mastermind.episode_guest
  (guest_id, invitation_status, episode_plan_id);

CREATE INDEX IF NOT EXISTS episode_guest_status_idx
  ON season_mastermind.episode_guest
  (invitation_status, episode_plan_id);

CREATE INDEX IF NOT EXISTS episode_topic_topic_idx
  ON season_mastermind.episode_topic (topic_id, episode_plan_id);

CREATE INDEX IF NOT EXISTS episode_source_source_idx
  ON season_mastermind.episode_source (source_id, episode_plan_id);

CREATE INDEX IF NOT EXISTS sponsor_commitment_episode_status_idx
  ON season_mastermind.sponsor_commitment
  (episode_plan_id, commitment_status)
  WHERE episode_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sponsor_commitment_season_status_idx
  ON season_mastermind.sponsor_commitment
  (season_id, commitment_status)
  WHERE season_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sponsor_commitment_sponsor_idx
  ON season_mastermind.sponsor_commitment (sponsor_id, commitment_status)
  WHERE sponsor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION season_mastermind.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION season_mastermind.touch_updated_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS planning_season_touch_updated_at
  ON season_mastermind.planning_season;
CREATE TRIGGER planning_season_touch_updated_at
BEFORE UPDATE ON season_mastermind.planning_season
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

DROP TRIGGER IF EXISTS episode_plan_touch_updated_at
  ON season_mastermind.episode_plan;
CREATE TRIGGER episode_plan_touch_updated_at
BEFORE UPDATE ON season_mastermind.episode_plan
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

DROP TRIGGER IF EXISTS episode_host_touch_updated_at
  ON season_mastermind.episode_host;
CREATE TRIGGER episode_host_touch_updated_at
BEFORE UPDATE ON season_mastermind.episode_host
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

DROP TRIGGER IF EXISTS guest_candidate_touch_updated_at
  ON season_mastermind.guest_candidate;
CREATE TRIGGER guest_candidate_touch_updated_at
BEFORE UPDATE ON season_mastermind.guest_candidate
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

DROP TRIGGER IF EXISTS topic_touch_updated_at
  ON season_mastermind.topic;
CREATE TRIGGER topic_touch_updated_at
BEFORE UPDATE ON season_mastermind.topic
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

DROP TRIGGER IF EXISTS research_source_touch_updated_at
  ON season_mastermind.research_source;
CREATE TRIGGER research_source_touch_updated_at
BEFORE UPDATE ON season_mastermind.research_source
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

DROP TRIGGER IF EXISTS episode_guest_touch_updated_at
  ON season_mastermind.episode_guest;
CREATE TRIGGER episode_guest_touch_updated_at
BEFORE UPDATE ON season_mastermind.episode_guest
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

DROP TRIGGER IF EXISTS episode_topic_touch_updated_at
  ON season_mastermind.episode_topic;
CREATE TRIGGER episode_topic_touch_updated_at
BEFORE UPDATE ON season_mastermind.episode_topic
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

DROP TRIGGER IF EXISTS episode_source_touch_updated_at
  ON season_mastermind.episode_source;
CREATE TRIGGER episode_source_touch_updated_at
BEFORE UPDATE ON season_mastermind.episode_source
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

DROP TRIGGER IF EXISTS sponsor_commitment_touch_updated_at
  ON season_mastermind.sponsor_commitment;
CREATE TRIGGER sponsor_commitment_touch_updated_at
BEFORE UPDATE ON season_mastermind.sponsor_commitment
FOR EACH ROW EXECUTE FUNCTION season_mastermind.touch_updated_at();

REVOKE ALL ON ALL TABLES IN SCHEMA season_mastermind FROM PUBLIC;

COMMENT ON SCHEMA season_mastermind IS
  'Private, non-sensitive season and episode planning metadata for The Avalanche Hour.';
COMMENT ON TABLE season_mastermind.episode_plan IS
  'Editorial plan with nullable soft links to DynamoDB intake, episode, and person records.';
COMMENT ON TABLE season_mastermind.episode_host IS
  'Many-to-many host assignment; host_person_id is a nullable soft link to DynamoDB people.';
COMMENT ON TABLE season_mastermind.guest_candidate IS
  'Reviewed public guest metadata only; private contact and questionnaire data are prohibited.';
COMMENT ON TABLE season_mastermind.episode_guest IS
  'Guest invitation workflow status without contact details or message contents.';
COMMENT ON TABLE season_mastermind.sponsor_commitment IS
  'Season- or episode-scoped ad commitment; sponsor IDs are nullable soft links to DynamoDB.';

COMMIT;
