import pytest

from app.adapters.solar import SolarAdapter
from app.adapters.bandwidth import BandwidthAdapter
from app.adapters.gpu import GPUAdapter
from app.adapters import get_adapter


@pytest.mark.asyncio
async def test_solar_verify():
    adapter = SolarAdapter()
    result = await adapter.verify({"inverter_brand": "enphase", "capacity_kw": 10})
    assert result.verified is True
    assert result.data["inverter_brand"] == "enphase"
    assert result.data["capacity_kw"] == 10


@pytest.mark.asyncio
async def test_solar_verify_missing_capacity():
    adapter = SolarAdapter()
    result = await adapter.verify({})
    assert result.verified is False


@pytest.mark.asyncio
async def test_solar_estimate_capacity():
    adapter = SolarAdapter()
    capacity = await adapter.estimate_capacity({"capacity_kw": 10})
    assert isinstance(capacity, float)
    assert capacity >= 0


@pytest.mark.asyncio
async def test_solar_read_usage():
    adapter = SolarAdapter()
    readings = await adapter.read_usage({"capacity_kw": 10}, "2026-01-01", "2026-01-02")
    assert len(readings) == 1
    assert readings[0].unit == "kWh"
    assert readings[0].quantity > 0


@pytest.mark.asyncio
async def test_bandwidth_verify():
    adapter = BandwidthAdapter()
    result = await adapter.verify({
        "download_mbps": 500,
        "upload_mbps": 100,
        "isp": "Comcast",
    })
    assert result.verified is True
    assert result.data["download_mbps"] == 500


@pytest.mark.asyncio
async def test_bandwidth_estimate():
    adapter = BandwidthAdapter()
    capacity = await adapter.estimate_capacity({"upload_mbps": 100})
    assert capacity > 0


@pytest.mark.asyncio
async def test_gpu_verify():
    adapter = GPUAdapter()
    result = await adapter.verify({"gpu_model": "rtx_4090", "vram_gb": 24})
    assert result.verified is True
    assert result.data["tier"] == "enthusiast"
    assert result.data["benchmark_tflops_fp16"] == 82.6


@pytest.mark.asyncio
async def test_gpu_verify_unknown_model():
    adapter = GPUAdapter()
    result = await adapter.verify({"gpu_model": "custom_gpu", "vram_gb": 16})
    assert result.verified is True
    assert result.data["tier"] == "unknown"


@pytest.mark.asyncio
async def test_get_adapter():
    solar = get_adapter("solar")
    assert isinstance(solar, SolarAdapter)
    bandwidth = get_adapter("bandwidth")
    assert isinstance(bandwidth, BandwidthAdapter)
    gpu = get_adapter("gpu")
    assert isinstance(gpu, GPUAdapter)


@pytest.mark.asyncio
async def test_get_adapter_invalid():
    with pytest.raises(ValueError, match="No adapter"):
        get_adapter("nonexistent")
