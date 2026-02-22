"""GPU compute adapter.

Supports:
- NVIDIA GPU detection and benchmarking
- Docker container management for sandboxed execution
- Usage metering per GPU-hour

MVP: Self-reported specs + simulated benchmark.
Phase 2: Docker agent with real GPU detection and job dispatch.
"""

from datetime import datetime

from app.adapters.base import ResourceAdapter, VerificationResult, UsageReading

GPU_TIERS = {
    "rtx_4090": {"vram_gb": 24, "tflops_fp16": 82.6, "tier": "enthusiast"},
    "rtx_4080": {"vram_gb": 16, "tflops_fp16": 48.7, "tier": "enthusiast"},
    "rtx_3090": {"vram_gb": 24, "tflops_fp16": 35.6, "tier": "enthusiast"},
    "a100": {"vram_gb": 80, "tflops_fp16": 312.0, "tier": "datacenter"},
    "h100": {"vram_gb": 80, "tflops_fp16": 989.0, "tier": "datacenter"},
    "rx_7900xtx": {"vram_gb": 24, "tflops_fp16": 61.4, "tier": "enthusiast"},
}


class GPUAdapter(ResourceAdapter):

    @property
    def resource_type(self) -> str:
        return "gpu"

    @property
    def display_name(self) -> str:
        return "GPU Compute"

    @property
    def unit(self) -> str:
        return "GPU-hour"

    def validate_config(self, config: dict) -> list[str]:
        errors = []
        if not config.get("gpu_model"):
            errors.append("GPU model is required")
        if not config.get("vram_gb"):
            errors.append("VRAM (GB) is required")
        return errors

    async def verify(self, config: dict) -> VerificationResult:
        """Verify GPU availability.

        MVP: Validate config against known GPU specs.
        Phase 2: Run actual benchmark via Docker agent.
        """
        gpu_model = config.get("gpu_model", "unknown")
        vram = config.get("vram_gb", 0)

        if not gpu_model or not vram:
            return VerificationResult(
                verified=False, data={}, message="GPU model and VRAM are required"
            )

        known_specs = GPU_TIERS.get(gpu_model)
        benchmark_score = 0.0

        if known_specs:
            benchmark_score = known_specs["tflops_fp16"]
            tier = known_specs["tier"]
        else:
            tier = "unknown"
            benchmark_score = float(vram) * 2.0  # Rough estimate

        return VerificationResult(
            verified=True,
            data={
                "gpu_model": gpu_model,
                "vram_gb": vram,
                "cuda_cores": config.get("cuda_cores"),
                "driver_version": config.get("driver_version"),
                "tier": tier,
                "benchmark_tflops_fp16": benchmark_score,
                "verified_at": datetime.utcnow().isoformat(),
                "method": "config_review",
            },
            message=f"Verified {gpu_model} ({vram}GB VRAM, {benchmark_score} TFLOPS FP16)",
        )

    async def read_usage(self, config: dict, start: str, end: str) -> list[UsageReading]:
        """Read GPU usage data.

        MVP: Return simulated usage.
        Phase 2: Pull from Docker agent runtime metrics.
        """
        return [
            UsageReading(
                timestamp=start,
                quantity=1.0,
                unit="GPU-hour",
                metadata={
                    "source": "simulated",
                    "gpu_model": config.get("gpu_model", "unknown"),
                    "utilization_percent": 75,
                },
            )
        ]

    async def estimate_capacity(self, config: dict) -> float:
        """Estimate available GPU capacity in GPU-hours per hour."""
        # Single GPU = 1 GPU-hour per hour when idle
        return 1.0
