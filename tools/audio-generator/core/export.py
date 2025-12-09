"""
WAV file export utilities for saving generated audio.

This module handles conversion of numpy arrays to WAV files
and manages output directory structure.
"""

from __future__ import annotations
import numpy as np
from numpy.typing import NDArray
from pathlib import Path
from scipy.io import wavfile


def export_wav(
    samples: NDArray[np.float64],
    filename: str,
    sample_rate: int = 22050
) -> Path:
    """
    Export audio samples as 16-bit mono WAV file.

    Converts floating-point samples to 16-bit integer PCM format
    and writes to WAV file.

    Args:
        samples: Audio samples in range [-1.0, 1.0]
        filename: Output filename (with or without .wav extension)
        sample_rate: Sample rate in Hz

    Returns:
        Path object to the exported file

    Example:
        >>> wave = square_wave(440, 0.5)
        >>> path = export_wav(wave, 'laser_shot.wav')
        >>> print(f"Exported to {path}")

    Raises:
        ValueError: If samples array is empty
    """
    if len(samples) == 0:
        raise ValueError("Cannot export empty audio samples")

    # Ensure .wav extension
    if not filename.endswith('.wav'):
        filename = filename + '.wav'

    # Convert to Path object (assumes filename is relative to output dir)
    # Import here to avoid circular dependency
    import sys
    from pathlib import Path as PathLib
    parent_dir = PathLib(__file__).parent.parent
    sys.path.insert(0, str(parent_dir))
    import config
    output_path = config.OUTPUT_DIR / filename

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Clip samples to valid range
    samples = np.clip(samples, -1.0, 1.0)

    # Convert float [-1.0, 1.0] to int16 [-32768, 32767]
    samples_int16 = (samples * 32767).astype(np.int16)

    # Write WAV file
    wavfile.write(str(output_path), sample_rate, samples_int16)

    return output_path


def ensure_output_dir(subdir: str = '') -> Path:
    """
    Ensure output directory (and optional subdirectory) exists.

    Creates the output directory structure if it doesn't exist.
    Useful for organizing exports into categories.

    Args:
        subdir: Optional subdirectory name (e.g., 'weapons', 'explosions')

    Returns:
        Path object to the directory

    Example:
        >>> weapon_dir = ensure_output_dir('weapons')
        >>> explosion_dir = ensure_output_dir('explosions')
    """
    import sys
    from pathlib import Path as PathLib
    parent_dir = PathLib(__file__).parent.parent
    sys.path.insert(0, str(parent_dir))
    import config

    if subdir:
        output_path = config.OUTPUT_DIR / subdir
    else:
        output_path = config.OUTPUT_DIR

    output_path.mkdir(parents=True, exist_ok=True)

    return output_path
