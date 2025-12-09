"""
Audio mixing and layering utilities.

This module provides functions for combining multiple audio layers,
normalizing levels, and applying fades.
"""

from __future__ import annotations
import numpy as np
from numpy.typing import NDArray


def mix_layers(
    *args,
    weights: list[float] | None = None
) -> NDArray[np.float64]:
    """
    Combine multiple audio layers with optional weighting.

    Mixes multiple sound layers together. Automatically matches lengths
    by padding shorter layers with zeros.

    Args:
        *args: Audio sample arrays to mix (can be passed as list or individual args)
        weights: Optional list of mixing weights (default: equal mix)
                 If None, all layers mixed equally

    Returns:
        Mixed audio samples

    Example:
        >>> base = square_wave(220, 0.5)
        >>> harmony = square_wave(330, 0.5)
        >>> mixed = mix_layers(base, harmony, weights=[0.7, 0.3])
    """
    # Handle both mix_layers([a, b]) and mix_layers(a, b) calling conventions
    if len(args) == 1 and isinstance(args[0], list):
        layer_list = args[0]
    else:
        layer_list = list(args)

    if not layer_list:
        return np.array([])

    # Find maximum length
    max_len = max(len(layer) for layer in layer_list)

    # Pad all layers to same length
    padded_layers = []
    for layer in layer_list:
        if len(layer) < max_len:
            padded = np.pad(layer, (0, max_len - len(layer)), mode='constant')
            padded_layers.append(padded)
        else:
            padded_layers.append(layer)

    # Apply weights
    if weights is None:
        weights = [1.0 / len(layer_list)] * len(layer_list)
    else:
        # Ensure weights list matches layer count
        if len(weights) != len(layer_list):
            raise ValueError(f"Number of weights ({len(weights)}) must match number of layers ({len(layer_list)})")

    # Mix weighted layers
    mixed = np.zeros(max_len)
    for layer, weight in zip(padded_layers, weights):
        mixed += layer * weight

    # Prevent clipping
    max_val = np.max(np.abs(mixed))
    if max_val > 1.0:
        mixed = mixed / max_val

    return mixed


def normalize(
    samples: NDArray[np.float64],
    target_db: float = -3.0
) -> NDArray[np.float64]:
    """
    Normalize audio to target dB level.

    Adjusts amplitude to reach target level without clipping.
    -3dB is a safe default that leaves headroom.

    Args:
        samples: Input audio samples
        target_db: Target level in dB (negative values, -3dB recommended)

    Returns:
        Normalized samples

    Example:
        >>> wave = sawtooth_wave(440, 0.5)
        >>> normalized = normalize(wave, target_db=-6.0)
    """
    if len(samples) == 0:
        return samples

    # Find current peak level
    peak = np.max(np.abs(samples))

    if peak == 0:
        return samples

    # Convert target dB to linear amplitude
    target_amplitude = 10 ** (target_db / 20.0)

    # Scale to target
    scale_factor = target_amplitude / peak

    return samples * scale_factor


def fade_in(
    samples: NDArray[np.float64],
    duration_samples: int
) -> NDArray[np.float64]:
    """
    Apply fade in to beginning of audio.

    Smoothly ramps volume from 0 to full over specified duration.
    Prevents clicks and pops at sound start.

    Args:
        samples: Input audio samples
        duration_samples: Number of samples for fade duration

    Returns:
        Samples with fade in applied

    Example:
        >>> wave = square_wave(440, 1.0)
        >>> smooth = fade_in(wave, duration_samples=1000)
    """
    n = len(samples)
    duration_samples = min(duration_samples, n)

    if duration_samples <= 0:
        return samples

    # Create fade curve (linear)
    fade_curve = np.ones(n)
    fade_curve[:duration_samples] = np.linspace(0, 1.0, duration_samples)

    return samples * fade_curve


def fade_out(
    samples: NDArray[np.float64],
    duration_samples: int
) -> NDArray[np.float64]:
    """
    Apply fade out to end of audio.

    Smoothly ramps volume from full to 0 over specified duration.
    Prevents clicks and pops at sound end.

    Args:
        samples: Input audio samples
        duration_samples: Number of samples for fade duration

    Returns:
        Samples with fade out applied

    Example:
        >>> wave = triangle_wave(880, 1.0)
        >>> smooth = fade_out(wave, duration_samples=2000)
    """
    n = len(samples)
    duration_samples = min(duration_samples, n)

    if duration_samples <= 0:
        return samples

    # Create fade curve (linear)
    fade_curve = np.ones(n)
    fade_curve[-duration_samples:] = np.linspace(1.0, 0, duration_samples)

    return samples * fade_curve
