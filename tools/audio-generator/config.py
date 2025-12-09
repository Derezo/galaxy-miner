"""
Global configuration constants for the 8-bit procedural audio system.

This module defines sample rates, bit depths, and output paths used
throughout the audio generation pipeline.
"""

from pathlib import Path

# Audio quality settings
SAMPLE_RATE = 22050  # Hz - Classic 8-bit era sample rate
BIT_DEPTH = 16       # Bits per sample (export format)
DEFAULT_DURATION = 0.3  # Seconds - Default sound duration

# Output configuration
OUTPUT_DIR = Path(__file__).parent / 'output'

# Ensure output directory exists
OUTPUT_DIR.mkdir(exist_ok=True)

# 8-bit aesthetic constants
BITCRUSH_DEPTH = 5   # Target bit depth for 8-bit aesthetic (4-6 bits typical)
MAX_AMPLITUDE = 0.9  # Maximum amplitude before normalization (prevent clipping)
