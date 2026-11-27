"""Coordinator parsing tests (run with pytest-homeassistant-custom-component)."""
from __future__ import annotations

import pytest

from custom_components.ugos_docker.api import UgosError
from custom_components.ugos_docker.coordinator import async_update_data


class Client:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    async def async_get(self, endpoint):
        self.calls.append(endpoint)
        value = self.responses[endpoint]
        if isinstance(value, Exception):
            raise value
        return value

    async def async_post(self, endpoint, body):
        self.calls.append((endpoint, body["pageNum"] if "pageNum" in body else None))
        value = self.responses[(endpoint, body.get("pageNum"))]
        if isinstance(value, Exception):
            raise value
        return value


def responses(container_count=0, project_count=0):
    return {
        "docker/container/GetUpdateContainerCount": {"result": container_count},
        "docker/compose/GetUpdateProjectCount": {"result": project_count},
        "docker/view/ObtainOverviewInfo": {"containerCount": 2, "runContainerCount": 1, "projectCounr": 1},
        ("docker/container/ContainerListV2", 1): {"originalTotal": 2, "result": [
            {"containerId": "one", "name": "one", "imageName": "nginx", "version": "1.0", "status": "running"},
            {"containerId": "two", "name": "two", "imageName": "redis", "version": "7", "status": "exited", "projectName": "stack"},
        ]},
        ("docker/container/ShowContainerDetailListV2", 1): {"result": [
            {"containerId": "one", "imgHasUpdate": True}, {"containerId": "two", "imgHasUpdate": False},
        ]},
        ("docker/compose/GetProjectListV3", None): {"list": [{"name": "stack", "imgHasUpdate": True, "containerList": [{"containerName": "two"}]}]},
    }


@pytest.mark.asyncio
async def test_native_zero_counts_and_stopped_are_not_errors():
    data = await async_update_data(Client(responses()))
    assert (data.container_updates, data.project_updates) == (0, 0)
    assert (data.containers, data.running, data.stopped, data.errors) == (2, 1, 1, 0)
    # Flags can disagree; native count remains authoritative and discrepancy is visible.
    assert data.detail_error == "native container count 0; detail flags 1; native project count 0; detail flags 1"


@pytest.mark.asyncio
async def test_multiple_updates_and_pagination():
    reply = responses(2, 1)
    reply[("docker/container/ContainerListV2", 1)] = {"originalTotal": 2, "result": [reply[("docker/container/ContainerListV2", 1)]["result"][0]]}
    reply[("docker/container/ShowContainerDetailListV2", 1)] = {"result": [{"containerId": "one", "imgHasUpdate": True}]}
    reply[("docker/container/ContainerListV2", 2)] = {"originalTotal": 2, "result": [{"containerId": "two", "name": "two", "status": "dead"}]}
    reply[("docker/container/ShowContainerDetailListV2", 2)] = {"result": [{"containerId": "two", "imgHasUpdate": True}]}
    data = await async_update_data(Client(reply))
    assert len(data.update_containers) == 2
    assert data.errors == 1


@pytest.mark.asyncio
async def test_required_api_failure_never_becomes_zero():
    reply = responses()
    reply["docker/container/GetUpdateContainerCount"] = UgosError("offline")
    with pytest.raises(Exception, match="offline"):
        await async_update_data(Client(reply))


@pytest.mark.asyncio
async def test_malformed_detail_is_partial_failure_not_a_zero_count():
    reply = responses(1, 1)
    reply[("docker/container/ShowContainerDetailListV2", 1)] = {"result": "bad"}
    data = await async_update_data(Client(reply))
    assert (data.container_updates, data.project_updates) == (1, 1)
    assert data.detail_error
