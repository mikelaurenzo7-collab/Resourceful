"""Bandwidth leasing adapter.

Supports:
- Speed test verification
- Agent heartbeat monitoring
- Usage metering per GB

MVP: Self-reported config + simulated probe.
Phase 2: Downloadable agent with real-time reporting.
"""

from datetime import datetime

from app.adapters.base import ResourceAdapter, VerificationResult, UsageReading


class BandwidthAdapter(ResourceAdapter):

    @property
    def resource_type(self) -> str:
        return "bandwidth"

    @property
    def display_name(self) -> str:
        return "Bandwidth"

    @property
    def unit(self) -> str:
        return "GB"

    def validate_config(self, config: dict) -> list[str]:
        errors = []
        if not config.get("download_mbps"):
            errors.append("Download speed (Mbps) is required")
        if not config.get("upload_mbps"):
            errors.append("Upload speed (Mbps) is required")
        return errors

    async def verify(self, config: dict) -> VerificationResult:
        """Verify bandwidth availability.

        MVP: Accept self-reported speeds.
        Phase 2: Run actual probe test from platform servers.
        """
        download = config.get("download_mbps", 0)
        upload = config.get("upload_mbps", 0)
        isp = config.get("isp", "Unknown")

        if not download or not upload:
            return VerificationResult(
                verified=False,
                data={},
                message="Download and upload speeds are required",
            )

        return VerificationResult(
            verified=True,
            data={
                "isp": isp,
                "download_mbps": download,
                "upload_mbps": upload,
                "ip_type": config.get("ip_type", "residential"),
                "verified_at": datetime.utcnow().isoformat(),
                "method": "self_reported",
                "latency_ms": 15,  # Simulated
            },
            message=f"Verified {download}Mbps/{upload}Mbps on {isp}",
        )

    async def read_usage(self, config: dict, start: str, end: str) -> list[UsageReading]:
        """Read bandwidth usage data.

        MVP: Return simulated usage.
        Phase 2: Pull from agent daemon metrics.
        """
        upload_mbps = float(config.get("upload_mbps", 50))
        # Simulate ~30% utilization over 24h
        daily_gb = (upload_mbps * 0.3 * 3600 * 24) / (8 * 1024)

        return [
            UsageReading(
                timestamp=start,
                quantity=round(daily_gb, 2),
                unit="GB",
                metadata={
                    "source": "simulated",
                    "upload_mbps": upload_mbps,
                    "utilization": 0.3,
                },
            )
        ]

    async def estimate_capacity(self, config: dict) -> float:
        """Estimate available bandwidth capacity in GB/hour."""
        upload_mbps = float(config.get("upload_mbps", 50))
        # Available GB per hour at 70% capacity
        return round((upload_mbps * 0.7 * 3600) / (8 * 1024), 2)
