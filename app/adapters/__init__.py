from app.adapters.base import ResourceAdapter
from app.adapters.solar import SolarAdapter
from app.adapters.bandwidth import BandwidthAdapter
from app.adapters.gpu import GPUAdapter

ADAPTERS: dict[str, type[ResourceAdapter]] = {
    "solar": SolarAdapter,
    "bandwidth": BandwidthAdapter,
    "gpu": GPUAdapter,
}


def get_adapter(resource_type: str) -> ResourceAdapter:
    adapter_cls = ADAPTERS.get(resource_type)
    if not adapter_cls:
        raise ValueError(f"No adapter for resource type: {resource_type}")
    return adapter_cls()


__all__ = ["ResourceAdapter", "SolarAdapter", "BandwidthAdapter", "GPUAdapter", "get_adapter"]
