"""IAM-only Lambda URL proxy for the bounded Season Mastermind data contract."""

from __future__ import annotations

import base64
import binascii
import datetime as dt
import decimal
import json
import os
import re
import ssl
import uuid
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Mapping, Sequence


MAX_BODY_BYTES = 64 * 1024
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_PAGE_SIZE = 50
MAX_PAGE = 1_000
MAX_HOSTS_PER_PLAN = 20

EPISODE_TYPES = frozenset({"regular", "slabs_and_sluffs", "special"})
PLAN_STATUSES = frozenset(
    {"idea", "researching", "ready", "scheduled", "recording", "published", "archived"}
)
DATED_PLAN_STATUSES = frozenset({"scheduled", "recording", "published"})
SEASON_STATUSES = frozenset({"planning", "active", "complete", "archived"})
MUTATING_OPERATIONS = frozenset(
    {
        "create_season",
        "update_season",
        "create_plan",
        "update_plan",
        "archive_plan",
        "link_episode",
    }
)
READ_OPERATIONS = frozenset({"list_mastermind", "get_season_overview"})
SUPPORTED_OPERATIONS = READ_OPERATIONS | MUTATING_OPERATIONS
OVERVIEW_PLAN_STATUSES = (
    "idea",
    "researching",
    "ready",
    "scheduled",
    "recording",
    "published",
)
OVERVIEW_EPISODE_TYPES = ("regular", "slabs_and_sluffs", "special")

_HOST_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]{1,251})[A-Za-z0-9]$")
_PG_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")
_OPAQUE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:@/+=#-]{0,179}$")
_REGION_RE = re.compile(r"^[a-z]{2}(?:-gov)?-[a-z]+-\d$")


class ApiError(Exception):
    """A deliberately safe error that can be returned to the proxy caller."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = dict(details) if details else None


class ConfigurationError(ApiError):
    def __init__(self, message: str = "Backend configuration is unavailable") -> None:
        super().__init__(503, "configuration_unavailable", message)


@dataclass(frozen=True)
class Actor:
    person_id: str
    can_manage: bool


@dataclass(frozen=True)
class Settings:
    writes_enabled: bool
    region: str
    host: str
    port: int
    database: str
    user: str
    connect_timeout_seconds: float
    statement_timeout_ms: int
    lock_timeout_ms: int
    default_page_size: int


SEASON_SELECT = """
    s.season_id::text AS season_id,
    s.label,
    s.starts_on,
    s.ends_on,
    s.status,
    s.planning_goal,
    s.created_by_person_id,
    s.revision,
    s.created_at,
    s.updated_at
"""

PLAN_SELECT = """
    p.episode_plan_id::text AS episode_plan_id,
    p.season_id::text AS season_id,
    p.working_title,
    p.premise,
    p.listener_takeaway,
    p.episode_type,
    p.status,
    p.target_air_date,
    p.source_intake_item_id,
    p.linked_episode_id,
    p.owner_person_id,
    p.created_by_person_id,
    p.revision,
    p.created_at,
    p.updated_at
"""


def _boolean_environment(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    if raw == "true":
        return True
    if raw == "false":
        return False
    raise ConfigurationError()


def _bounded_number_environment(
    name: str,
    default: str,
    minimum: float,
    maximum: float,
    converter: Callable[[str], Any],
) -> Any:
    try:
        value = converter(os.environ.get(name, default))
    except (TypeError, ValueError) as error:
        raise ConfigurationError() from error
    if value < minimum or value > maximum:
        raise ConfigurationError()
    return value


def _settings() -> Settings:
    region = os.environ.get("AWS_REGION", "")
    host = os.environ.get("MASTERMIND_DB_HOST", "")
    database = os.environ.get("MASTERMIND_DB_NAME", "")
    user = os.environ.get("MASTERMIND_DB_USER", "")
    ssl_mode = os.environ.get("MASTERMIND_DB_SSL_MODE", "verify-full")

    if not _REGION_RE.fullmatch(region):
        raise ConfigurationError()
    if not _HOST_RE.fullmatch(host):
        raise ConfigurationError()
    if not _PG_IDENTIFIER_RE.fullmatch(database) or not _PG_IDENTIFIER_RE.fullmatch(user):
        raise ConfigurationError()
    if ssl_mode != "verify-full":
        raise ConfigurationError()

    return Settings(
        writes_enabled=_boolean_environment("MASTERMIND_WRITES_ENABLED", False),
        region=region,
        host=host,
        port=_bounded_number_environment(
            "MASTERMIND_DB_PORT", "5432", 5432, 5432, int
        ),
        database=database,
        user=user,
        connect_timeout_seconds=_bounded_number_environment(
            "MASTERMIND_DB_CONNECT_TIMEOUT_SECONDS", "30", 0.5, 30.0, float
        ),
        statement_timeout_ms=_bounded_number_environment(
            "MASTERMIND_SQL_STATEMENT_TIMEOUT_MS", "2000", 250, 2000, int
        ),
        lock_timeout_ms=_bounded_number_environment(
            "MASTERMIND_SQL_LOCK_TIMEOUT_MS", "500", 100, 1000, int
        ),
        default_page_size=_bounded_number_environment(
            "MASTERMIND_DEFAULT_PAGE_SIZE", "20", 1, MAX_PAGE_SIZE, int
        ),
    )


def _reject_json_constant(value: str) -> None:
    raise ValueError(f"unsupported JSON constant: {value}")


def _object_without_duplicate_keys(pairs: Iterable[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def _decode_event_body(event: Mapping[str, Any]) -> dict[str, Any]:
    request_context = event.get("requestContext")
    http = request_context.get("http") if isinstance(request_context, Mapping) else None
    method = http.get("method") if isinstance(http, Mapping) else None
    if method != "POST":
        raise ApiError(405, "method_not_allowed", "Only POST is supported")

    raw_path = event.get("rawPath", "/")
    if raw_path not in ("", "/"):
        raise ApiError(404, "not_found", "The requested path is not available")
    if event.get("rawQueryString"):
        raise ApiError(400, "query_string_not_allowed", "Query parameters are not supported")

    headers = event.get("headers")
    normalized_headers = (
        {str(key).lower(): str(value) for key, value in headers.items()}
        if isinstance(headers, Mapping)
        else {}
    )
    content_type = normalized_headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type != "application/json":
        raise ApiError(415, "unsupported_media_type", "Content-Type must be application/json")
    if normalized_headers.get("content-encoding"):
        raise ApiError(415, "content_encoding_not_allowed", "Compressed request bodies are not supported")

    body = event.get("body")
    if not isinstance(body, str) or not body:
        raise ApiError(400, "invalid_json", "A JSON request body is required")

    if event.get("isBase64Encoded") is True:
        try:
            raw = base64.b64decode(body, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ApiError(400, "invalid_body_encoding", "Request body encoding is invalid") from error
    else:
        raw = body.encode("utf-8")

    if len(raw) > MAX_BODY_BYTES:
        raise ApiError(413, "request_too_large", "Request body exceeds 64 KiB")
    try:
        decoded = raw.decode("utf-8")
        payload = json.loads(
            decoded,
            object_pairs_hook=_object_without_duplicate_keys,
            parse_constant=_reject_json_constant,
        )
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as error:
        raise ApiError(400, "invalid_json", "Request body must be valid UTF-8 JSON") from error
    if not isinstance(payload, dict):
        raise ApiError(400, "invalid_request", "Request body must be a JSON object")
    return payload


def _require_exact_keys(
    value: Mapping[str, Any],
    allowed: set[str],
    required: set[str],
    field: str,
) -> None:
    unknown = set(value) - allowed
    missing = required - set(value)
    if unknown:
        raise ApiError(
            400,
            "unknown_field",
            f"{field} contains unsupported fields",
            {"fields": sorted(unknown)},
        )
    if missing:
        raise ApiError(
            400,
            "missing_field",
            f"{field} is missing required fields",
            {"fields": sorted(missing)},
        )


def _validate_actor(value: Any) -> Actor:
    if not isinstance(value, dict):
        raise ApiError(400, "invalid_actor", "actor must be an object")
    _require_exact_keys(value, {"person_id", "can_manage"}, {"person_id", "can_manage"}, "actor")
    person_id = _opaque_id(value["person_id"], "actor.person_id")
    can_manage = value["can_manage"]
    if not isinstance(can_manage, bool):
        raise ApiError(400, "invalid_actor", "actor.can_manage must be a boolean")
    return Actor(person_id=person_id, can_manage=can_manage)


def _no_disallowed_controls(value: str, field: str, multiline: bool) -> None:
    for character in value:
        codepoint = ord(character)
        if codepoint == 127 or (codepoint < 32 and not (multiline and character in "\n\t")):
            raise ApiError(422, "invalid_field", f"{field} contains a control character")


def _text(
    value: Any,
    field: str,
    minimum: int,
    maximum: int,
    *,
    multiline: bool = False,
) -> str:
    if not isinstance(value, str):
        raise ApiError(422, "invalid_field", f"{field} must be a string")
    if value != value.strip() or not minimum <= len(value) <= maximum:
        raise ApiError(
            422,
            "invalid_field",
            f"{field} must be trimmed and contain {minimum} to {maximum} characters",
        )
    _no_disallowed_controls(value, field, multiline)
    return value


def _opaque_id(value: Any, field: str) -> str:
    text = _text(value, field, 1, 180)
    if not _OPAQUE_ID_RE.fullmatch(text):
        raise ApiError(422, "invalid_field", f"{field} contains unsupported characters")
    return text


def _optional_opaque_id(value: Any, field: str) -> str | None:
    return None if value is None else _opaque_id(value, field)


def _uuid(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise ApiError(422, "invalid_field", f"{field} must be a UUID string")
    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError) as error:
        raise ApiError(422, "invalid_field", f"{field} must be a valid UUID") from error
    return str(parsed)


def _optional_uuid(value: Any, field: str) -> str | None:
    return None if value is None else _uuid(value, field)


def _date(value: Any, field: str, *, nullable: bool = False) -> str | None:
    if value is None and nullable:
        return None
    if not isinstance(value, str):
        raise ApiError(422, "invalid_field", f"{field} must use YYYY-MM-DD")
    try:
        parsed = dt.date.fromisoformat(value)
    except ValueError as error:
        raise ApiError(422, "invalid_field", f"{field} must use YYYY-MM-DD") from error
    if parsed.isoformat() != value:
        raise ApiError(422, "invalid_field", f"{field} must use YYYY-MM-DD")
    return value


def _positive_integer(value: Any, field: str, maximum: int = 2_147_483_647) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= maximum:
        raise ApiError(422, "invalid_field", f"{field} must be an integer from 1 to {maximum}")
    return value


def _allowlisted(value: Any, field: str, allowed: frozenset[str]) -> str:
    if not isinstance(value, str) or value not in allowed:
        raise ApiError(
            422,
            "invalid_field",
            f"{field} must be one of the supported values",
            {"allowed": sorted(allowed)},
        )
    return value


def _validate_hosts(value: Any, field: str = "input.hosts") -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise ApiError(422, "invalid_field", f"{field} must be an array")
    if len(value) > MAX_HOSTS_PER_PLAN:
        raise ApiError(
            422,
            "invalid_field",
            f"{field} may contain at most {MAX_HOSTS_PER_PLAN} hosts",
        )
    hosts: list[dict[str, str]] = []
    seen: set[str] = set()
    for index, host in enumerate(value):
        item_field = f"{field}[{index}]"
        if not isinstance(host, dict):
            raise ApiError(422, "invalid_field", f"{item_field} must be an object")
        _require_exact_keys(
            host,
            {"person_id", "display_name"},
            {"person_id", "display_name"},
            item_field,
        )
        person_id = _opaque_id(host["person_id"], f"{item_field}.person_id")
        if person_id in seen:
            continue
        seen.add(person_id)
        hosts.append(
            {
                "person_id": person_id,
                "display_name": _text(
                    host["display_name"], f"{item_field}.display_name", 2, 180
                ),
            }
        )
    return hosts


def _validate_list_input(value: Mapping[str, Any], actor: Actor, default_page_size: int) -> dict[str, Any]:
    allowed = {
        "season_id",
        "status",
        "episode_type",
        "query",
        "host_person_id",
        "from_date",
        "to_date",
        "include_archived",
        "page",
        "page_size",
    }
    _require_exact_keys(value, allowed, set(), "input")
    result: dict[str, Any] = {
        "season_id": _optional_uuid(value.get("season_id"), "input.season_id"),
        "status": _allowlisted(value["status"], "input.status", PLAN_STATUSES)
        if value.get("status") is not None
        else None,
        "episode_type": _allowlisted(
            value["episode_type"], "input.episode_type", EPISODE_TYPES
        )
        if value.get("episode_type") is not None
        else None,
        "query": _text(value["query"], "input.query", 1, 160)
        if value.get("query") is not None
        else None,
        "host_person_id": _optional_opaque_id(
            value.get("host_person_id"), "input.host_person_id"
        ),
        "from_date": _date(value.get("from_date"), "input.from_date", nullable=True),
        "to_date": _date(value.get("to_date"), "input.to_date", nullable=True),
        "page": _positive_integer(value.get("page", 1), "input.page", MAX_PAGE),
        "page_size": _positive_integer(
            value.get("page_size", default_page_size), "input.page_size", MAX_PAGE_SIZE
        ),
    }
    include_archived = value.get("include_archived", False)
    if not isinstance(include_archived, bool):
        raise ApiError(422, "invalid_field", "input.include_archived must be a boolean")
    if include_archived and not actor.can_manage:
        raise ApiError(403, "forbidden", "Only managers may include archived plans")
    if result["status"] == "archived" and not actor.can_manage:
        raise ApiError(403, "forbidden", "Only managers may read archived plans")
    if (
        not actor.can_manage
        and result["host_person_id"] is not None
        and result["host_person_id"] != actor.person_id
    ):
        raise ApiError(403, "forbidden", "Hosts may filter only their own assigned plans")
    result["include_archived"] = include_archived
    if result["from_date"] and result["to_date"] and result["from_date"] > result["to_date"]:
        raise ApiError(422, "invalid_date_range", "from_date must not be after to_date")
    return result


def _validate_overview_input(value: Mapping[str, Any]) -> dict[str, Any]:
    _require_exact_keys(value, set(), set(), "input")
    return {}


def _validate_create_season(value: Mapping[str, Any], actor: Actor) -> dict[str, Any]:
    allowed = {"season_id", "label", "starts_on", "ends_on", "status", "planning_goal"}
    _require_exact_keys(value, allowed, {"label", "starts_on", "ends_on"}, "input")
    starts_on = _date(value["starts_on"], "input.starts_on")
    ends_on = _date(value["ends_on"], "input.ends_on")
    assert starts_on is not None and ends_on is not None
    start_date = dt.date.fromisoformat(starts_on)
    end_date = dt.date.fromisoformat(ends_on)
    if end_date < start_date or (end_date - start_date).days > 550:
        raise ApiError(422, "invalid_date_range", "Season dates must span 0 to 550 days")
    return {
        "season_id": _uuid(value["season_id"], "input.season_id")
        if "season_id" in value
        else str(uuid.uuid4()),
        "label": _text(value["label"], "input.label", 2, 80),
        "starts_on": starts_on,
        "ends_on": ends_on,
        "status": _allowlisted(value.get("status", "planning"), "input.status", SEASON_STATUSES),
        "planning_goal": _text(
            value.get("planning_goal", ""), "input.planning_goal", 0, 2400, multiline=True
        ),
        "created_by_person_id": actor.person_id,
    }


def _validate_update_season(value: Mapping[str, Any]) -> dict[str, Any]:
    mutable = {"label", "starts_on", "ends_on", "status", "planning_goal"}
    allowed = {"season_id", "revision"} | mutable
    _require_exact_keys(value, allowed, {"season_id", "revision"}, "input")
    if not set(value).intersection(mutable):
        raise ApiError(422, "empty_update", "At least one season field must be updated")
    changes: dict[str, Any] = {}
    if "label" in value:
        changes["label"] = _text(value["label"], "input.label", 2, 80)
    if "starts_on" in value:
        changes["starts_on"] = _date(value["starts_on"], "input.starts_on")
    if "ends_on" in value:
        changes["ends_on"] = _date(value["ends_on"], "input.ends_on")
    if "status" in value:
        changes["status"] = _allowlisted(value["status"], "input.status", SEASON_STATUSES)
    if "planning_goal" in value:
        changes["planning_goal"] = _text(
            value["planning_goal"], "input.planning_goal", 0, 2400, multiline=True
        )
    return {
        "season_id": _uuid(value["season_id"], "input.season_id"),
        "revision": _positive_integer(value["revision"], "input.revision"),
        "changes": changes,
    }


def _validate_create_plan(value: Mapping[str, Any], actor: Actor) -> dict[str, Any]:
    allowed = {
        "episode_plan_id",
        "season_id",
        "working_title",
        "premise",
        "listener_takeaway",
        "episode_type",
        "status",
        "target_air_date",
        "source_intake_item_id",
        "owner_person_id",
        "hosts",
    }
    _require_exact_keys(value, allowed, {"season_id", "working_title", "premise"}, "input")
    status = _allowlisted(value.get("status", "idea"), "input.status", PLAN_STATUSES)
    target_air_date = _date(
        value.get("target_air_date"), "input.target_air_date", nullable=True
    )
    if status in DATED_PLAN_STATUSES and target_air_date is None:
        raise ApiError(
            422,
            "target_air_date_required",
            "A target air date is required once a plan is scheduled",
        )
    return {
        "episode_plan_id": _uuid(value["episode_plan_id"], "input.episode_plan_id")
        if "episode_plan_id" in value
        else str(uuid.uuid4()),
        "season_id": _uuid(value["season_id"], "input.season_id"),
        "working_title": _text(value["working_title"], "input.working_title", 3, 180),
        "premise": _text(value["premise"], "input.premise", 10, 6000, multiline=True),
        "listener_takeaway": _text(
            value.get("listener_takeaway", ""),
            "input.listener_takeaway",
            0,
            2400,
            multiline=True,
        ),
        "episode_type": _allowlisted(
            value.get("episode_type", "regular"), "input.episode_type", EPISODE_TYPES
        ),
        "status": status,
        "target_air_date": target_air_date,
        "source_intake_item_id": _optional_opaque_id(
            value.get("source_intake_item_id"), "input.source_intake_item_id"
        ),
        "linked_episode_id": None,
        "owner_person_id": _optional_opaque_id(
            value.get("owner_person_id"), "input.owner_person_id"
        ),
        "created_by_person_id": actor.person_id,
        "hosts": _validate_hosts(value.get("hosts", [])),
    }


def _validate_update_plan(value: Mapping[str, Any]) -> dict[str, Any]:
    mutable = {
        "season_id",
        "working_title",
        "premise",
        "listener_takeaway",
        "episode_type",
        "status",
        "target_air_date",
        "source_intake_item_id",
        "owner_person_id",
        "hosts",
    }
    allowed = {"episode_plan_id", "revision"} | mutable
    _require_exact_keys(value, allowed, {"episode_plan_id", "revision"}, "input")
    if not set(value).intersection(mutable):
        raise ApiError(422, "empty_update", "At least one plan field must be updated")
    changes: dict[str, Any] = {}
    if "season_id" in value:
        changes["season_id"] = _uuid(value["season_id"], "input.season_id")
    if "working_title" in value:
        changes["working_title"] = _text(value["working_title"], "input.working_title", 3, 180)
    if "premise" in value:
        changes["premise"] = _text(value["premise"], "input.premise", 10, 6000, multiline=True)
    if "listener_takeaway" in value:
        changes["listener_takeaway"] = _text(
            value["listener_takeaway"], "input.listener_takeaway", 0, 2400, multiline=True
        )
    if "episode_type" in value:
        changes["episode_type"] = _allowlisted(
            value["episode_type"], "input.episode_type", EPISODE_TYPES
        )
    if "status" in value:
        changes["status"] = _allowlisted(value["status"], "input.status", PLAN_STATUSES)
    if "target_air_date" in value:
        changes["target_air_date"] = _date(
            value["target_air_date"], "input.target_air_date", nullable=True
        )
    if (
        changes.get("status") in DATED_PLAN_STATUSES
        and changes.get("target_air_date") is None
    ):
        raise ApiError(
            422,
            "target_air_date_required",
            "A target air date is required once a plan is scheduled",
        )
    for field in ("source_intake_item_id", "owner_person_id"):
        if field in value:
            if value[field] is None:
                raise ApiError(422, "invalid_field", f"input.{field} cannot clear an existing soft link")
            changes[field] = _opaque_id(value[field], f"input.{field}")
    result = {
        "episode_plan_id": _uuid(
            value["episode_plan_id"], "input.episode_plan_id"
        ),
        "revision": _positive_integer(value["revision"], "input.revision"),
        "changes": changes,
    }
    if "hosts" in value:
        result["hosts"] = _validate_hosts(value["hosts"])
    return result


def _validate_plan_revision_operation(value: Mapping[str, Any], operation: str) -> dict[str, Any]:
    allowed = {"episode_plan_id", "revision"}
    required = set(allowed)
    if operation == "link_episode":
        allowed.add("linked_episode_id")
        required.add("linked_episode_id")
    _require_exact_keys(value, allowed, required, "input")
    result = {
        "episode_plan_id": _uuid(
            value["episode_plan_id"], "input.episode_plan_id"
        ),
        "revision": _positive_integer(value["revision"], "input.revision"),
    }
    if operation == "link_episode":
        result["linked_episode_id"] = _opaque_id(
            value["linked_episode_id"], "input.linked_episode_id"
        )
    return result


def _validate_payload(payload: dict[str, Any], default_page_size: int) -> tuple[str, Actor, dict[str, Any]]:
    _require_exact_keys(payload, {"operation", "actor", "input"}, {"operation", "actor", "input"}, "request")
    operation = payload["operation"]
    if not isinstance(operation, str) or operation not in SUPPORTED_OPERATIONS:
        raise ApiError(
            400,
            "unsupported_operation",
            "operation is not supported",
            {"allowed": sorted(SUPPORTED_OPERATIONS)},
        )
    actor = _validate_actor(payload["actor"])
    raw_input = payload["input"]
    if not isinstance(raw_input, dict):
        raise ApiError(400, "invalid_input", "input must be an object")
    if operation == "list_mastermind":
        validated = _validate_list_input(raw_input, actor, default_page_size)
    elif operation == "get_season_overview":
        validated = _validate_overview_input(raw_input)
    elif operation == "create_season":
        validated = _validate_create_season(raw_input, actor)
    elif operation == "update_season":
        validated = _validate_update_season(raw_input)
    elif operation == "create_plan":
        validated = _validate_create_plan(raw_input, actor)
    elif operation == "update_plan":
        validated = _validate_update_plan(raw_input)
    else:
        validated = _validate_plan_revision_operation(raw_input, operation)
    if operation in MUTATING_OPERATIONS and not actor.can_manage:
        raise ApiError(403, "forbidden", "Manager permission is required for this operation")
    return operation, actor, validated


def _open_database(settings: Settings) -> Any:
    """Open exactly one TLS-verified IAM-authenticated connection."""

    try:
        import boto3  # Included in the Lambda Python runtime.
        import pg8000.dbapi  # Packaged from requirements.txt by SAM build.

        token = boto3.client("rds", region_name=settings.region).generate_db_auth_token(
            DBHostname=settings.host,
            Port=settings.port,
            DBUsername=settings.user,
        )
        tls_context = ssl.create_default_context()
        tls_context.check_hostname = True
        tls_context.verify_mode = ssl.CERT_REQUIRED
        return pg8000.dbapi.connect(
            host=settings.host,
            port=settings.port,
            database=settings.database,
            user=settings.user,
            password=token,
            ssl_context=tls_context,
            timeout=settings.connect_timeout_seconds,
            application_name="avh-season-mastermind",
        )
    except Exception as error:
        raise ApiError(503, "database_unavailable", "Season Mastermind is waking or unavailable") from error


def _configure_transaction(cursor: Any, settings: Settings, read_only: bool) -> None:
    if read_only:
        cursor.execute("SET TRANSACTION READ ONLY")
    cursor.execute(
        "SELECT set_config('statement_timeout', %s, true)",
        (f"{settings.statement_timeout_ms}ms",),
    )
    cursor.execute(
        "SELECT set_config('lock_timeout', %s, true)",
        (f"{settings.lock_timeout_ms}ms",),
    )
    cursor.execute(
        "SELECT set_config('idle_in_transaction_session_timeout', %s, true)",
        ("3000ms",),
    )


def _column_names(cursor: Any) -> list[str]:
    return [str(description[0]) for description in (cursor.description or ())]


def _fetch_all(cursor: Any) -> list[dict[str, Any]]:
    columns = _column_names(cursor)
    return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]


def _fetch_one(cursor: Any) -> dict[str, Any] | None:
    columns = _column_names(cursor)
    row = cursor.fetchone()
    return None if row is None else dict(zip(columns, row, strict=True))


def _placeholders(count: int) -> str:
    if not 1 <= count <= MAX_PAGE_SIZE:
        raise RuntimeError("unsafe placeholder count")
    return ",".join(["%s"] * count)


def _select_seasons(cursor: Any, actor: Actor, request: Mapping[str, Any]) -> list[dict[str, Any]]:
    conditions: list[str] = []
    parameters: list[Any] = []
    if not request["include_archived"]:
        conditions.append("s.status <> 'archived'")
    if request["season_id"]:
        conditions.append("s.season_id = %s")
        parameters.append(request["season_id"])
    if not actor.can_manage:
        scope = [
            "h.host_person_id = %s",
            "h.assignment_status <> 'unavailable'",
            "p.season_id = s.season_id",
            "h.episode_plan_id = p.episode_plan_id",
        ]
        parameters.append(actor.person_id)
        if not request["include_archived"]:
            scope.append("p.status <> 'archived'")
        conditions.append(
            "EXISTS (SELECT 1 FROM season_mastermind.episode_plan AS p "
            "JOIN season_mastermind.episode_host AS h ON h.episode_plan_id = p.episode_plan_id "
            f"WHERE {' AND '.join(scope)})"
        )
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    cursor.execute(
        f"""SELECT {SEASON_SELECT}
            FROM season_mastermind.planning_season AS s
            {where}
            ORDER BY s.starts_on DESC, lower(s.label), s.season_id""",
        tuple(parameters),
    )
    return _fetch_all(cursor)


def _select_plan_page(cursor: Any, actor: Actor, request: Mapping[str, Any]) -> tuple[list[dict[str, Any]], int]:
    conditions: list[str] = []
    parameters: list[Any] = []
    if not actor.can_manage:
        conditions.append(
            "EXISTS (SELECT 1 FROM season_mastermind.episode_host AS scope_host "
            "WHERE scope_host.episode_plan_id = p.episode_plan_id "
            "AND scope_host.host_person_id = %s "
            "AND scope_host.assignment_status <> 'unavailable')"
        )
        parameters.append(actor.person_id)
    elif request["host_person_id"]:
        conditions.append(
            "EXISTS (SELECT 1 FROM season_mastermind.episode_host AS filter_host "
            "WHERE filter_host.episode_plan_id = p.episode_plan_id "
            "AND filter_host.host_person_id = %s "
            "AND filter_host.assignment_status <> 'unavailable')"
        )
        parameters.append(request["host_person_id"])
    if request["season_id"]:
        conditions.append("p.season_id = %s")
        parameters.append(request["season_id"])
    if request["status"]:
        conditions.append("p.status = %s")
        parameters.append(request["status"])
    elif not request["include_archived"]:
        conditions.append("p.status <> 'archived'")
    if request["episode_type"]:
        conditions.append("p.episode_type = %s")
        parameters.append(request["episode_type"])
    if request["query"]:
        conditions.append(
            "to_tsvector('english', p.working_title || ' ' || p.premise || ' ' || "
            "p.listener_takeaway) @@ websearch_to_tsquery('english', %s)"
        )
        parameters.append(request["query"])
    if request["from_date"]:
        conditions.append("p.target_air_date >= %s")
        parameters.append(request["from_date"])
    if request["to_date"]:
        conditions.append("p.target_air_date <= %s")
        parameters.append(request["to_date"])
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    offset = (request["page"] - 1) * request["page_size"]
    parameters.extend([request["page_size"], offset])
    cursor.execute(
        f"""SELECT {PLAN_SELECT}, count(*) OVER() AS total_count
            FROM season_mastermind.episode_plan AS p
            {where}
            ORDER BY p.target_air_date ASC NULLS LAST,
                     lower(p.working_title), p.episode_plan_id
            LIMIT %s OFFSET %s""",
        tuple(parameters),
    )
    rows = _fetch_all(cursor)
    total = int(rows[0].pop("total_count")) if rows else 0
    for row in rows[1:]:
        row.pop("total_count", None)
    return rows, total


def _select_attached_data(cursor: Any, plan_ids: Sequence[str], season_ids: Sequence[str]) -> dict[str, Any]:
    empty = {
        "directory": {"hosts": [], "guests": [], "topics": [], "sources": []},
        "relationships": {"hosts": [], "guests": [], "topics": [], "sources": []},
        "sponsor_commitments": [],
    }
    if not plan_ids:
        return empty
    plan_slots = _placeholders(len(plan_ids))

    cursor.execute(
        f"""SELECT episode_host_id::text AS episode_host_id,
                   episode_plan_id::text AS episode_plan_id,
                   host_person_id AS person_id,
                   host_display_name AS display_name,
                   host_role, assignment_status, sort_order
            FROM season_mastermind.episode_host
            WHERE episode_plan_id IN ({plan_slots})
              AND assignment_status <> 'unavailable'
            ORDER BY episode_plan_id, sort_order, lower(host_display_name)""",
        tuple(plan_ids),
    )
    host_relationships = _fetch_all(cursor)
    host_directory_by_key: dict[str, dict[str, Any]] = {}
    for host in host_relationships:
        key = host["person_id"] or f"name:{str(host['display_name']).casefold()}"
        host_directory_by_key.setdefault(
            key,
            {"person_id": host["person_id"], "display_name": host["display_name"]},
        )

    cursor.execute(
        f"""SELECT g.guest_id::text AS guest_id, g.display_name,
                   g.public_affiliation, g.public_profile_url, g.public_context,
                   eg.episode_plan_id::text AS episode_plan_id, eg.guest_role,
                   eg.invitation_status, eg.public_angle, eg.sort_order
            FROM season_mastermind.episode_guest AS eg
            JOIN season_mastermind.guest_candidate AS g ON g.guest_id = eg.guest_id
            WHERE eg.episode_plan_id IN ({plan_slots})
            ORDER BY eg.episode_plan_id, eg.sort_order, lower(g.display_name)""",
        tuple(plan_ids),
    )
    guest_rows = _fetch_all(cursor)
    guest_directory: dict[str, dict[str, Any]] = {}
    guest_relationships: list[dict[str, Any]] = []
    for row in guest_rows:
        guest_directory.setdefault(
            row["guest_id"],
            {key: row[key] for key in ("guest_id", "display_name", "public_affiliation", "public_profile_url", "public_context")},
        )
        guest_relationships.append(
            {key: row[key] for key in ("episode_plan_id", "guest_id", "guest_role", "invitation_status", "public_angle", "sort_order")}
        )

    cursor.execute(
        f"""SELECT t.topic_id::text AS topic_id, t.slug, t.label,
                   et.episode_plan_id::text AS episode_plan_id,
                   et.relevance_note, et.sort_order
            FROM season_mastermind.episode_topic AS et
            JOIN season_mastermind.topic AS t ON t.topic_id = et.topic_id
            WHERE et.episode_plan_id IN ({plan_slots})
            ORDER BY et.episode_plan_id, et.sort_order, lower(t.label)""",
        tuple(plan_ids),
    )
    topic_rows = _fetch_all(cursor)
    topic_directory: dict[str, dict[str, Any]] = {}
    topic_relationships: list[dict[str, Any]] = []
    for row in topic_rows:
        topic_directory.setdefault(
            row["topic_id"], {key: row[key] for key in ("topic_id", "slug", "label")}
        )
        topic_relationships.append(
            {key: row[key] for key in ("episode_plan_id", "topic_id", "relevance_note", "sort_order")}
        )

    cursor.execute(
        f"""SELECT r.source_id::text AS source_id, r.canonical_url, r.title,
                   r.publisher, r.source_kind, r.public_summary,
                   r.published_on, r.last_verified_at,
                   es.episode_plan_id::text AS episode_plan_id, es.use_note, es.sort_order
            FROM season_mastermind.episode_source AS es
            JOIN season_mastermind.research_source AS r ON r.source_id = es.source_id
            WHERE es.episode_plan_id IN ({plan_slots})
            ORDER BY es.episode_plan_id, es.sort_order, lower(r.title)""",
        tuple(plan_ids),
    )
    source_rows = _fetch_all(cursor)
    source_directory: dict[str, dict[str, Any]] = {}
    source_relationships: list[dict[str, Any]] = []
    for row in source_rows:
        source_directory.setdefault(
            row["source_id"],
            {
                key: row[key]
                for key in (
                    "source_id",
                    "canonical_url",
                    "title",
                    "publisher",
                    "source_kind",
                    "public_summary",
                    "published_on",
                    "last_verified_at",
                )
            },
        )
        source_relationships.append(
            {key: row[key] for key in ("episode_plan_id", "source_id", "use_note", "sort_order")}
        )

    sponsor_conditions = [f"sc.episode_plan_id IN ({plan_slots})"]
    sponsor_parameters: list[Any] = list(plan_ids)
    if season_ids:
        season_slots = _placeholders(len(season_ids))
        sponsor_conditions.append(
            f"(sc.episode_plan_id IS NULL AND sc.season_id IN ({season_slots}))"
        )
        sponsor_parameters.extend(season_ids)
    cursor.execute(
        f"""SELECT sc.commitment_id::text AS commitment_id,
                   sc.season_id::text AS season_id,
                   sc.episode_plan_id::text AS episode_plan_id,
                   sc.sponsor_id, sc.sponsor_read_id, sc.sponsor_display_name,
                   sc.commitment_kind, sc.placement, sc.commitment_status,
                   sc.due_on, sc.public_copy_note
            FROM season_mastermind.sponsor_commitment AS sc
            WHERE {' OR '.join(sponsor_conditions)}
            ORDER BY sc.due_on ASC NULLS LAST, lower(sc.sponsor_display_name), sc.commitment_id""",
        tuple(sponsor_parameters),
    )
    sponsor_commitments = _fetch_all(cursor)

    return {
        "directory": {
            "hosts": list(host_directory_by_key.values()),
            "guests": list(guest_directory.values()),
            "topics": list(topic_directory.values()),
            "sources": list(source_directory.values()),
        },
        "relationships": {
            "hosts": host_relationships,
            "guests": guest_relationships,
            "topics": topic_relationships,
            "sources": source_relationships,
        },
        "sponsor_commitments": sponsor_commitments,
    }


def _plans_with_relationships(
    plans: Sequence[Mapping[str, Any]], attached: Mapping[str, Any]
) -> list[dict[str, Any]]:
    """Copy plans and nest their already-scoped public relationship records."""

    directory_keys = {
        "guests": "guest_id",
        "topics": "topic_id",
        "sources": "source_id",
    }
    directory_maps = {
        name: {entry[id_key]: entry for entry in attached["directory"][name]}
        for name, id_key in directory_keys.items()
    }
    relationships_by_plan: dict[str, dict[str, list[dict[str, Any]]]] = {
        plan["episode_plan_id"]: {
            "hosts": [],
            "guests": [],
            "topics": [],
            "sources": [],
        }
        for plan in plans
    }
    for name, relationships in attached["relationships"].items():
        entity_key = directory_keys.get(name)
        for relationship in relationships:
            episode_plan_id = relationship["episode_plan_id"]
            if episode_plan_id not in relationships_by_plan:
                continue
            nested = (
                dict(directory_maps[name].get(relationship[entity_key], {}))
                if entity_key
                else {}
            )
            nested.update(relationship)
            relationships_by_plan[episode_plan_id][name].append(nested)

    nested_plans: list[dict[str, Any]] = []
    for plan in plans:
        episode_plan_id = plan["episode_plan_id"]
        nested = dict(plan)
        nested.update(relationships_by_plan[episode_plan_id])
        nested["sponsor_commitments"] = [
            commitment
            for commitment in attached["sponsor_commitments"]
            if commitment["episode_plan_id"] == episode_plan_id
            or (
                commitment["episode_plan_id"] is None
                and commitment["season_id"] == plan["season_id"]
            )
        ]
        nested_plans.append(nested)
    return nested_plans


def _select_plan_hosts(cursor: Any, episode_plan_id: str) -> list[dict[str, Any]]:
    cursor.execute(
        """SELECT episode_host_id::text AS episode_host_id,
                  episode_plan_id::text AS episode_plan_id,
                  host_person_id AS person_id,
                  host_display_name AS display_name,
                  host_role, assignment_status, sort_order
           FROM season_mastermind.episode_host
           WHERE episode_plan_id = %s
             AND assignment_status <> 'unavailable'
           ORDER BY sort_order, lower(host_display_name), episode_host_id""",
        (episode_plan_id,),
    )
    return _fetch_all(cursor)


def _sync_plan_hosts(
    cursor: Any, episode_plan_id: str, hosts: Sequence[Mapping[str, str]]
) -> list[dict[str, Any]]:
    """Replace active assignments without SQL DELETE or client-supplied role/status."""

    selected_person_ids = [host["person_id"] for host in hosts]
    keep_clause = ""
    keep_parameters: list[Any] = []
    if selected_person_ids:
        keep_clause = (
            " AND (host_person_id IS NULL OR host_person_id NOT IN ("
            + ", ".join(["%s"] * len(selected_person_ids))
            + "))"
        )
        keep_parameters.extend(selected_person_ids)
    cursor.execute(
        f"""UPDATE season_mastermind.episode_host
           SET assignment_status = 'unavailable'
           WHERE episode_plan_id = %s
             AND assignment_status <> 'unavailable'{keep_clause}""",
        tuple([episode_plan_id, *keep_parameters]),
    )
    normalized: list[dict[str, Any]] = []
    for index, host in enumerate(hosts):
        host_role = "lead_host" if index == 0 else "host"
        cursor.execute(
            """INSERT INTO season_mastermind.episode_host
                  (episode_host_id, episode_plan_id, host_person_id,
                   host_display_name, host_role, assignment_status, sort_order)
               VALUES (%s, %s, %s, %s, %s, 'proposed', %s)
               ON CONFLICT (episode_plan_id, host_person_id)
                 WHERE host_person_id IS NOT NULL
               DO UPDATE SET
                 host_display_name = EXCLUDED.host_display_name,
                 host_role = EXCLUDED.host_role,
                 assignment_status = CASE
                   WHEN episode_host.assignment_status IN ('confirmed', 'complete')
                     THEN episode_host.assignment_status
                   ELSE 'proposed'
                 END,
                 sort_order = EXCLUDED.sort_order
               RETURNING episode_plan_id::text AS episode_plan_id,
                         host_person_id AS person_id,
                         host_display_name AS display_name,
                         host_role, assignment_status, sort_order""",
            (
                str(uuid.uuid4()),
                episode_plan_id,
                host["person_id"],
                host["display_name"],
                host_role,
                index,
            ),
        )
        normalized.append(
            _fetch_one(cursor)
            or {
                "episode_plan_id": episode_plan_id,
                "person_id": host["person_id"],
                "display_name": host["display_name"],
                "host_role": host_role,
                "assignment_status": "proposed",
                "sort_order": index,
            }
        )
    return normalized


def _scope_mastermind_result(
    actor: Actor,
    seasons: Sequence[Mapping[str, Any]],
    plans: Sequence[Mapping[str, Any]],
    attached: Mapping[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    scoped_seasons = [dict(season) for season in seasons]
    scoped_plans = [dict(plan) for plan in plans]
    scoped_attached = dict(attached)
    if actor.can_manage:
        return scoped_seasons, scoped_plans, scoped_attached

    for season in scoped_seasons:
        season.pop("created_by_person_id", None)
    for plan in scoped_plans:
        plan.pop("source_intake_item_id", None)
        plan.pop("linked_episode_id", None)
        plan.pop("created_by_person_id", None)
        for commitment in plan.get("sponsor_commitments", []):
            commitment.pop("sponsor_id", None)
            commitment.pop("sponsor_read_id", None)
    scoped_attached["relationships"] = {
        "hosts": [],
        "guests": [],
        "topics": [],
        "sources": [],
    }
    scoped_attached["sponsor_commitments"] = []
    return scoped_seasons, scoped_plans, scoped_attached


def _list_mastermind(cursor: Any, actor: Actor, request: Mapping[str, Any]) -> dict[str, Any]:
    seasons = _select_seasons(cursor, actor, request)
    plans, total = _select_plan_page(cursor, actor, request)
    plan_ids = [row["episode_plan_id"] for row in plans]
    season_ids = list(dict.fromkeys(row["season_id"] for row in plans))
    attached = _select_attached_data(cursor, plan_ids, season_ids)
    seasons, nested_plans, attached = _scope_mastermind_result(
        actor, seasons, _plans_with_relationships(plans, attached), attached
    )
    page = request["page"]
    page_size = request["page_size"]
    return {
        "seasons": seasons,
        "plans": nested_plans,
        **attached,
        "page": {
            "number": page,
            "size": page_size,
            "total_plans": total,
            "has_more": page * page_size < total,
        },
        "scope": "manager" if actor.can_manage else "assigned_host",
    }


def _season_overview(cursor: Any) -> dict[str, Any]:
    cursor.execute(
        """SELECT s.season_id::text AS season_id,
                  s.label,
                  s.starts_on,
                  s.ends_on,
                  s.status,
                  s.planning_goal
           FROM season_mastermind.planning_season AS s
           WHERE s.status <> 'archived'
           ORDER BY
             CASE
               WHEN s.status = 'active'
                    AND CURRENT_DATE BETWEEN s.starts_on AND s.ends_on THEN 0
               WHEN s.status = 'active' THEN 1
               WHEN s.status = 'planning'
                    AND CURRENT_DATE BETWEEN s.starts_on AND s.ends_on THEN 2
               WHEN s.status = 'planning' AND s.starts_on >= CURRENT_DATE THEN 3
               WHEN s.status = 'planning' THEN 4
               WHEN s.status = 'complete' THEN 5
               ELSE 6
             END,
             CASE WHEN s.starts_on >= CURRENT_DATE THEN s.starts_on END ASC NULLS LAST,
             CASE WHEN s.starts_on < CURRENT_DATE THEN s.starts_on END DESC NULLS LAST,
             lower(s.label),
             s.season_id
           LIMIT 1"""
    )
    selected = _fetch_one(cursor)
    empty_planning = {
        "total": 0,
        "undated": 0,
        "by_status": {status: 0 for status in OVERVIEW_PLAN_STATUSES},
        "by_type": {episode_type: 0 for episode_type in OVERVIEW_EPISODE_TYPES},
    }
    if selected is None:
        return {"season": None, "planning": empty_planning}

    cursor.execute(
        """SELECT p.status,
                  p.episode_type,
                  (p.target_air_date IS NULL) AS undated,
                  count(*) AS plan_count
           FROM season_mastermind.episode_plan AS p
           WHERE p.season_id = %s
             AND p.status <> 'archived'
           GROUP BY p.status, p.episode_type, (p.target_air_date IS NULL)""",
        (selected["season_id"],),
    )
    rows = _fetch_all(cursor)
    planning = {
        "total": 0,
        "undated": 0,
        "by_status": {status: 0 for status in OVERVIEW_PLAN_STATUSES},
        "by_type": {episode_type: 0 for episode_type in OVERVIEW_EPISODE_TYPES},
    }
    for row in rows:
        count = int(row["plan_count"])
        planning["total"] += count
        if row["undated"]:
            planning["undated"] += count
        if row["status"] in planning["by_status"]:
            planning["by_status"][row["status"]] += count
        if row["episode_type"] in planning["by_type"]:
            planning["by_type"][row["episode_type"]] += count

    return {
        "season": {
            "label": selected["label"],
            "starts_on": selected["starts_on"],
            "ends_on": selected["ends_on"],
            "status": selected["status"],
            "planning_goal": selected["planning_goal"],
        },
        "planning": planning,
    }


def _create_season(cursor: Any, request: Mapping[str, Any]) -> dict[str, Any]:
    cursor.execute(
        f"""INSERT INTO season_mastermind.planning_season
              (season_id, label, starts_on, ends_on, status, planning_goal, created_by_person_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING {SEASON_SELECT.replace('s.', '')}""",
        (
            request["season_id"],
            request["label"],
            request["starts_on"],
            request["ends_on"],
            request["status"],
            request["planning_goal"],
            request["created_by_person_id"],
        ),
    )
    row = _fetch_one(cursor)
    if row is not None:
        return {"season": row, "created": True}
    cursor.execute(
        f"""SELECT {SEASON_SELECT}
            FROM season_mastermind.planning_season AS s
            WHERE s.season_id = %s OR lower(s.label) = lower(%s)
            ORDER BY (s.season_id = %s) DESC
            LIMIT 1""",
        (request["season_id"], request["label"], request["season_id"]),
    )
    existing = _fetch_one(cursor)
    expected = {
        key: request[key]
        for key in (
            "season_id",
            "label",
            "starts_on",
            "ends_on",
            "status",
            "planning_goal",
            "created_by_person_id",
        )
    }
    if existing and all(_jsonable(existing.get(key)) == value for key, value in expected.items()):
        return {"season": existing, "created": False, "idempotent": True}
    raise ApiError(409, "season_conflict", "A different season already uses this ID or label")


def _get_season(cursor: Any, season_id: str) -> dict[str, Any] | None:
    cursor.execute(
        f"SELECT {SEASON_SELECT} FROM season_mastermind.planning_season AS s WHERE s.season_id = %s",
        (season_id,),
    )
    return _fetch_one(cursor)


def _update_season(cursor: Any, request: Mapping[str, Any]) -> dict[str, Any]:
    assignments: list[str] = []
    parameters: list[Any] = []
    for column, value in request["changes"].items():
        assignments.append(f"{column} = %s")
        parameters.append(value)
    assignments.append("revision = revision + 1")
    parameters.extend([request["season_id"], request["revision"]])
    cursor.execute(
        f"""UPDATE season_mastermind.planning_season
            SET {', '.join(assignments)}
            WHERE season_id = %s AND revision = %s
            RETURNING {SEASON_SELECT.replace('s.', '')}""",
        tuple(parameters),
    )
    updated = _fetch_one(cursor)
    if updated:
        return {"season": updated}
    current = _get_season(cursor, request["season_id"])
    if current is None:
        raise ApiError(404, "season_not_found", "Season was not found")
    raise ApiError(
        409,
        "revision_conflict",
        "Season changed since it was loaded",
        {"current_revision": current["revision"]},
    )


def _create_plan(cursor: Any, request: Mapping[str, Any]) -> dict[str, Any]:
    cursor.execute(
        f"""INSERT INTO season_mastermind.episode_plan
              (episode_plan_id, season_id, working_title, premise,
               listener_takeaway, episode_type, status, target_air_date,
               source_intake_item_id, linked_episode_id, owner_person_id,
               created_by_person_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING {PLAN_SELECT.replace('p.', '')}""",
        (
            request["episode_plan_id"],
            request["season_id"],
            request["working_title"],
            request["premise"],
            request["listener_takeaway"],
            request["episode_type"],
            request["status"],
            request["target_air_date"],
            request["source_intake_item_id"],
            request["linked_episode_id"],
            request["owner_person_id"],
            request["created_by_person_id"],
        ),
    )
    row = _fetch_one(cursor)
    if row is not None:
        row["hosts"] = _sync_plan_hosts(
            cursor, request["episode_plan_id"], request["hosts"]
        )
        return {"plan": row, "created": True}

    conditions = ["p.episode_plan_id = %s"]
    parameters: list[Any] = [request["episode_plan_id"]]
    for field in ("source_intake_item_id", "linked_episode_id"):
        if request[field] is not None:
            conditions.append(f"p.{field} = %s")
            parameters.append(request[field])
    cursor.execute(
        f"""SELECT {PLAN_SELECT}
            FROM season_mastermind.episode_plan AS p
            WHERE {' OR '.join(conditions)}
            ORDER BY (p.episode_plan_id = %s) DESC
            LIMIT 1""",
        tuple(parameters + [request["episode_plan_id"]]),
    )
    existing = _fetch_one(cursor)
    expected = {
        key: request[key]
        for key in (
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
        )
    }
    if existing and all(_jsonable(existing.get(key)) == value for key, value in expected.items()):
        existing_hosts = _select_plan_hosts(cursor, existing["episode_plan_id"])
        if [host.get("person_id") for host in existing_hosts] == [
            host["person_id"] for host in request["hosts"]
        ]:
            existing["hosts"] = existing_hosts
            return {"plan": existing, "created": False, "idempotent": True}
    raise ApiError(409, "plan_conflict", "A different plan already uses this ID or soft link")


def _get_plan(cursor: Any, episode_plan_id: str) -> dict[str, Any] | None:
    cursor.execute(
        f"SELECT {PLAN_SELECT} FROM season_mastermind.episode_plan AS p WHERE p.episode_plan_id = %s",
        (episode_plan_id,),
    )
    return _fetch_one(cursor)


def _update_plan(cursor: Any, request: Mapping[str, Any]) -> dict[str, Any]:
    protected_links = {"source_intake_item_id", "owner_person_id"}
    assignments: list[str] = []
    guards: list[str] = []
    parameters: list[Any] = []
    guard_parameters: list[Any] = []
    for column, value in request["changes"].items():
        if column in protected_links:
            assignments.append(f"{column} = COALESCE({column}, %s)")
            guards.append(f"({column} IS NULL OR {column} = %s)")
            guard_parameters.append(value)
        else:
            assignments.append(f"{column} = %s")
        parameters.append(value)
    assignments.append("revision = revision + 1")
    parameters.extend([request["episode_plan_id"], request["revision"]])
    parameters.extend(guard_parameters)
    guard_sql = f" AND {' AND '.join(guards)}" if guards else ""
    cursor.execute(
        f"""UPDATE season_mastermind.episode_plan
            SET {', '.join(assignments)}
            WHERE episode_plan_id = %s
              AND revision = %s
              AND linked_episode_id IS NULL{guard_sql}
            RETURNING {PLAN_SELECT.replace('p.', '')}""",
        tuple(parameters),
    )
    updated = _fetch_one(cursor)
    if updated:
        if "hosts" in request:
            updated["hosts"] = _sync_plan_hosts(
                cursor, request["episode_plan_id"], request["hosts"]
            )
        return {"plan": updated}
    current = _get_plan(cursor, request["episode_plan_id"])
    if current is None:
        raise ApiError(404, "plan_not_found", "Plan was not found")
    if current.get("linked_episode_id") is not None:
        raise ApiError(
            409,
            "plan_linked_read_only",
            "This plan is read only after its Episode Studio is linked",
            {"linked_episode_id": current["linked_episode_id"]},
        )
    if current["revision"] != request["revision"]:
        raise ApiError(
            409,
            "revision_conflict",
            "Plan changed since it was loaded",
            {"current_revision": current["revision"]},
        )
    raise ApiError(409, "soft_link_conflict", "A soft link cannot replace a different record")


def _archive_plan(cursor: Any, request: Mapping[str, Any]) -> dict[str, Any]:
    cursor.execute(
        f"""UPDATE season_mastermind.episode_plan
            SET status = 'archived', revision = revision + 1
            WHERE episode_plan_id = %s
              AND revision = %s
              AND linked_episode_id IS NULL
            RETURNING {PLAN_SELECT.replace('p.', '')}""",
        (request["episode_plan_id"], request["revision"]),
    )
    archived = _fetch_one(cursor)
    if archived:
        return {"plan": archived}
    current = _get_plan(cursor, request["episode_plan_id"])
    if current is None:
        raise ApiError(404, "plan_not_found", "Plan was not found")
    if current.get("linked_episode_id") is not None:
        raise ApiError(
            409,
            "plan_linked_read_only",
            "This plan is read only after its Episode Studio is linked",
            {"linked_episode_id": current["linked_episode_id"]},
        )
    raise ApiError(
        409,
        "revision_conflict",
        "Plan changed since it was loaded",
        {"current_revision": current["revision"]},
    )


def _link_episode(cursor: Any, request: Mapping[str, Any]) -> dict[str, Any]:
    linked_episode_id = request["linked_episode_id"]
    cursor.execute(
        f"""UPDATE season_mastermind.episode_plan
            SET linked_episode_id = COALESCE(linked_episode_id, %s),
                status = CASE
                  WHEN linked_episode_id IS NULL THEN 'scheduled'
                  ELSE status
                END,
                revision = CASE
                  WHEN linked_episode_id IS NULL THEN revision + 1
                  ELSE revision
                END
            WHERE episode_plan_id = %s
              AND (linked_episode_id IS NULL OR linked_episode_id = %s)
              AND (revision = %s OR linked_episode_id = %s)
            RETURNING {PLAN_SELECT.replace('p.', '')}""",
        (
            linked_episode_id,
            request["episode_plan_id"],
            linked_episode_id,
            request["revision"],
            linked_episode_id,
        ),
    )
    linked = _fetch_one(cursor)
    if linked:
        return {
            "plan": linked,
            "idempotent": linked["revision"] == request["revision"],
        }
    current = _get_plan(cursor, request["episode_plan_id"])
    if current is None:
        raise ApiError(404, "plan_not_found", "Plan was not found")
    if current["linked_episode_id"] not in (None, linked_episode_id):
        raise ApiError(409, "soft_link_conflict", "Plan is already linked to another episode")
    raise ApiError(
        409,
        "revision_conflict",
        "Plan changed since it was loaded",
        {"current_revision": current["revision"]},
    )


def _sqlstate(error: Exception) -> str | None:
    if error.args and isinstance(error.args[0], Mapping):
        code = error.args[0].get("C")
        return str(code) if code else None
    return None


def _mapped_database_error(error: Exception) -> ApiError:
    state = _sqlstate(error)
    if state == "23503":
        return ApiError(422, "invalid_reference", "A referenced planning record does not exist")
    if state == "23505":
        return ApiError(409, "record_conflict", "A unique planning value is already in use")
    if state in {"22001", "22P02", "23514"}:
        return ApiError(422, "invalid_record", "The record violates a database constraint")
    if state in {"55P03", "57014"}:
        return ApiError(503, "database_busy", "Season Mastermind is busy; retry once")
    return ApiError(503, "database_unavailable", "Season Mastermind is waking or unavailable")


def _run_database_operation(
    settings: Settings,
    operation: str,
    actor: Actor,
    request: Mapping[str, Any],
) -> dict[str, Any]:
    if operation in MUTATING_OPERATIONS and not settings.writes_enabled:
        raise ApiError(503, "writes_disabled", "Season Mastermind writes are disabled")
    connection = _open_database(settings)
    cursor = None
    try:
        cursor = connection.cursor()
        _configure_transaction(cursor, settings, read_only=operation in READ_OPERATIONS)
        if operation == "list_mastermind":
            result = _list_mastermind(cursor, actor, request)
        elif operation == "get_season_overview":
            result = _season_overview(cursor)
        elif operation == "create_season":
            result = _create_season(cursor, request)
        elif operation == "update_season":
            result = _update_season(cursor, request)
        elif operation == "create_plan":
            result = _create_plan(cursor, request)
        elif operation == "update_plan":
            result = _update_plan(cursor, request)
        elif operation == "archive_plan":
            result = _archive_plan(cursor, request)
        elif operation == "link_episode":
            result = _link_episode(cursor, request)
        else:  # Validation makes this unreachable.
            raise RuntimeError("unsupported validated operation")
        connection.commit()
        return result
    except ApiError:
        connection.rollback()
        raise
    except Exception as error:
        connection.rollback()
        raise _mapped_database_error(error) from error
    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def _jsonable(value: Any) -> Any:
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, decimal.Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return value


def _response(status_code: int, payload: Mapping[str, Any]) -> dict[str, Any]:
    body = json.dumps(_jsonable(payload), separators=(",", ":"), sort_keys=True)
    if len(body.encode("utf-8")) > MAX_RESPONSE_BYTES:
        status_code = 502
        body = json.dumps(
            {
                "ok": False,
                "code": "response_too_large",
                "error": "The requested planning page is too large",
                "status": 502,
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    return {
        "statusCode": status_code,
        "headers": {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
            "x-content-type-options": "nosniff",
        },
        "body": body,
        "isBase64Encoded": False,
    }


def _log_result(request_id: str | None, operation: str | None, status_code: int, code: str) -> None:
    print(
        json.dumps(
            {
                "event": "season_mastermind_request",
                "request_id": request_id,
                "operation": operation,
                "status_code": status_code,
                "result": code,
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Handle the sole proxy contract: {operation, actor, input}."""

    request_id = getattr(context, "aws_request_id", None)
    operation: str | None = None
    try:
        if not _boolean_environment("MASTERMIND_BACKEND_ENABLED", False):
            raise ApiError(503, "backend_disabled", "Season Mastermind backend is disabled")
        payload = _decode_event_body(event)
        settings = _settings()
        operation, actor, request = _validate_payload(payload, settings.default_page_size)
        result = _run_database_operation(settings, operation, actor, request)
        status_code = 201 if operation in {"create_season", "create_plan"} and result.get("created") else 200
        _log_result(request_id, operation, status_code, "ok")
        return _response(
            status_code,
            {"ok": True, "operation": operation, **result, "request_id": request_id},
        )
    except ApiError as error:
        error_payload: dict[str, Any] = {
            "ok": False,
            "code": error.code,
            "error": error.message,
            "status": error.status_code,
            "request_id": request_id,
        }
        if error.details:
            error_payload["details"] = error.details
        _log_result(request_id, operation, error.status_code, error.code)
        headers = {"allow": "POST"} if error.status_code == 405 else None
        response = _response(
            error.status_code,
            error_payload,
        )
        if headers:
            response["headers"].update(headers)
        return response
    except Exception as error:  # Never expose raw database, IAM, or configuration errors.
        _log_result(request_id, operation, 500, type(error).__name__)
        return _response(
            500,
            {
                "ok": False,
                "code": "internal_error",
                "error": "Request could not be completed",
                "status": 500,
                "request_id": request_id,
            },
        )
