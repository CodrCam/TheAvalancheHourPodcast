from __future__ import annotations

import json
import os
import pathlib
import ssl
import sys
import types
import unittest
from unittest import mock


API_DIR = pathlib.Path(__file__).resolve().parents[1] / "season_mastermind_api"
sys.path.insert(0, str(API_DIR))

import app  # noqa: E402


BASE_ENV = {
    "MASTERMIND_BACKEND_ENABLED": "true",
    "MASTERMIND_WRITES_ENABLED": "false",
    "MASTERMIND_DB_HOST": "example.cluster-abc.us-east-2.rds.amazonaws.com",
    "MASTERMIND_DB_PORT": "5432",
    "MASTERMIND_DB_NAME": "postgres",
    "MASTERMIND_DB_USER": "season_mastermind_app",
    "MASTERMIND_DB_SSL_MODE": "verify-full",
    "MASTERMIND_DB_CONNECT_TIMEOUT_SECONDS": "30",
    "MASTERMIND_SQL_STATEMENT_TIMEOUT_MS": "2000",
    "MASTERMIND_SQL_LOCK_TIMEOUT_MS": "500",
    "MASTERMIND_DEFAULT_PAGE_SIZE": "20",
    "AWS_REGION": "us-east-2",
}

PERSON_ID = "person-123"
SEASON_ID = "ccda7a31-9800-4bc0-af28-f0fd85e3ad9e"
PLAN_ID = "f7daa7f8-9ced-47e9-a9e1-6aaa21510d69"
UPDATE_CONTRACT_FIXTURE = (
    pathlib.Path(__file__).resolve().parents[4]
    / "tests"
    / "fixtures"
    / "season-mastermind-update-contract.json"
)


class Context:
    aws_request_id = "request-123"


def event(payload: dict, *, method: str = "POST") -> dict:
    return {
        "version": "2.0",
        "rawPath": "/",
        "rawQueryString": "",
        "headers": {"content-type": "application/json"},
        "requestContext": {"http": {"method": method}},
        "body": json.dumps(payload),
        "isBase64Encoded": False,
    }


def payload(operation: str, input_value: dict, *, can_manage: bool = False) -> dict:
    return {
        "operation": operation,
        "actor": {"person_id": PERSON_ID, "can_manage": can_manage},
        "input": input_value,
    }


def response_body(response: dict) -> dict:
    return json.loads(response["body"])


class RecordingCursor:
    def __init__(self, columns: list[str], rows: list[tuple]) -> None:
        self.description = [(column,) for column in columns]
        self.rows = list(rows)
        self.executions: list[tuple[str, tuple]] = []

    def execute(self, sql: str, parameters: tuple = ()) -> None:
        self.executions.append((sql, tuple(parameters)))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def fetchall(self):
        rows = self.rows
        self.rows = []
        return rows


class HandlerContractTests(unittest.TestCase):
    def test_backend_is_default_off(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            response = app.handler(event(payload("list_mastermind", {})), Context())
        self.assertEqual(response["statusCode"], 503)
        self.assertEqual(response_body(response)["code"], "backend_disabled")

    def test_assigned_host_list_is_normalized_before_database_call(self) -> None:
        database_result = {"plans": [], "seasons": [], "page": {"total_plans": 0}}
        with mock.patch.dict(os.environ, BASE_ENV, clear=True), mock.patch.object(
            app, "_run_database_operation", return_value=database_result
        ) as run:
            response = app.handler(
                event(payload("list_mastermind", {"page": 1, "page_size": 50})), Context()
            )
        self.assertEqual(response["statusCode"], 200)
        body = response_body(response)
        self.assertTrue(body["ok"])
        self.assertIn("plans", body)
        self.assertNotIn("data", body)
        operation, actor, request = run.call_args.args[1:]
        self.assertEqual(operation, "list_mastermind")
        self.assertEqual(actor, app.Actor(PERSON_ID, False))
        self.assertEqual(request["page_size"], 50)

    def test_optional_proxy_filters_are_normalized(self) -> None:
        filters = {
            "season_id": None,
            "status": None,
            "episode_type": "special",
            "query": "snow safety",
            "host_person_id": PERSON_ID,
            "include_archived": False,
            "page": 2,
            "page_size": 10,
        }
        with mock.patch.dict(os.environ, BASE_ENV, clear=True), mock.patch.object(
            app, "_run_database_operation", return_value={"plans": [], "seasons": []}
        ) as run:
            response = app.handler(event(payload("list_mastermind", filters)), Context())
        self.assertEqual(response["statusCode"], 200)
        request = run.call_args.args[3]
        self.assertIsNone(request["season_id"])
        self.assertEqual(request["episode_type"], "special")
        self.assertEqual(request["query"], "snow safety")

    def test_season_overview_accepts_only_empty_input_for_any_planning_reader(self) -> None:
        database_result = {
            "season": {
                "label": "Season 11",
                "starts_on": "2026-10-01",
                "ends_on": "2027-05-31",
                "status": "planning",
                "planning_goal": "Build one coherent season.",
            },
            "planning": {
                "total": 2,
                "undated": 1,
                "by_status": {"idea": 1, "ready": 1},
                "by_type": {"regular": 2},
            },
        }
        for can_manage in (False, True):
            with self.subTest(can_manage=can_manage), mock.patch.dict(
                os.environ, BASE_ENV, clear=True
            ), mock.patch.object(
                app, "_run_database_operation", return_value=database_result
            ) as run:
                response = app.handler(
                    event(payload("get_season_overview", {}, can_manage=can_manage)),
                    Context(),
                )
            self.assertEqual(response["statusCode"], 200)
            self.assertEqual(response_body(response)["season"]["label"], "Season 11")
            operation, actor, request = run.call_args.args[1:]
            self.assertEqual(operation, "get_season_overview")
            self.assertEqual(actor, app.Actor(PERSON_ID, can_manage))
            self.assertEqual(request, {})

        with mock.patch.dict(os.environ, BASE_ENV, clear=True), mock.patch.object(
            app, "_run_database_operation"
        ) as run:
            response = app.handler(
                event(payload("get_season_overview", {"season_id": SEASON_ID})),
                Context(),
            )
        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(response_body(response)["code"], "unknown_field")
        run.assert_not_called()

    def test_host_cannot_filter_as_a_different_host(self) -> None:
        with mock.patch.dict(os.environ, BASE_ENV, clear=True), mock.patch.object(
            app, "_run_database_operation"
        ) as run:
            response = app.handler(
                event(payload("list_mastermind", {"host_person_id": "another-person"})),
                Context(),
            )
        self.assertEqual(response["statusCode"], 403)
        self.assertEqual(response_body(response)["code"], "forbidden")
        run.assert_not_called()

    def test_page_size_above_fifty_is_rejected_without_database(self) -> None:
        with mock.patch.dict(os.environ, BASE_ENV, clear=True), mock.patch.object(
            app, "_run_database_operation"
        ) as run:
            response = app.handler(
                event(payload("list_mastermind", {"page_size": 51})), Context()
            )
        self.assertEqual(response["statusCode"], 422)
        self.assertEqual(response_body(response)["code"], "invalid_field")
        run.assert_not_called()

    def test_host_cannot_request_archived_data(self) -> None:
        with mock.patch.dict(os.environ, BASE_ENV, clear=True), mock.patch.object(
            app, "_run_database_operation"
        ) as run:
            response = app.handler(
                event(payload("list_mastermind", {"include_archived": True})), Context()
            )
        self.assertEqual(response["statusCode"], 403)
        run.assert_not_called()

    def test_mutation_requires_manager(self) -> None:
        create = {
            "season_id": SEASON_ID,
            "working_title": "A bounded plan",
            "premise": "A sufficiently long public editorial premise.",
        }
        with mock.patch.dict(os.environ, BASE_ENV, clear=True), mock.patch.object(
            app, "_run_database_operation"
        ) as run:
            response = app.handler(event(payload("create_plan", create)), Context())
        self.assertEqual(response["statusCode"], 403)
        self.assertEqual(response_body(response)["code"], "forbidden")
        run.assert_not_called()

    def test_writes_fail_closed_before_database_connection(self) -> None:
        create = {
            "label": "Winter 2027",
            "starts_on": "2027-01-01",
            "ends_on": "2027-03-31",
        }
        with mock.patch.dict(os.environ, BASE_ENV, clear=True), mock.patch.object(
            app, "_open_database"
        ) as open_database:
            response = app.handler(
                event(payload("create_season", create, can_manage=True)), Context()
            )
        self.assertEqual(response["statusCode"], 503)
        self.assertEqual(response_body(response)["code"], "writes_disabled")
        open_database.assert_not_called()

    def test_manager_host_assignments_are_authoritative_and_deduplicated(self) -> None:
        create = {
            "season_id": SEASON_ID,
            "working_title": "A bounded host plan",
            "premise": "A sufficiently long public editorial premise.",
            "hosts": [
                {"person_id": "host-1", "display_name": "Host One"},
                {"person_id": "host-1", "display_name": "Ignored Duplicate"},
                {"person_id": "host-2", "display_name": "Host Two"},
            ],
        }
        enabled = {**BASE_ENV, "MASTERMIND_WRITES_ENABLED": "true"}
        with mock.patch.dict(os.environ, enabled, clear=True), mock.patch.object(
            app,
            "_run_database_operation",
            return_value={"plan": {"episode_plan_id": PLAN_ID}, "created": True},
        ) as run:
            response = app.handler(
                event(payload("create_plan", create, can_manage=True)), Context()
            )
        self.assertEqual(response["statusCode"], 201)
        request = run.call_args.args[3]
        self.assertEqual(
            request["hosts"],
            [
                {"person_id": "host-1", "display_name": "Host One"},
                {"person_id": "host-2", "display_name": "Host Two"},
            ],
        )

    def test_host_assignment_objects_reject_browser_control_fields(self) -> None:
        create = {
            "season_id": SEASON_ID,
            "working_title": "A bounded host plan",
            "premise": "A sufficiently long public editorial premise.",
            "hosts": [
                {
                    "person_id": "host-1",
                    "display_name": "Host One",
                    "assignment_status": "complete",
                }
            ],
        }
        with mock.patch.dict(os.environ, BASE_ENV, clear=True):
            response = app.handler(
                event(payload("create_plan", create, can_manage=True)), Context()
            )
        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(response_body(response)["code"], "unknown_field")

    def test_unknown_fields_are_rejected(self) -> None:
        request = payload("list_mastermind", {})
        request["sql"] = "SELECT *"
        with mock.patch.dict(os.environ, BASE_ENV, clear=True):
            response = app.handler(event(request), Context())
        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(response_body(response)["code"], "unknown_field")

    def test_non_post_method_is_rejected_when_enabled(self) -> None:
        with mock.patch.dict(os.environ, BASE_ENV, clear=True):
            response = app.handler(event(payload("list_mastermind", {}), method="GET"), Context())
        self.assertEqual(response["statusCode"], 405)
        self.assertEqual(response["headers"]["allow"], "POST")

    def test_scheduled_plan_requires_a_target_air_date(self) -> None:
        request = {
            "season_id": SEASON_ID,
            "working_title": "A reviewed scheduled plan",
            "premise": "A sufficiently complete public editorial premise.",
            "status": "scheduled",
            "target_air_date": None,
        }
        with mock.patch.dict(os.environ, BASE_ENV, clear=True):
            response = app.handler(
                event(payload("create_plan", request, can_manage=True)), Context()
            )
        self.assertEqual(response["statusCode"], 422)
        self.assertEqual(
            response_body(response)["code"], "target_air_date_required"
        )

    def test_accepts_the_shared_website_update_contract(self) -> None:
        update_input = json.loads(UPDATE_CONTRACT_FIXTURE.read_text(encoding="utf-8"))
        env = {**BASE_ENV, "MASTERMIND_WRITES_ENABLED": "true"}
        database_result = {"plan": {**update_input, "revision": 8}}
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(
            app, "_run_database_operation", return_value=database_result
        ) as run:
            response = app.handler(
                event(payload("update_plan", update_input, can_manage=True)), Context()
            )
        self.assertEqual(response["statusCode"], 200)
        operation, actor, request = run.call_args.args[1:]
        self.assertEqual(operation, "update_plan")
        self.assertTrue(actor.can_manage)
        self.assertEqual(request["episode_plan_id"], update_input["episode_plan_id"])
        self.assertEqual(request["changes"]["season_id"], update_input["season_id"])
        self.assertNotIn("owner_person_id", request["changes"])
        self.assertNotIn("source_intake_item_id", request["changes"])


class SqlBoundaryTests(unittest.TestCase):
    def test_season_overview_is_deterministic_bounded_and_relationship_free(self) -> None:
        class OverviewCursor:
            def __init__(self) -> None:
                self.description = []
                self.rows: list[tuple] = []
                self.executions: list[tuple[str, tuple]] = []

            def execute(self, sql: str, parameters: tuple = ()) -> None:
                self.executions.append((sql, tuple(parameters)))
                if "FROM season_mastermind.planning_season" in sql:
                    self.description = [
                        ("season_id",),
                        ("label",),
                        ("starts_on",),
                        ("ends_on",),
                        ("status",),
                        ("planning_goal",),
                    ]
                    self.rows = [
                        (
                            SEASON_ID,
                            "Season 11",
                            "2026-10-01",
                            "2027-05-31",
                            "planning",
                            "Build one coherent season.",
                        )
                    ]
                else:
                    self.description = [
                        ("status",),
                        ("episode_type",),
                        ("undated",),
                        ("plan_count",),
                    ]
                    self.rows = [
                        ("idea", "regular", True, 2),
                        ("ready", "regular", False, 3),
                        ("scheduled", "slabs_and_sluffs", False, 1),
                    ]

            def fetchone(self):
                return self.rows.pop(0) if self.rows else None

            def fetchall(self):
                rows = self.rows
                self.rows = []
                return rows

        cursor = OverviewCursor()
        result = app._season_overview(cursor)

        self.assertEqual(
            result["season"],
            {
                "label": "Season 11",
                "starts_on": "2026-10-01",
                "ends_on": "2027-05-31",
                "status": "planning",
                "planning_goal": "Build one coherent season.",
            },
        )
        self.assertEqual(result["planning"]["total"], 6)
        self.assertEqual(result["planning"]["undated"], 2)
        self.assertEqual(result["planning"]["by_status"]["ready"], 3)
        self.assertEqual(result["planning"]["by_type"]["regular"], 5)
        self.assertEqual(
            set(result),
            {"season", "planning"},
        )
        self.assertEqual(
            set(result["season"]),
            {"label", "starts_on", "ends_on", "status", "planning_goal"},
        )

        selection_sql, selection_parameters = cursor.executions[0]
        aggregate_sql, aggregate_parameters = cursor.executions[1]
        self.assertEqual(selection_parameters, ())
        self.assertIn("s.status <> 'archived'", selection_sql)
        self.assertIn("CURRENT_DATE BETWEEN s.starts_on AND s.ends_on", selection_sql)
        self.assertIn("s.starts_on >= CURRENT_DATE", selection_sql)
        self.assertIn("lower(s.label)", selection_sql)
        self.assertIn("LIMIT 1", selection_sql)
        self.assertIn("p.status <> 'archived'", aggregate_sql)
        self.assertNotIn("episode_host", aggregate_sql)
        self.assertNotIn("guest", aggregate_sql)
        self.assertNotIn("sponsor", aggregate_sql)
        self.assertEqual(aggregate_parameters, (SEASON_ID,))

    def test_season_overview_returns_zero_counts_when_no_season_exists(self) -> None:
        cursor = RecordingCursor([], [])
        result = app._season_overview(cursor)

        self.assertIsNone(result["season"])
        self.assertEqual(result["planning"]["total"], 0)
        self.assertEqual(result["planning"]["undated"], 0)
        self.assertTrue(
            all(value == 0 for value in result["planning"]["by_status"].values())
        )
        self.assertEqual(len(cursor.executions), 1)

    def test_plan_insert_uses_parameters_for_untrusted_text(self) -> None:
        title = "Safe title'); DROP TABLE episode_plan; --"
        columns = ["episode_plan_id", "season_id", "working_title", "revision"]
        cursor = RecordingCursor(columns, [(PLAN_ID, SEASON_ID, title, 1)])
        request = {
            "episode_plan_id": PLAN_ID,
            "season_id": SEASON_ID,
            "working_title": title,
            "premise": "A sufficiently long public editorial premise.",
            "listener_takeaway": "",
            "episode_type": "regular",
            "status": "idea",
            "target_air_date": None,
            "source_intake_item_id": None,
            "linked_episode_id": None,
            "owner_person_id": None,
            "created_by_person_id": PERSON_ID,
            "hosts": [],
        }
        result = app._create_plan(cursor, request)
        sql, parameters = cursor.executions[0]
        self.assertNotIn(title, sql)
        self.assertIn(title, parameters)
        self.assertIn("VALUES (%s, %s", sql)
        self.assertTrue(result["created"])

    def test_update_uses_revision_and_allowlisted_parameterized_column(self) -> None:
        title = "New title'); SELECT pg_sleep(10); --"
        cursor = RecordingCursor(
            ["episode_plan_id", "working_title", "revision"], [(PLAN_ID, title, 2)]
        )
        result = app._update_plan(
            cursor,
            {
                "episode_plan_id": PLAN_ID,
                "revision": 1,
                "changes": {"working_title": title},
            },
        )
        sql, parameters = cursor.executions[0]
        self.assertNotIn(title, sql)
        self.assertIn(title, parameters)
        self.assertIn("working_title = %s", sql)
        self.assertIn("revision = revision + 1", sql)
        self.assertIn("episode_plan_id = %s", sql)
        self.assertIn("revision = %s", sql)
        self.assertIn("linked_episode_id IS NULL", sql)
        self.assertEqual(result["plan"]["revision"], 2)

    def test_linked_plan_cannot_diverge_from_its_episode_studio(self) -> None:
        linked_episode_id = "episode-season-11-linked"

        class LinkedPlanCursor(RecordingCursor):
            def __init__(self) -> None:
                super().__init__(
                    ["episode_plan_id", "linked_episode_id", "revision"],
                    [],
                )
                self.results = [None, (PLAN_ID, linked_episode_id, 3)]

            def fetchone(self):
                return self.results.pop(0)

        cursor = LinkedPlanCursor()
        with self.assertRaises(app.ApiError) as raised:
            app._update_plan(
                cursor,
                {
                    "episode_plan_id": PLAN_ID,
                    "revision": 3,
                    "changes": {"working_title": "A different title"},
                },
            )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, "plan_linked_read_only")
        self.assertEqual(
            raised.exception.details,
            {"linked_episode_id": linked_episode_id},
        )

    def test_host_scope_is_enforced_in_sql_not_in_browser(self) -> None:
        cursor = RecordingCursor([], [])
        request = {
            "season_id": None,
            "status": None,
            "episode_type": None,
            "query": None,
            "host_person_id": None,
            "from_date": None,
            "to_date": None,
            "include_archived": False,
            "page": 1,
            "page_size": 20,
        }
        plans, total = app._select_plan_page(cursor, app.Actor(PERSON_ID, False), request)
        sql, parameters = cursor.executions[0]
        self.assertEqual(plans, [])
        self.assertEqual(total, 0)
        self.assertIn("scope_host.host_person_id = %s", sql)
        self.assertIn("scope_host.assignment_status <> 'unavailable'", sql)
        self.assertIn(PERSON_ID, parameters)
        self.assertIn("LIMIT %s OFFSET %s", sql)

    def test_search_and_type_filters_are_parameterized(self) -> None:
        query = "snow'); SELECT pg_sleep(10); --"
        cursor = RecordingCursor([], [])
        request = {
            "season_id": None,
            "status": None,
            "episode_type": "special",
            "query": query,
            "host_person_id": PERSON_ID,
            "from_date": None,
            "to_date": None,
            "include_archived": False,
            "page": 1,
            "page_size": 20,
        }
        app._select_plan_page(cursor, app.Actor(PERSON_ID, True), request)
        sql, parameters = cursor.executions[0]
        self.assertNotIn(query, sql)
        self.assertIn(query, parameters)
        self.assertIn("websearch_to_tsquery('english', %s)", sql)
        self.assertIn("p.episode_type = %s", sql)
        self.assertIn("filter_host.host_person_id = %s", sql)

    def test_plans_include_nested_public_relationships(self) -> None:
        plans = [{"episode_plan_id": PLAN_ID, "season_id": SEASON_ID}]
        attached = {
            "directory": {
                "hosts": [{"person_id": PERSON_ID, "display_name": "Cameron"}],
                "guests": [{"guest_id": "guest-1", "display_name": "Guest"}],
                "topics": [{"topic_id": "topic-1", "label": "Forecasting"}],
                "sources": [{"source_id": "source-1", "title": "Source"}],
            },
            "relationships": {
                "hosts": [
                    {
                        "episode_plan_id": PLAN_ID,
                        "person_id": PERSON_ID,
                        "display_name": "Cameron",
                    }
                ],
                "guests": [{"episode_plan_id": PLAN_ID, "guest_id": "guest-1"}],
                "topics": [{"episode_plan_id": PLAN_ID, "topic_id": "topic-1"}],
                "sources": [{"episode_plan_id": PLAN_ID, "source_id": "source-1"}],
            },
            "sponsor_commitments": [
                {
                    "commitment_id": "commitment-1",
                    "episode_plan_id": None,
                    "season_id": SEASON_ID,
                }
            ],
        }
        nested = app._plans_with_relationships(plans, attached)[0]
        self.assertEqual(nested["guests"][0]["display_name"], "Guest")
        self.assertEqual(nested["topics"][0]["label"], "Forecasting")
        self.assertEqual(nested["sources"][0]["title"], "Source")
        self.assertEqual(nested["sponsor_commitments"][0]["commitment_id"], "commitment-1")

    def test_link_episode_cannot_overwrite_a_different_link(self) -> None:
        linked_id = "episode-456"
        cursor = RecordingCursor(
            ["episode_plan_id", "linked_episode_id", "revision"],
            [(PLAN_ID, linked_id, 2)],
        )
        app._link_episode(
            cursor,
            {
                "episode_plan_id": PLAN_ID,
                "revision": 1,
                "linked_episode_id": linked_id,
            },
        )
        sql, parameters = cursor.executions[0]
        self.assertIn("linked_episode_id IS NULL OR linked_episode_id = %s", sql)
        self.assertIn("THEN 'scheduled'", sql)
        self.assertNotIn(linked_id, sql)
        self.assertEqual(parameters.count(linked_id), 3)

    def test_host_sync_uses_semantic_unassignment_and_parameterized_upsert(self) -> None:
        cursor = RecordingCursor([], [])
        hosts = [
            {"person_id": "host-1", "display_name": "Host One"},
            {"person_id": "host-2", "display_name": "Host Two"},
        ]
        nested = app._sync_plan_hosts(cursor, PLAN_ID, hosts)

        self.assertEqual(len(cursor.executions), 3)
        combined_sql = "\n".join(sql for sql, _ in cursor.executions)
        self.assertNotIn("DELETE", combined_sql.upper())
        self.assertIn("assignment_status = 'unavailable'", combined_sql)
        self.assertIn("host_person_id NOT IN (%s, %s)", combined_sql)
        self.assertIn("IN ('confirmed', 'complete')", combined_sql)
        self.assertIn("ON CONFLICT (episode_plan_id, host_person_id)", combined_sql)
        self.assertEqual(nested[0]["host_role"], "lead_host")
        self.assertEqual(nested[1]["host_role"], "host")
        self.assertEqual(cursor.executions[1][1][2:4], ("host-1", "Host One"))

    def test_host_sync_preserves_a_selected_completed_assignment(self) -> None:
        columns = [
            "episode_plan_id",
            "person_id",
            "display_name",
            "host_role",
            "assignment_status",
            "sort_order",
        ]
        cursor = RecordingCursor(
            columns,
            [(PLAN_ID, "host-1", "Host One", "lead_host", "complete", 0)],
        )
        nested = app._sync_plan_hosts(
            cursor,
            PLAN_ID,
            [{"person_id": "host-1", "display_name": "Host One"}],
        )

        unassign_sql, unassign_parameters = cursor.executions[0]
        upsert_sql, _ = cursor.executions[1]
        self.assertIn("host_person_id NOT IN (%s)", unassign_sql)
        self.assertEqual(unassign_parameters, (PLAN_ID, "host-1"))
        self.assertIn("IN ('confirmed', 'complete')", upsert_sql)
        self.assertEqual(nested[0]["assignment_status"], "complete")

    def test_idempotent_plan_retry_preserves_the_original_creator(self) -> None:
        request = {
            "episode_plan_id": PLAN_ID,
            "season_id": SEASON_ID,
            "working_title": "A stable intake handoff",
            "premise": "A sufficiently long public editorial premise.",
            "listener_takeaway": "",
            "episode_type": "regular",
            "status": "idea",
            "target_air_date": None,
            "source_intake_item_id": "intake-1",
            "linked_episode_id": None,
            "owner_person_id": None,
            "created_by_person_id": "retrying-manager",
            "hosts": [],
        }
        columns = [
            "episode_plan_id",
            "season_id",
            "working_title",
            "premise",
            "listener_takeaway",
            "episode_type",
            "status",
            "target_air_date",
            "source_intake_item_id",
            "linked_episode_id",
            "owner_person_id",
            "created_by_person_id",
        ]
        existing = (
            PLAN_ID,
            SEASON_ID,
            request["working_title"],
            request["premise"],
            "",
            "regular",
            "idea",
            None,
            "intake-1",
            None,
            None,
            "original-manager",
        )
        cursor = RecordingCursor(columns, [None, existing])
        result = app._create_plan(cursor, request)
        self.assertTrue(result["idempotent"])
        self.assertEqual(result["plan"]["created_by_person_id"], "original-manager")

    def test_host_response_omits_cross_store_and_creator_identifiers(self) -> None:
        seasons = [{"season_id": SEASON_ID, "created_by_person_id": "manager-1"}]
        plans = [
            {
                "episode_plan_id": PLAN_ID,
                "source_intake_item_id": "intake-1",
                "linked_episode_id": "episode-1",
                "created_by_person_id": "manager-1",
                "sponsor_commitments": [
                    {
                        "sponsor_display_name": "Sponsor",
                        "sponsor_id": "sponsor-1",
                        "sponsor_read_id": "read-1",
                    }
                ],
            }
        ]
        attached = {
            "directory": {"hosts": [], "guests": [], "topics": [], "sources": []},
            "relationships": {"hosts": [{}], "guests": [], "topics": [], "sources": []},
            "sponsor_commitments": [{"sponsor_id": "sponsor-1"}],
        }
        scoped_seasons, scoped_plans, scoped_attached = app._scope_mastermind_result(
            app.Actor(PERSON_ID, False), seasons, plans, attached
        )
        self.assertNotIn("created_by_person_id", scoped_seasons[0])
        self.assertNotIn("source_intake_item_id", scoped_plans[0])
        self.assertNotIn("linked_episode_id", scoped_plans[0])
        self.assertNotIn("sponsor_id", scoped_plans[0]["sponsor_commitments"][0])
        self.assertEqual(scoped_attached["relationships"]["hosts"], [])
        self.assertEqual(scoped_attached["sponsor_commitments"], [])

    def test_response_body_has_a_hard_one_megabyte_cap(self) -> None:
        response = app._response(200, {"ok": True, "data": "x" * app.MAX_RESPONSE_BYTES})
        self.assertEqual(response["statusCode"], 502)
        self.assertEqual(response_body(response)["code"], "response_too_large")


class ConnectionTests(unittest.TestCase):
    def test_connection_timeout_defaults_to_thirty_seconds_and_is_hard_capped(self) -> None:
        without_timeout = {
            key: value
            for key, value in BASE_ENV.items()
            if key != "MASTERMIND_DB_CONNECT_TIMEOUT_SECONDS"
        }
        with mock.patch.dict(os.environ, without_timeout, clear=True):
            self.assertEqual(app._settings().connect_timeout_seconds, 30.0)

        above_limit = {
            **BASE_ENV,
            "MASTERMIND_DB_CONNECT_TIMEOUT_SECONDS": "30.1",
        }
        with mock.patch.dict(os.environ, above_limit, clear=True):
            with self.assertRaises(app.ConfigurationError):
                app._settings()

    def test_season_overview_dispatches_in_a_read_only_transaction(self) -> None:
        settings = app.Settings(
            writes_enabled=False,
            region="us-east-2",
            host=BASE_ENV["MASTERMIND_DB_HOST"],
            port=5432,
            database="postgres",
            user="season_mastermind_app",
            connect_timeout_seconds=30.0,
            statement_timeout_ms=2000,
            lock_timeout_ms=500,
            default_page_size=20,
        )
        cursor = mock.MagicMock()
        connection = mock.MagicMock()
        connection.cursor.return_value = cursor
        expected = {"season": None, "planning": {"total": 0}}

        with mock.patch.object(
            app, "_open_database", return_value=connection
        ), mock.patch.object(app, "_configure_transaction") as configure, mock.patch.object(
            app, "_season_overview", return_value=expected
        ) as overview:
            result = app._run_database_operation(
                settings,
                "get_season_overview",
                app.Actor(PERSON_ID, False),
                {},
            )

        self.assertEqual(result, expected)
        configure.assert_called_once_with(cursor, settings, read_only=True)
        overview.assert_called_once_with(cursor)
        connection.commit.assert_called_once_with()
        connection.rollback.assert_not_called()
        cursor.close.assert_called_once_with()
        connection.close.assert_called_once_with()

    def test_iam_token_host_and_tls_verified_host_are_identical(self) -> None:
        settings = app.Settings(
            writes_enabled=False,
            region="us-east-2",
            host=BASE_ENV["MASTERMIND_DB_HOST"],
            port=5432,
            database="postgres",
            user="season_mastermind_app",
            connect_timeout_seconds=30.0,
            statement_timeout_ms=2000,
            lock_timeout_ms=500,
            default_page_size=20,
        )
        calls: dict = {}

        class RdsClient:
            def generate_db_auth_token(self, **kwargs):
                calls["token"] = kwargs
                return "short-lived-token"

        boto3_module = types.ModuleType("boto3")
        boto3_module.client = lambda service, region_name: (
            calls.update({"client": (service, region_name)}) or RdsClient()
        )
        dbapi_module = types.ModuleType("pg8000.dbapi")
        dbapi_module.connect = lambda **kwargs: calls.update({"connect": kwargs}) or object()
        pg8000_module = types.ModuleType("pg8000")
        pg8000_module.dbapi = dbapi_module

        class TlsContext:
            check_hostname = False
            verify_mode = None

        tls_context = TlsContext()
        with mock.patch.dict(
            sys.modules,
            {"boto3": boto3_module, "pg8000": pg8000_module, "pg8000.dbapi": dbapi_module},
        ), mock.patch.object(app.ssl, "create_default_context", return_value=tls_context):
            connection = app._open_database(settings)

        self.assertIsNotNone(connection)
        self.assertEqual(calls["client"], ("rds", "us-east-2"))
        self.assertEqual(calls["token"]["DBHostname"], settings.host)
        self.assertEqual(calls["connect"]["host"], settings.host)
        self.assertEqual(calls["connect"]["password"], "short-lived-token")
        self.assertEqual(calls["connect"]["timeout"], 30.0)
        self.assertIs(calls["connect"]["ssl_context"], tls_context)
        self.assertTrue(tls_context.check_hostname)
        self.assertEqual(tls_context.verify_mode, ssl.CERT_REQUIRED)


if __name__ == "__main__":
    unittest.main()
