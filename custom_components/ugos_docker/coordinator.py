"""Coordinator data retrieval and schema-tolerant UGOS Docker parsing."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from homeassistant.helpers.update_coordinator import UpdateFailed
from homeassistant.util import dt as dt_util

from .api import UgosDockerClient, UgosError

PAGE_SIZE = 100
ERROR_STATES = {"error", "dead", "failed", "failure"}
RUNNING_STATES = {"running", "restarting"}


@dataclass(frozen=True)
class UgosDockerData:
    """The last complete authoritative summary plus optional detail lists."""

    container_updates: int
    project_updates: int
    containers: int | None
    projects: int | None
    running: int | None
    stopped: int | None
    errors: int | None
    update_containers: list[dict[str, Any]] = field(default_factory=list)
    update_projects: list[dict[str, Any]] = field(default_factory=list)
    detail_error: str | None = None
    updated_at: datetime = field(default_factory=dt_util.utcnow)


def _result(value: Any) -> Any:
    if not isinstance(value, dict) or "result" not in value:
        raise UgosError("UGOS returned an unsupported response schema")
    return value["result"]


def _count(value: Any) -> int:
    value = _result(value)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise UgosError("UGOS returned an invalid update count")
    return value


async def async_update_data(client: UgosDockerClient) -> UgosDockerData:
    """Get native counts first, then enrich them with read-only list data.

    Update counts are never calculated from flags.  List failures are recorded as
    diagnostic detail failures, while count/overview failures make all data stale
    rather than incorrectly turning updates into zero.
    """
    try:
        container_count_raw, project_count_raw, overview = await asyncio.gather(
            client.async_get("docker/container/GetUpdateContainerCount"),
            client.async_get("docker/compose/GetUpdateProjectCount"),
            client.async_get("docker/view/ObtainOverviewInfo"),
        )
        container_updates = _count(container_count_raw)
        project_updates = _count(project_count_raw)
        if not isinstance(overview, dict):
            raise UgosError("UGOS returned an invalid Docker overview")
    except UgosError as err:
        raise UpdateFailed(str(err)) from err

    detail_error = None
    try:
        containers, projects = await asyncio.gather(_containers(client), _projects(client))
    except UgosError as err:
        containers, projects, detail_error = [], [], str(err)

    if containers:
        total = len(containers)
        running = sum(_is_running(item.get("status")) for item in containers)
        stopped = total - running
        errors = sum(_is_error(item.get("status")) for item in containers)
    else:
        total = _optional_nonnegative(overview.get("containerCount"))
        running = _optional_nonnegative(overview.get("runContainerCount"))
        stopped = total - running if total is not None and running is not None else None
        errors = None

    project_total = len(projects) if projects else _optional_nonnegative(overview.get("projectCounr"))
    update_containers = [_container_attribute(c) for c in containers if c.get("imgHasUpdate") is True]
    update_projects = [_project_attribute(p) for p in projects if p.get("imgHasUpdate") is True]
    discrepancy = []
    if containers and container_updates != len(update_containers):
        discrepancy.append(f"native container count {container_updates}; detail flags {len(update_containers)}")
    if projects and project_updates != len(update_projects):
        discrepancy.append(f"native project count {project_updates}; detail flags {len(update_projects)}")
    if discrepancy:
        detail_error = "; ".join(filter(None, [detail_error, *discrepancy]))

    return UgosDockerData(
        container_updates, project_updates, total, project_total, running, stopped, errors,
        update_containers, update_projects, detail_error,
    )


async def _containers(client: UgosDockerClient) -> list[dict[str, Any]]:
    """Join paged summaries and live detail records by container ID."""
    page = 1
    all_items: list[dict[str, Any]] = []
    while True:
        body = {"pageNum": page, "pageSize": PAGE_SIZE}
        listing, details = await asyncio.gather(
            client.async_post("docker/container/ContainerListV2", body),
            client.async_post("docker/container/ShowContainerDetailListV2", body),
        )
        if not isinstance(listing, dict) or not isinstance(listing.get("result"), list):
            raise UgosError("UGOS returned an invalid container list")
        raw = listing["result"]
        if not all(isinstance(item, dict) for item in raw):
            raise UgosError("UGOS returned an invalid container item")
        stats = _result(details)
        if stats is None:
            stats = []
        if not isinstance(stats, list):
            raise UgosError("UGOS returned an invalid container detail list")
        by_id = {str(item.get("containerId")): item for item in stats if isinstance(item, dict)}
        all_items.extend({**item, **by_id.get(str(item.get("containerId")), {})} for item in raw)
        expected = _optional_nonnegative(listing.get("originalTotal"))
        if not raw or len(all_items) >= (expected if expected is not None else len(all_items)):
            return all_items
        page += 1
        if page > 1000:
            raise UgosError("UGOS container pagination did not terminate")


async def _projects(client: UgosDockerClient) -> list[dict[str, Any]]:
    body = {
        "projectName": "",
        "projectFilter": {"projectStatusFilter": [], "projectTypeFilter": [], "projectHasUpFilter": []},
        "projectSort": {"projectSortEnum": 1, "projectSortOrder": 0},
    }
    reply = await client.async_post("docker/compose/GetProjectListV3", body)
    if not isinstance(reply, dict):
        raise UgosError("UGOS returned an invalid project list")
    projects = reply.get("list")
    if projects is None:
        return []
    if not isinstance(projects, list) or not all(isinstance(item, dict) for item in projects):
        raise UgosError("UGOS returned an invalid project item")
    return projects


def _optional_nonnegative(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def _is_running(value: Any) -> bool:
    return str(value or "").lower() in RUNNING_STATES


def _is_error(value: Any) -> bool:
    return str(value or "").lower() in ERROR_STATES


def _container_attribute(item: dict[str, Any]) -> dict[str, Any]:
    """Small, documented attributes only; do not leak arbitrary UGOS fields."""
    return {key: value for key, value in {
        "name": item.get("name"), "id": item.get("containerId"),
        "image": item.get("imageName"), "tag": item.get("version"),
        "project": item.get("projectName") or None, "has_update": True,
    }.items() if value not in (None, "")}


def _project_attribute(item: dict[str, Any]) -> dict[str, Any]:
    containers = item.get("containerList")
    return {key: value for key, value in {
        "name": item.get("name"), "id": item.get("id") or item.get("name"),
        "update_containers": [c.get("containerName") for c in containers if isinstance(c, dict)]
        if isinstance(containers, list) else None,
        "has_update": True,
    }.items() if value not in (None, "", [])}
