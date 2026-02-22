"""Solar energy export adapter.

Supports:
- Enphase, SolarEdge, Tesla, SMA inverter APIs
- Manual CSV import
- Smart meter polling

MVP: Manual entry + simulated data. Phase 2: OAuth with Enphase/SolarEdge.
"""

from datetime import datetime

from app.adapters.base import ResourceAdapter, VerificationResult, UsageReading


class SolarAdapter(ResourceAdapter):

    @property
    def resource_type(self) -> str:
        return "solar"

    @property
    def display_name(self) -> str:
        return "Solar Export"

    @property
    def unit(self) -> str:
        return "kWh"

    def validate_config(self, config: dict) -> list[str]:
        errors = []
        if not config.get("capacity_kw"):
            errors.append("System capacity (kW) is required")
        else:
            try:
                kw = float(config["capacity_kw"])
                if kw <= 0 or kw > 1000:
                    errors.append("Capacity must be between 0 and 1000 kW")
            except (ValueError, TypeError):
                errors.append("Invalid capacity value")
        return errors

    async def verify(self, config: dict) -> VerificationResult:
        """Verify solar installation.

        MVP: Accept if config has required fields.
        Phase 2: Connect to inverter API and verify production data.
        """
        inverter = config.get("inverter_brand", "unknown")
        capacity = config.get("capacity_kw", 0)

        if not capacity:
            return VerificationResult(
                verified=False,
                data={},
                message="System capacity is required for verification",
            )

        # MVP: Auto-verify based on config completeness
        return VerificationResult(
            verified=True,
            data={
                "inverter_brand": inverter,
                "capacity_kw": capacity,
                "panel_count": config.get("panel_count"),
                "verified_at": datetime.utcnow().isoformat(),
                "method": "config_review",
            },
            message=f"Verified {capacity}kW {inverter} system via configuration review",
        )

    async def read_usage(self, config: dict, start: str, end: str) -> list[UsageReading]:
        """Read solar export data.

        MVP: Return simulated data based on capacity.
        Phase 2: Pull from Enphase/SolarEdge API.
        """
        capacity_kw = float(config.get("capacity_kw", 5))
        # Simulate ~4 peak sun hours, 80% export ratio
        daily_export = capacity_kw * 4 * 0.8

        return [
            UsageReading(
                timestamp=start,
                quantity=round(daily_export, 2),
                unit="kWh",
                metadata={
                    "source": "simulated",
                    "capacity_kw": capacity_kw,
                    "peak_hours": 4,
                    "export_ratio": 0.8,
                },
            )
        ]

    async def estimate_capacity(self, config: dict) -> float:
        """Estimate current available export capacity in kWh."""
        capacity_kw = float(config.get("capacity_kw", 5))
        hour = datetime.utcnow().hour

        # Simple solar curve: peak at noon, zero at night
        if 6 <= hour <= 20:
            solar_fraction = max(0, 1 - abs(hour - 13) / 7)
            return round(capacity_kw * solar_fraction * 0.8, 2)
        return 0.0
