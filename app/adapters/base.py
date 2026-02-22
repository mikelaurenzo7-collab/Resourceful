"""Base adapter interface for all resource types."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class VerificationResult:
    verified: bool
    data: dict
    message: str


@dataclass
class UsageReading:
    timestamp: str
    quantity: float
    unit: str
    metadata: dict


class ResourceAdapter(ABC):
    """Base class for resource-type-specific adapters.

    Each adapter handles:
    - Verification of the resource (is it real, does the user own it?)
    - Reading usage/production data
    - Estimating available capacity
    """

    @property
    @abstractmethod
    def resource_type(self) -> str:
        """The slug of the resource type this adapter handles."""

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable name."""

    @property
    @abstractmethod
    def unit(self) -> str:
        """Unit of measurement (kWh, GB, GPU-hour)."""

    @abstractmethod
    async def verify(self, config: dict) -> VerificationResult:
        """Verify the resource exists and the user has access."""

    @abstractmethod
    async def read_usage(self, config: dict, start: str, end: str) -> list[UsageReading]:
        """Read usage/production data for a time range."""

    @abstractmethod
    async def estimate_capacity(self, config: dict) -> float:
        """Estimate currently available capacity."""

    def validate_config(self, config: dict) -> list[str]:
        """Validate resource-specific configuration. Returns list of errors."""
        return []
