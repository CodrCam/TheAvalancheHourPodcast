"""IAM-only Lambda Function URL handler for bounded public endpoint probes."""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any


MAX_ENDPOINTS = 5
USER_AGENT = "AvalancheHourResilienceProbe/1.0"


def _csv_environment(name: str) -> list[str]:
    values = [value.strip() for value in os.environ.get(name, "").split(",")]
    return [value for value in values if value]


def _allowed_hosts() -> frozenset[str]:
    hosts = {host.lower().rstrip(".") for host in _csv_environment("PROBE_ALLOWED_HOSTS")}
    if not hosts or len(hosts) > MAX_ENDPOINTS:
        raise ValueError("PROBE_ALLOWED_HOSTS must contain one to five hostnames")
    return frozenset(hosts)


def _validate_url(url: str, allowed_hosts: frozenset[str]) -> str:
    parsed = urllib.parse.urlsplit(url)
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https":
        raise ValueError("probe URLs must use HTTPS")
    if not hostname or hostname not in allowed_hosts:
        raise ValueError("probe URL hostname is not allowlisted")
    if parsed.username or parsed.password:
        raise ValueError("probe URLs must not contain credentials")
    if parsed.port not in (None, 443):
        raise ValueError("probe URLs may only use the default HTTPS port")
    if parsed.fragment:
        raise ValueError("probe URLs must not contain fragments")
    return urllib.parse.urlunsplit(parsed)


class _AllowlistedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_hosts: frozenset[str]) -> None:
        super().__init__()
        self.allowed_hosts = allowed_hosts

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        absolute_url = urllib.parse.urljoin(req.full_url, newurl)
        safe_url = _validate_url(absolute_url, self.allowed_hosts)
        return super().redirect_request(req, fp, code, msg, headers, safe_url)


def _request_timeout() -> float:
    try:
        value = float(os.environ.get("PROBE_REQUEST_TIMEOUT_SECONDS", "2"))
    except ValueError:
        value = 2.0
    return min(max(value, 0.25), 2.0)


def _probe(endpoint: str, allowed_hosts: frozenset[str], timeout: float) -> dict[str, Any]:
    started = time.monotonic()
    request = urllib.request.Request(
        endpoint,
        method="GET",
        headers={
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.1",
            "Cache-Control": "no-cache",
            "User-Agent": USER_AGENT,
        },
    )
    opener = urllib.request.build_opener(_AllowlistedRedirectHandler(allowed_hosts))

    try:
        with opener.open(request, timeout=timeout) as response:
            status = int(response.status)
            final_url = _validate_url(response.geturl(), allowed_hosts)
            return {
                "endpoint": endpoint,
                "final_url": final_url,
                "status": status,
                "ok": 200 <= status < 400,
                "latency_ms": round((time.monotonic() - started) * 1000),
            }
    except urllib.error.HTTPError as error:
        return {
            "endpoint": endpoint,
            "status": int(error.code),
            "ok": False,
            "latency_ms": round((time.monotonic() - started) * 1000),
            "error": "http_error",
        }
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        return {
            "endpoint": endpoint,
            "status": None,
            "ok": False,
            "latency_ms": round((time.monotonic() - started) * 1000),
            "error": type(error).__name__,
        }


def _configured_endpoints(allowed_hosts: frozenset[str]) -> list[str]:
    endpoints = _csv_environment("PROBE_ENDPOINTS")
    if not endpoints or len(endpoints) > MAX_ENDPOINTS:
        raise ValueError("PROBE_ENDPOINTS must contain one to five URLs")
    return [_validate_url(endpoint, allowed_hosts) for endpoint in endpoints]


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Probe only deployment-configured URLs; request data never selects a target."""

    del event
    allowed_hosts = _allowed_hosts()
    endpoints = _configured_endpoints(allowed_hosts)
    timeout = _request_timeout()
    results_by_endpoint: dict[str, dict[str, Any]] = {}

    with ThreadPoolExecutor(max_workers=len(endpoints)) as executor:
        futures = {
            executor.submit(_probe, endpoint, allowed_hosts, timeout): endpoint
            for endpoint in endpoints
        }
        for future in as_completed(futures):
            endpoint = futures[future]
            try:
                results_by_endpoint[endpoint] = future.result()
            except Exception as error:  # Keep one probe failure from hiding the others.
                results_by_endpoint[endpoint] = {
                    "endpoint": endpoint,
                    "status": None,
                    "ok": False,
                    "latency_ms": None,
                    "error": type(error).__name__,
                }

    results = [results_by_endpoint[endpoint] for endpoint in endpoints]
    healthy = all(result["ok"] for result in results)
    request_id = getattr(context, "aws_request_id", None)
    print(
        json.dumps(
            {
                "event": "resilience_probe_completed",
                "request_id": request_id,
                "healthy": healthy,
                "statuses": [result["status"] for result in results],
            },
            separators=(",", ":"),
        )
    )

    body = {
        "ok": healthy,
        "request_id": request_id,
        "checked": len(results),
        "results": results,
    }
    return {
        "statusCode": 200 if healthy else 503,
        "headers": {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
        },
        "body": json.dumps(body, separators=(",", ":")),
        "isBase64Encoded": False,
    }

