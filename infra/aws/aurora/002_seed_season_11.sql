-- Reviewed, privacy-allowlisted Season 11 seed for Aurora PostgreSQL 17.
-- Source of truth: lib/season11MastermindSeed.mjs.
-- Apply after 001_season_mastermind.sql with psql ON_ERROR_STOP enabled.
--
-- The migration is idempotent while the seeded rows remain unchanged: every
-- insert ignores an existing key, then the transaction verifies the complete
-- canonical result before committing. A conflict or a later editorial change
-- aborts safely instead of overwriting live work.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SET LOCAL search_path = pg_catalog, pg_temp;

LOCK TABLE
  season_mastermind.planning_season,
  season_mastermind.episode_plan,
  season_mastermind.episode_host,
  season_mastermind.guest_candidate,
  season_mastermind.topic,
  season_mastermind.research_source,
  season_mastermind.episode_guest,
  season_mastermind.episode_topic,
  season_mastermind.episode_source,
  season_mastermind.sponsor_commitment
IN SHARE ROW EXCLUSIVE MODE;

-- Aurora's Free Plan includes at most 1 GiB of data storage. Refuse to add data
-- when the sum of connectable database sizes is already at or above 0.8 GiB.
DO $seed_guard$
DECLARE
  total_size_bytes bigint;
BEGIN
  SELECT COALESCE(sum(pg_database_size(datname)), 0)
  INTO total_size_bytes
  FROM pg_database
  WHERE datallowconn;

  IF total_size_bytes >= 858993459 THEN
    RAISE EXCEPTION
      'Season 11 seed aborted: connectable databases use % (>= 0.8 GiB guardrail)',
      pg_size_pretty(total_size_bytes);
  END IF;

  RAISE NOTICE 'Pre-seed connectable database size: %',
    pg_size_pretty(total_size_bytes);
END;
$seed_guard$;

CREATE TEMP TABLE s11_seed_payload (
  document jsonb NOT NULL
) ON COMMIT DROP;

-- This JSON contains only the manually reviewed Schedule!A3:J40 projection.
-- It deliberately excludes workbook contact, questionnaire, logistics,
-- restricted production, file, credential, and private sponsor data.
INSERT INTO pg_temp.s11_seed_payload (document)
VALUES ($season11$
{"season":{"season_id":"11111111-1111-4111-8111-111111111111","label":"Season 11","starts_on":"2026-10-01","ends_on":"2027-05-31","status":"planning","planning_goal":"Build a dependable monthly Slabs n Sluffs rhythm and four regular episodes per core-season month."},"plans":[{"source_row":3,"episode_plan_id":"21100000-0000-4000-8000-000000000003","working_title":"SS1 · Slabs n Sluffs 1","premise":"Workbook guest/topic note: Recorded ISSW Between Two Flakes. Workbook host plan: Sara, Dom.","listener_takeaway":"","episode_type":"slabs_and_sluffs","status":"researching","target_air_date":"2026-10-01","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000003001","host_person_id":"sara-boilen","host_display_name":"Sara Boilen","host_role":"lead_host","assignment_status":"confirmed","sort_order":0},{"episode_host_id":"41100000-0000-4000-8000-000000003002","host_person_id":"dom-baker","host_display_name":"Dom Baker","host_role":"co_host","assignment_status":"confirmed","sort_order":1}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":4,"episode_plan_id":"21100000-0000-4000-8000-000000000004","working_title":"Episode 11.1 · Nikola Brebric and Stele Stefanac- Croatia Mtn Rescue Service","premise":"Workbook guest/topic note: Nikola Brebric and Stele Stefanac- Croatia Mtn Rescue Service. Workbook host plan: Sean Zwall.","listener_takeaway":"","episode_type":"regular","status":"recording","target_air_date":"2026-10-07","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000004001","host_person_id":"sean-zimmerman-wall","host_display_name":"Sean Zimmerman-Wall","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000004001","display_name":"Nikola Brebric","public_affiliation":"Croatia Mountain Rescue Service","public_profile_url":null,"public_context":"Nikola Brebric and Stele Stefanac- Croatia Mtn Rescue Service","guest_role":"primary","invitation_status":"recorded","public_angle":"Nikola Brebric and Stele Stefanac- Croatia Mtn Rescue Service","sort_order":0},{"guest_id":"31100000-0000-4000-8000-000000004002","display_name":"Stele Stefanac","public_affiliation":"Croatia Mountain Rescue Service","public_profile_url":null,"public_context":"Nikola Brebric and Stele Stefanac- Croatia Mtn Rescue Service","guest_role":"co_guest","invitation_status":"recorded","public_angle":"Nikola Brebric and Stele Stefanac- Croatia Mtn Rescue Service","sort_order":1}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":5,"episode_plan_id":"21100000-0000-4000-8000-000000000005","working_title":"Unnumbered episode · Emma","premise":"Workbook guest/topic note: Emma. Workbook host plan: Morgan Dinsdale.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2026-10-14","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000005001","host_person_id":null,"host_display_name":"Morgan Dinsdale","host_role":"lead_host","assignment_status":"proposed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000005001","display_name":"Emma","public_affiliation":"","public_profile_url":null,"public_context":"Emma","guest_role":"primary","invitation_status":"approved","public_angle":"Emma","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":6,"episode_plan_id":"21100000-0000-4000-8000-000000000006","working_title":"Episode 11.2 · Julianna Garcia","premise":"Workbook guest/topic note: Julianna Garcia. Workbook host plan: Brooke M.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2026-10-21","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000006001","host_person_id":"brooke-maushund","host_display_name":"Brooke Maushund","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000006001","display_name":"Julianna Garcia","public_affiliation":"","public_profile_url":null,"public_context":"Julianna Garcia","guest_role":"primary","invitation_status":"approved","public_angle":"Julianna Garcia","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":7,"episode_plan_id":"21100000-0000-4000-8000-000000000007","working_title":"SS2 · Slabs n Sluffs 2","premise":"Guest or editorial subject is still open. Workbook host plan: Sara, Dom, Caleb?.","listener_takeaway":"","episode_type":"slabs_and_sluffs","status":"researching","target_air_date":"2026-11-02","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000007001","host_person_id":"sara-boilen","host_display_name":"Sara Boilen","host_role":"lead_host","assignment_status":"confirmed","sort_order":0},{"episode_host_id":"41100000-0000-4000-8000-000000007002","host_person_id":"dom-baker","host_display_name":"Dom Baker","host_role":"co_host","assignment_status":"confirmed","sort_order":1},{"episode_host_id":"41100000-0000-4000-8000-000000007003","host_person_id":"caleb-merrill","host_display_name":"Caleb Merrill","host_role":"co_host","assignment_status":"proposed","sort_order":2}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":8,"episode_plan_id":"21100000-0000-4000-8000-000000000008","working_title":"Episode 11.3 · Larry Stainer & HP Stettler","premise":"Workbook guest/topic note: Larry Stainer & HP Stettler. Workbook host plan: Bruce Jamieson.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2026-11-11","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000008001","host_person_id":"bruce-jamieson","host_display_name":"Bruce Jamieson","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000008001","display_name":"Larry Stainer","public_affiliation":"","public_profile_url":null,"public_context":"Larry Stainer & HP Stettler","guest_role":"primary","invitation_status":"approved","public_angle":"Larry Stainer & HP Stettler","sort_order":0},{"guest_id":"31100000-0000-4000-8000-000000008002","display_name":"HP Stettler","public_affiliation":"","public_profile_url":null,"public_context":"Larry Stainer & HP Stettler","guest_role":"co_guest","invitation_status":"approved","public_angle":"Larry Stainer & HP Stettler","sort_order":1}],"topics":[],"sources":[],"sponsor_commitments":[{"commitment_id":"51100000-0000-4000-8000-000000008001","sponsor_display_name":"IPA Collective","commitment_kind":"sponsor_read","placement":"episode","commitment_status":"proposed","due_on":"2026-11-11","public_copy_note":""}]},{"source_row":9,"episode_plan_id":"21100000-0000-4000-8000-000000000009","working_title":"Episode 11.4 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Gabrielle Antonioli.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2026-11-18","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000009001","host_person_id":null,"host_display_name":"Gabrielle Antonioli","host_role":"lead_host","assignment_status":"proposed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":10,"episode_plan_id":"21100000-0000-4000-8000-000000000010","working_title":"Episode 11.5 · Mike Ferrari","premise":"Workbook guest/topic note: Mike Ferrari. Workbook host plan: Dallas Glass.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2026-11-25","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000010001","host_person_id":null,"host_display_name":"Dallas Glass","host_role":"lead_host","assignment_status":"proposed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000010001","display_name":"Mike Ferrari","public_affiliation":"","public_profile_url":null,"public_context":"Mike Ferrari","guest_role":"primary","invitation_status":"approved","public_angle":"Mike Ferrari","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":11,"episode_plan_id":"21100000-0000-4000-8000-000000000011","working_title":"SS3 · Slabs n Sluffs 3","premise":"Guest or editorial subject is still open. Host assignment is still open.","listener_takeaway":"","episode_type":"slabs_and_sluffs","status":"researching","target_air_date":"2026-11-30","hosts":[],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[{"commitment_id":"51100000-0000-4000-8000-000000011001","sponsor_display_name":"Peak Visor","commitment_kind":"promotion","placement":"episode","commitment_status":"proposed","due_on":"2026-11-30","public_copy_note":"10-15 minute highlight"}]},{"source_row":12,"episode_plan_id":"21100000-0000-4000-8000-000000000012","working_title":"Episode 11.6 · Johanna Kelly","premise":"Workbook guest/topic note: Johanna Kelly. Workbook host plan: Nikki Champion.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2026-12-09","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000012001","host_person_id":null,"host_display_name":"Nikki Champion","host_role":"lead_host","assignment_status":"proposed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000012001","display_name":"Johanna Kelly","public_affiliation":"","public_profile_url":null,"public_context":"Johanna Kelly","guest_role":"primary","invitation_status":"approved","public_angle":"Johanna Kelly","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":13,"episode_plan_id":"21100000-0000-4000-8000-000000000013","working_title":"Episode 11.7 · Kowboy- Brett Kobernik","premise":"Workbook guest/topic note: Kowboy- Brett Kobernik. Workbook host plan: Jake Hutchinson.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2026-12-16","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000013001","host_person_id":"jake-hutchinson","host_display_name":"Jake Hutchinson","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000013001","display_name":"Brett Kobernik","public_affiliation":"","public_profile_url":null,"public_context":"Kowboy- Brett Kobernik","guest_role":"primary","invitation_status":"approved","public_angle":"Kowboy- Brett Kobernik","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":14,"episode_plan_id":"21100000-0000-4000-8000-000000000014","working_title":"Episode 11.8 · \" on the boat\" Andrew McClean? Or other Ice Axe exped?","premise":"Workbook guest/topic note: \" on the boat\" Andrew McClean? Or other Ice Axe exped?. Workbook host plan: Joe Stock.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2026-12-23","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000014001","host_person_id":"joe-stock","host_display_name":"Joe Stock","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000014001","display_name":"Andrew McClean","public_affiliation":"","public_profile_url":null,"public_context":"\" on the boat\" Andrew McClean? Or other Ice Axe exped?","guest_role":"primary","invitation_status":"candidate","public_angle":"\" on the boat\" Andrew McClean? Or other Ice Axe exped?","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[{"commitment_id":"51100000-0000-4000-8000-000000014001","sponsor_display_name":"IPA Collective","commitment_kind":"sponsor_read","placement":"episode","commitment_status":"proposed","due_on":"2026-12-23","public_copy_note":""}]},{"source_row":15,"episode_plan_id":"21100000-0000-4000-8000-000000000015","working_title":"Episode 11.9 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Shiny.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2026-12-30","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000015001","host_person_id":"brooke-edwards","host_display_name":"Brooke Edwards","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":16,"episode_plan_id":"21100000-0000-4000-8000-000000000016","working_title":"SS4 · Slabs n Sluffs 4","premise":"Guest or editorial subject is still open. Host assignment is still open.","listener_takeaway":"","episode_type":"slabs_and_sluffs","status":"researching","target_air_date":"2027-01-05","hosts":[],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":17,"episode_plan_id":"21100000-0000-4000-8000-000000000017","working_title":"Episode 11.10 · Jed Workman","premise":"Workbook guest/topic note: Jed Workman. Workbook host plan: Lynne Wolfe.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-01-07","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000017001","host_person_id":"lynne-wolfe","host_display_name":"Lynne Wolfe","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000017001","display_name":"Jed Workman","public_affiliation":"","public_profile_url":null,"public_context":"Jed Workman","guest_role":"primary","invitation_status":"approved","public_angle":"Jed Workman","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":18,"episode_plan_id":"21100000-0000-4000-8000-000000000018","working_title":"Episode 11.11 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Jason Antin.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-01-14","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000018001","host_person_id":"jason-antin","host_display_name":"Jason Antin","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[{"commitment_id":"51100000-0000-4000-8000-000000018001","sponsor_display_name":"IPA Collective","commitment_kind":"sponsor_read","placement":"episode","commitment_status":"proposed","due_on":"2027-01-14","public_copy_note":""}]},{"source_row":19,"episode_plan_id":"21100000-0000-4000-8000-000000000019","working_title":"Episode 11.12 · Florina Beglinger","premise":"Workbook guest/topic note: Florina Beglinger. Workbook host plan: Kim Vinet.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-01-21","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000019001","host_person_id":"kim-vinet","host_display_name":"Kim Vinet","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000019001","display_name":"Florina Beglinger","public_affiliation":"","public_profile_url":null,"public_context":"Florina Beglinger","guest_role":"primary","invitation_status":"approved","public_angle":"Florina Beglinger","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":20,"episode_plan_id":"21100000-0000-4000-8000-000000000020","working_title":"Episode 11.13 · Irene Henninger","premise":"Workbook guest/topic note: Irene Henninger. Workbook host plan: Sierra Bishop.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-01-28","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000020001","host_person_id":"sierra-bishop","host_display_name":"Sierra Bishop","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000020001","display_name":"Irene Henninger","public_affiliation":"","public_profile_url":null,"public_context":"Irene Henninger","guest_role":"primary","invitation_status":"approved","public_angle":"Irene Henninger","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":21,"episode_plan_id":"21100000-0000-4000-8000-000000000021","working_title":"SS5 · Slabs n Sluffs 5","premise":"Guest or editorial subject is still open. Host assignment is still open.","listener_takeaway":"","episode_type":"slabs_and_sluffs","status":"researching","target_air_date":"2027-02-02","hosts":[],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":22,"episode_plan_id":"21100000-0000-4000-8000-000000000022","working_title":"Episode 11.14 · Rachel Reimer?","premise":"Workbook guest/topic note: Rachel Reimer?. Workbook host plan: Sean Z Wall.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-02-10","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000022001","host_person_id":"sean-zimmerman-wall","host_display_name":"Sean Zimmerman-Wall","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000022001","display_name":"Rachel Reimer","public_affiliation":"","public_profile_url":null,"public_context":"Rachel Reimer?","guest_role":"primary","invitation_status":"candidate","public_angle":"Rachel Reimer?","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":23,"episode_plan_id":"21100000-0000-4000-8000-000000000023","working_title":"Episode 11.15 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Matthias/Anna.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-02-17","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000023001","host_person_id":"matthias-walcher","host_display_name":"Matthias Walcher","host_role":"lead_host","assignment_status":"proposed","sort_order":0},{"episode_host_id":"41100000-0000-4000-8000-000000023002","host_person_id":null,"host_display_name":"Anna Heuberger","host_role":"co_host","assignment_status":"proposed","sort_order":1}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":24,"episode_plan_id":"21100000-0000-4000-8000-000000000024","working_title":"Episode 11.16 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Caleb.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-02-24","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000024001","host_person_id":"caleb-merrill","host_display_name":"Caleb Merrill","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":25,"episode_plan_id":"21100000-0000-4000-8000-000000000025","working_title":"SS6 · Slabs n Sluffs 6","premise":"Guest or editorial subject is still open. Host assignment is still open.","listener_takeaway":"","episode_type":"slabs_and_sluffs","status":"researching","target_air_date":"2027-03-01","hosts":[],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":26,"episode_plan_id":"21100000-0000-4000-8000-000000000026","working_title":"Episode 11.17 · Penny Goddard","premise":"Workbook guest/topic note: Penny Goddard. Workbook host plan: Anna Keeling?.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-03-10","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000026001","host_person_id":null,"host_display_name":"Anna Keeling","host_role":"lead_host","assignment_status":"proposed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000026001","display_name":"Penny Goddard","public_affiliation":"","public_profile_url":null,"public_context":"Penny Goddard","guest_role":"primary","invitation_status":"approved","public_angle":"Penny Goddard","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":27,"episode_plan_id":"21100000-0000-4000-8000-000000000027","working_title":"Episode 11.18 · Dave Hamre","premise":"Workbook guest/topic note: Dave Hamre. Workbook host plan: Brendan Cronin?.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-03-17","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000027001","host_person_id":null,"host_display_name":"Brendan Cronin","host_role":"lead_host","assignment_status":"proposed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000027001","display_name":"Dave Hamre","public_affiliation":"","public_profile_url":null,"public_context":"Dave Hamre","guest_role":"primary","invitation_status":"approved","public_angle":"Dave Hamre","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":28,"episode_plan_id":"21100000-0000-4000-8000-000000000028","working_title":"Episode 11.19 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Shiny.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-03-24","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000028001","host_person_id":"brooke-edwards","host_display_name":"Brooke Edwards","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":29,"episode_plan_id":"21100000-0000-4000-8000-000000000029","working_title":"Episode 11.20 · Kelly Elder?","premise":"Workbook guest/topic note: Kelly Elder?. Workbook host plan: Jake Hutchinson.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-03-31","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000029001","host_person_id":"jake-hutchinson","host_display_name":"Jake Hutchinson","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000029001","display_name":"Kelly Elder","public_affiliation":"","public_profile_url":null,"public_context":"Kelly Elder?","guest_role":"primary","invitation_status":"candidate","public_angle":"Kelly Elder?","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":30,"episode_plan_id":"21100000-0000-4000-8000-000000000030","working_title":"SS7 · Slabs n Sluffs 7","premise":"Guest or editorial subject is still open. Host assignment is still open.","listener_takeaway":"","episode_type":"slabs_and_sluffs","status":"researching","target_air_date":"2027-04-05","hosts":[],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":31,"episode_plan_id":"21100000-0000-4000-8000-000000000031","working_title":"Episode 11.21 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Bruce Jamieson.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-04-07","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000031001","host_person_id":"bruce-jamieson","host_display_name":"Bruce Jamieson","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":32,"episode_plan_id":"21100000-0000-4000-8000-000000000032","working_title":"Episode 11.22 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Gabrielle Antonioli.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-04-14","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000032001","host_person_id":null,"host_display_name":"Gabrielle Antonioli","host_role":"lead_host","assignment_status":"proposed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":33,"episode_plan_id":"21100000-0000-4000-8000-000000000033","working_title":"Episode 11.23 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Lynne Wolfe.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-04-21","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000033001","host_person_id":"lynne-wolfe","host_display_name":"Lynne Wolfe","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":34,"episode_plan_id":"21100000-0000-4000-8000-000000000034","working_title":"Episode 11.24 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Joe Stock.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-04-28","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000034001","host_person_id":"joe-stock","host_display_name":"Joe Stock","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":35,"episode_plan_id":"21100000-0000-4000-8000-000000000035","working_title":"SS8 · Slabs n Sluffs 8","premise":"Guest or editorial subject is still open. Host assignment is still open.","listener_takeaway":"","episode_type":"slabs_and_sluffs","status":"researching","target_air_date":"2027-05-03","hosts":[],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":36,"episode_plan_id":"21100000-0000-4000-8000-000000000036","working_title":"Episode 11.25 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Pascal Haegli?.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-05-05","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000036001","host_person_id":null,"host_display_name":"Pascal Haegli","host_role":"lead_host","assignment_status":"proposed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":37,"episode_plan_id":"21100000-0000-4000-8000-000000000037","working_title":"Episode 11.26 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Joe Stock.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-05-12","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000037001","host_person_id":"joe-stock","host_display_name":"Joe Stock","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":38,"episode_plan_id":"21100000-0000-4000-8000-000000000038","working_title":"Episode 11.27 · Gregg Oliveri Ep or TBC","premise":"Workbook guest/topic note: Gregg Oliveri Ep or TBC. Workbook host plan: Sierra Bishop.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-05-19","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000038001","host_person_id":"sierra-bishop","host_display_name":"Sierra Bishop","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[{"guest_id":"31100000-0000-4000-8000-000000038001","display_name":"Gregg Oliveri","public_affiliation":"","public_profile_url":null,"public_context":"Gregg Oliveri Ep or TBC","guest_role":"primary","invitation_status":"candidate","public_angle":"Gregg Oliveri Ep or TBC","sort_order":0}],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":39,"episode_plan_id":"21100000-0000-4000-8000-000000000039","working_title":"Episode 11.28 · Editorial subject open","premise":"Guest or editorial subject is still open. Workbook host plan: Caleb.","listener_takeaway":"","episode_type":"regular","status":"researching","target_air_date":"2027-05-26","hosts":[{"episode_host_id":"41100000-0000-4000-8000-000000039001","host_person_id":"caleb-merrill","host_display_name":"Caleb Merrill","host_role":"lead_host","assignment_status":"confirmed","sort_order":0}],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]},{"source_row":40,"episode_plan_id":"21100000-0000-4000-8000-000000000040","working_title":"SS9 · Slabs n Sluffs Season Wrap","premise":"Guest or editorial subject is still open. Host assignment is still open.","listener_takeaway":"","episode_type":"slabs_and_sluffs","status":"researching","target_air_date":"2027-05-31","hosts":[],"guests":[],"topics":[],"sources":[],"sponsor_commitments":[]}]}
$season11$::jsonb);

CREATE TEMP TABLE s11_seed_season ON COMMIT DROP AS
SELECT
  (document #>> '{season,season_id}')::uuid AS season_id,
  document #>> '{season,label}' AS label,
  (document #>> '{season,starts_on}')::date AS starts_on,
  (document #>> '{season,ends_on}')::date AS ends_on,
  document #>> '{season,status}' AS status,
  document #>> '{season,planning_goal}' AS planning_goal
FROM pg_temp.s11_seed_payload;

CREATE TEMP TABLE s11_seed_plan ON COMMIT DROP AS
SELECT
  (item ->> 'source_row')::integer AS source_row,
  (item ->> 'episode_plan_id')::uuid AS episode_plan_id,
  (SELECT season_id FROM pg_temp.s11_seed_season) AS season_id,
  item ->> 'working_title' AS working_title,
  item ->> 'premise' AS premise,
  item ->> 'listener_takeaway' AS listener_takeaway,
  item ->> 'episode_type' AS episode_type,
  item ->> 'status' AS status,
  (item ->> 'target_air_date')::date AS target_air_date,
  item -> 'hosts' AS hosts,
  item -> 'guests' AS guests,
  item -> 'topics' AS topics,
  item -> 'sources' AS sources,
  item -> 'sponsor_commitments' AS sponsor_commitments
FROM pg_temp.s11_seed_payload
CROSS JOIN LATERAL jsonb_array_elements(document -> 'plans') AS plan(item);

CREATE TEMP TABLE s11_seed_host ON COMMIT DROP AS
SELECT
  (host ->> 'episode_host_id')::uuid AS episode_host_id,
  plan.episode_plan_id,
  NULLIF(host ->> 'host_person_id', '') AS host_person_id,
  host ->> 'host_display_name' AS host_display_name,
  host ->> 'host_role' AS host_role,
  host ->> 'assignment_status' AS assignment_status,
  (host ->> 'sort_order')::smallint AS sort_order
FROM pg_temp.s11_seed_plan AS plan
CROSS JOIN LATERAL jsonb_array_elements(plan.hosts) AS item(host);

CREATE TEMP TABLE s11_seed_guest ON COMMIT DROP AS
SELECT
  (guest ->> 'guest_id')::uuid AS guest_id,
  plan.episode_plan_id,
  guest ->> 'display_name' AS display_name,
  guest ->> 'public_affiliation' AS public_affiliation,
  NULLIF(guest ->> 'public_profile_url', '') AS public_profile_url,
  guest ->> 'public_context' AS public_context,
  guest ->> 'guest_role' AS guest_role,
  guest ->> 'invitation_status' AS invitation_status,
  guest ->> 'public_angle' AS public_angle,
  (guest ->> 'sort_order')::smallint AS sort_order
FROM pg_temp.s11_seed_plan AS plan
CROSS JOIN LATERAL jsonb_array_elements(plan.guests) AS item(guest);

CREATE TEMP TABLE s11_seed_sponsor ON COMMIT DROP AS
SELECT
  (commitment ->> 'commitment_id')::uuid AS commitment_id,
  plan.episode_plan_id,
  commitment ->> 'sponsor_display_name' AS sponsor_display_name,
  commitment ->> 'commitment_kind' AS commitment_kind,
  commitment ->> 'placement' AS placement,
  commitment ->> 'commitment_status' AS commitment_status,
  (commitment ->> 'due_on')::date AS due_on,
  commitment ->> 'public_copy_note' AS public_copy_note
FROM pg_temp.s11_seed_plan AS plan
CROSS JOIN LATERAL
  jsonb_array_elements(plan.sponsor_commitments) AS item(commitment);

DO $seed_shape$
DECLARE
  season_count integer;
  plan_count integer;
  host_count integer;
  guest_count integer;
  sponsor_count integer;
BEGIN
  SELECT count(*) INTO season_count FROM pg_temp.s11_seed_season;
  SELECT count(*) INTO plan_count FROM pg_temp.s11_seed_plan;
  SELECT count(*) INTO host_count FROM pg_temp.s11_seed_host;
  SELECT count(*) INTO guest_count FROM pg_temp.s11_seed_guest;
  SELECT count(*) INTO sponsor_count FROM pg_temp.s11_seed_sponsor;

  IF ROW(season_count, plan_count, host_count, guest_count, sponsor_count)
     IS DISTINCT FROM ROW(1, 38, 35, 18, 4) THEN
    RAISE EXCEPTION
      'Season 11 seed shape mismatch: seasons %, plans %, hosts %, guests %, sponsors %',
      season_count, plan_count, host_count, guest_count, sponsor_count;
  END IF;

  IF (
    SELECT ROW(min(source_row), max(source_row), count(DISTINCT source_row))
    FROM pg_temp.s11_seed_plan
  ) IS DISTINCT FROM ROW(3, 40, 38::bigint) THEN
    RAISE EXCEPTION 'Season 11 seed must contain each Schedule row 3 through 40 exactly once';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.s11_seed_plan
    WHERE jsonb_array_length(topics) <> 0
       OR jsonb_array_length(sources) <> 0
  ) THEN
    RAISE EXCEPTION 'Season 11 seed must not invent topics or public sources';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.s11_seed_guest
    WHERE public_profile_url IS NOT NULL
      AND public_profile_url !~ '^https://'
  ) THEN
    RAISE EXCEPTION 'Season 11 seed contains a non-HTTPS guest profile URL';
  END IF;

  IF EXISTS (
    SELECT episode_plan_id FROM pg_temp.s11_seed_plan
    GROUP BY episode_plan_id HAVING count(*) > 1
  ) OR EXISTS (
    SELECT episode_host_id FROM pg_temp.s11_seed_host
    GROUP BY episode_host_id HAVING count(*) > 1
  ) OR EXISTS (
    SELECT guest_id FROM pg_temp.s11_seed_guest
    GROUP BY guest_id HAVING count(*) > 1
  ) OR EXISTS (
    SELECT commitment_id FROM pg_temp.s11_seed_sponsor
    GROUP BY commitment_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Season 11 seed contains duplicate deterministic IDs';
  END IF;

  IF (
    SELECT array_agg(target_air_date ORDER BY source_row)
    FROM pg_temp.s11_seed_plan
    WHERE source_row BETWEEN 16 AND 20
  ) IS DISTINCT FROM ARRAY[
    DATE '2027-01-05',
    DATE '2027-01-07',
    DATE '2027-01-14',
    DATE '2027-01-21',
    DATE '2027-01-28'
  ] THEN
    RAISE EXCEPTION 'Season 11 January year corrections are missing or out of order';
  END IF;

  IF (SELECT working_title FROM pg_temp.s11_seed_plan WHERE source_row = 17)
       NOT LIKE 'Episode 11.10 · %'
     OR
     (SELECT working_title FROM pg_temp.s11_seed_plan WHERE source_row = 29)
       NOT LIKE 'Episode 11.20 · %' THEN
    RAISE EXCEPTION 'Season 11 episode-number trailing zero restoration is missing';
  END IF;
END;
$seed_shape$;

-- A same-name candidate with another UUID needs a human merge decision. Do not
-- silently duplicate or rewrite it.
DO $seed_conflicts$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM season_mastermind.guest_candidate AS existing
    JOIN pg_temp.s11_seed_guest AS seed
      ON lower(existing.display_name) = lower(seed.display_name)
    WHERE existing.guest_id <> seed.guest_id
  ) THEN
    RAISE EXCEPTION 'Season 11 guest candidate conflicts with an existing same-name UUID';
  END IF;
END;
$seed_conflicts$;

INSERT INTO season_mastermind.planning_season (
  season_id,
  label,
  starts_on,
  ends_on,
  status,
  planning_goal,
  created_by_person_id,
  revision
)
SELECT
  season_id,
  label,
  starts_on,
  ends_on,
  status,
  planning_goal,
  NULL,
  1
FROM pg_temp.s11_seed_season
ON CONFLICT DO NOTHING;

INSERT INTO season_mastermind.episode_plan (
  episode_plan_id,
  season_id,
  working_title,
  premise,
  listener_takeaway,
  episode_type,
  status,
  target_air_date,
  source_intake_item_id,
  linked_episode_id,
  owner_person_id,
  created_by_person_id,
  revision
)
SELECT
  episode_plan_id,
  season_id,
  working_title,
  premise,
  listener_takeaway,
  episode_type,
  status,
  target_air_date,
  NULL,
  NULL,
  NULL,
  NULL,
  1
FROM pg_temp.s11_seed_plan
ON CONFLICT DO NOTHING;

INSERT INTO season_mastermind.episode_host (
  episode_host_id,
  episode_plan_id,
  host_person_id,
  host_display_name,
  host_role,
  assignment_status,
  sort_order
)
SELECT
  episode_host_id,
  episode_plan_id,
  host_person_id,
  host_display_name,
  host_role,
  assignment_status,
  sort_order
FROM pg_temp.s11_seed_host
ON CONFLICT DO NOTHING;

INSERT INTO season_mastermind.guest_candidate (
  guest_id,
  display_name,
  public_affiliation,
  public_profile_url,
  public_context
)
SELECT
  guest_id,
  display_name,
  public_affiliation,
  public_profile_url,
  public_context
FROM pg_temp.s11_seed_guest
ON CONFLICT DO NOTHING;

INSERT INTO season_mastermind.episode_guest (
  episode_plan_id,
  guest_id,
  guest_role,
  invitation_status,
  public_angle,
  sort_order
)
SELECT
  episode_plan_id,
  guest_id,
  guest_role,
  invitation_status,
  public_angle,
  sort_order
FROM pg_temp.s11_seed_guest
ON CONFLICT DO NOTHING;

INSERT INTO season_mastermind.sponsor_commitment (
  commitment_id,
  season_id,
  episode_plan_id,
  sponsor_id,
  sponsor_read_id,
  sponsor_display_name,
  commitment_kind,
  placement,
  commitment_status,
  due_on,
  public_copy_note
)
SELECT
  commitment_id,
  NULL,
  episode_plan_id,
  NULL,
  NULL,
  sponsor_display_name,
  commitment_kind,
  placement,
  commitment_status,
  due_on,
  public_copy_note
FROM pg_temp.s11_seed_sponsor
ON CONFLICT DO NOTHING;

DO $seed_verify$
DECLARE
  target_season_id uuid := '11111111-1111-4111-8111-111111111111';
  total_size_bytes bigint;
  plan_count integer;
  host_count integer;
  guest_count integer;
  sponsor_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_temp.s11_seed_season AS seed
    LEFT JOIN season_mastermind.planning_season AS actual
      ON actual.season_id = seed.season_id
    WHERE actual.season_id IS NULL
       OR ROW(
         actual.label,
         actual.starts_on,
         actual.ends_on,
         actual.status,
         actual.planning_goal,
         actual.created_by_person_id,
         actual.revision
       ) IS DISTINCT FROM ROW(
         seed.label,
         seed.starts_on,
         seed.ends_on,
         seed.status,
         seed.planning_goal,
         NULL::varchar,
         1
       )
  ) THEN
    RAISE EXCEPTION 'Season 11 season row is missing or conflicts with the canonical seed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.s11_seed_plan AS seed
    LEFT JOIN season_mastermind.episode_plan AS actual
      ON actual.episode_plan_id = seed.episode_plan_id
    WHERE actual.episode_plan_id IS NULL
       OR ROW(
         actual.season_id,
         actual.working_title,
         actual.premise,
         actual.listener_takeaway,
         actual.episode_type,
         actual.status,
         actual.target_air_date,
         actual.source_intake_item_id,
         actual.linked_episode_id,
         actual.owner_person_id,
         actual.created_by_person_id,
         actual.revision
       ) IS DISTINCT FROM ROW(
         seed.season_id,
         seed.working_title,
         seed.premise,
         seed.listener_takeaway,
         seed.episode_type,
         seed.status,
         seed.target_air_date,
         NULL::varchar,
         NULL::varchar,
         NULL::varchar,
         NULL::varchar,
         1
       )
  ) THEN
    RAISE EXCEPTION 'A Season 11 episode plan is missing or conflicts with the canonical seed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.s11_seed_host AS seed
    LEFT JOIN season_mastermind.episode_host AS actual
      ON actual.episode_host_id = seed.episode_host_id
    WHERE actual.episode_host_id IS NULL
       OR ROW(
         actual.episode_plan_id,
         actual.host_person_id,
         actual.host_display_name,
         actual.host_role,
         actual.assignment_status,
         actual.sort_order
       ) IS DISTINCT FROM ROW(
         seed.episode_plan_id,
         seed.host_person_id,
         seed.host_display_name,
         seed.host_role,
         seed.assignment_status,
         seed.sort_order
       )
  ) THEN
    RAISE EXCEPTION 'A Season 11 host assignment is missing or conflicts with the canonical seed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.s11_seed_guest AS seed
    LEFT JOIN season_mastermind.guest_candidate AS actual
      ON actual.guest_id = seed.guest_id
    WHERE actual.guest_id IS NULL
       OR ROW(
         actual.display_name,
         actual.public_affiliation,
         actual.public_profile_url,
         actual.public_context
       ) IS DISTINCT FROM ROW(
         seed.display_name,
         seed.public_affiliation,
         seed.public_profile_url,
         seed.public_context
       )
  ) THEN
    RAISE EXCEPTION 'A Season 11 guest candidate is missing or conflicts with the canonical seed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.s11_seed_guest AS seed
    LEFT JOIN season_mastermind.episode_guest AS actual
      ON actual.episode_plan_id = seed.episode_plan_id
     AND actual.guest_id = seed.guest_id
    WHERE actual.episode_plan_id IS NULL
       OR ROW(
         actual.guest_role,
         actual.invitation_status,
         actual.public_angle,
         actual.sort_order
       ) IS DISTINCT FROM ROW(
         seed.guest_role,
         seed.invitation_status,
         seed.public_angle,
         seed.sort_order
       )
  ) THEN
    RAISE EXCEPTION 'A Season 11 episode guest link is missing or conflicts with the canonical seed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.s11_seed_sponsor AS seed
    LEFT JOIN season_mastermind.sponsor_commitment AS actual
      ON actual.commitment_id = seed.commitment_id
    WHERE actual.commitment_id IS NULL
       OR ROW(
         actual.season_id,
         actual.episode_plan_id,
         actual.sponsor_id,
         actual.sponsor_read_id,
         actual.sponsor_display_name,
         actual.commitment_kind,
         actual.placement,
         actual.commitment_status,
         actual.due_on,
         actual.public_copy_note
       ) IS DISTINCT FROM ROW(
         NULL::uuid,
         seed.episode_plan_id,
         NULL::varchar,
         NULL::varchar,
         seed.sponsor_display_name,
         seed.commitment_kind,
         seed.placement,
         seed.commitment_status,
         seed.due_on,
         seed.public_copy_note
       )
  ) THEN
    RAISE EXCEPTION 'A Season 11 sponsor commitment is missing or conflicts with the canonical seed';
  END IF;

  SELECT count(*) INTO plan_count
  FROM season_mastermind.episode_plan
  WHERE season_id = target_season_id;

  SELECT count(*) INTO host_count
  FROM season_mastermind.episode_host
  WHERE episode_plan_id IN (
    SELECT episode_plan_id FROM pg_temp.s11_seed_plan
  );

  SELECT count(*) INTO guest_count
  FROM season_mastermind.episode_guest
  WHERE episode_plan_id IN (
    SELECT episode_plan_id FROM pg_temp.s11_seed_plan
  );

  SELECT count(*) INTO sponsor_count
  FROM season_mastermind.sponsor_commitment
  WHERE season_id = target_season_id
     OR episode_plan_id IN (
       SELECT episode_plan_id FROM pg_temp.s11_seed_plan
     );

  IF ROW(plan_count, host_count, guest_count, sponsor_count)
     IS DISTINCT FROM ROW(38, 35, 18, 4) THEN
    RAISE EXCEPTION
      'Season 11 persisted counts mismatch: plans %, hosts %, guests %, sponsors %',
      plan_count, host_count, guest_count, sponsor_count;
  END IF;

  IF (
    SELECT count(*)
    FROM season_mastermind.guest_candidate
    WHERE guest_id IN (SELECT guest_id FROM pg_temp.s11_seed_guest)
  ) <> 18 THEN
    RAISE EXCEPTION 'Season 11 must contain exactly 18 seeded guest candidates';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM season_mastermind.episode_topic
    WHERE episode_plan_id IN (
      SELECT episode_plan_id FROM pg_temp.s11_seed_plan
    )
  ) OR EXISTS (
    SELECT 1
    FROM season_mastermind.episode_source
    WHERE episode_plan_id IN (
      SELECT episode_plan_id FROM pg_temp.s11_seed_plan
    )
  ) THEN
    RAISE EXCEPTION 'Season 11 seed unexpectedly persisted topics or sources';
  END IF;

  IF (
    SELECT count(*) FROM season_mastermind.episode_plan
    WHERE season_id = target_season_id
      AND episode_type = 'regular'
  ) <> 29 OR (
    SELECT count(*) FROM season_mastermind.episode_plan
    WHERE season_id = target_season_id
      AND episode_type = 'slabs_and_sluffs'
  ) <> 9 OR (
    SELECT count(*) FROM season_mastermind.episode_plan
    WHERE season_id = target_season_id
      AND status = 'researching'
  ) <> 37 OR (
    SELECT count(*) FROM season_mastermind.episode_plan
    WHERE season_id = target_season_id
      AND status = 'recording'
  ) <> 1 THEN
    RAISE EXCEPTION 'Season 11 plan type or status totals do not match the reviewed fixture';
  END IF;

  SELECT COALESCE(sum(pg_database_size(datname)), 0)
  INTO total_size_bytes
  FROM pg_database
  WHERE datallowconn;

  IF total_size_bytes >= 858993459 THEN
    RAISE EXCEPTION
      'Season 11 seed rolled back: connectable databases use % (>= 0.8 GiB guardrail)',
      pg_size_pretty(total_size_bytes);
  END IF;

  RAISE NOTICE
    'Season 11 seed verified: 1 season, 38 plans, 35 hosts, 18 guests, 18 guest links, 4 sponsors, 0 topics, 0 sources';
  RAISE NOTICE 'Post-seed connectable database size before commit: %',
    pg_size_pretty(total_size_bytes);
END;
$seed_verify$;

COMMIT;

