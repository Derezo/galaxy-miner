"""
Amplitude envelope generators for shaping sound over time.

Envelopes control how a sound's volume changes from start to finish.
They are essential for creating natural-sounding, dynamic audio.
"""

import numpy as np
from numpy.typing import NDArray


def adsr_envelope(
    samples: NDArray[np.float64],
    attack: float = 0.01,
    decay: float = 0.1,
    sustain: float = 0.7,
    release: float = 0.2,
    sustain_level: float = None
) -> NDArray[np.float64]:
    """
    Apply an ADSR (Attack-Decay-Sustain-Release) envelope.

    ADSR is the classic synthesizer envelope shape:
    - Attack: Fade in time
    - Decay: Time to fall from peak to sustain level
    - Sustain: Level to hold during note
    - Release: Fade out time

    Args:
        samples: Input audio samples
        attack: Attack time as fraction of total duration (0.0-1.0)
        decay: Decay time as fraction of total duration (0.0-1.0)
        sustain: Sustain level (0.0-1.0)
        release: Release time as fraction of total duration (0.0-1.0)
        sustain_level: Alias for sustain parameter

    Returns:
        Samples with envelope applied

    Example:
        >>> wave = square_wave(440, 0.5)
        >>> shaped = adsr_envelope(wave, attack=0.05, decay=0.15, sustain=0.6, release=0.3)
    """
    # Support both 'sustain' and 'sustain_level' parameter names
    if sustain_level is not None:
        sustain = sustain_level

    n = len(samples)
    envelope = np.zeros(n)

    # Calculate phase boundaries (in samples)
    attack_samples = int(n * attack)
    decay_samples = int(n * decay)
    release_samples = int(n * release)
    sustain_samples = n - attack_samples - decay_samples - release_samples

    # Ensure non-negative sustain length
    if sustain_samples < 0:
        # Adjust phases proportionally
        total = attack + decay + release
        attack_samples = int(n * attack / total)
        decay_samples = int(n * decay / total)
        release_samples = int(n * release / total)
        sustain_samples = n - attack_samples - decay_samples - release_samples

    idx = 0

    # Attack phase: linear rise to 1.0
    if attack_samples > 0:
        envelope[idx:idx + attack_samples] = np.linspace(0, 1.0, attack_samples)
        idx += attack_samples

    # Decay phase: linear fall to sustain level
    if decay_samples > 0:
        envelope[idx:idx + decay_samples] = np.linspace(1.0, sustain, decay_samples)
        idx += decay_samples

    # Sustain phase: constant level
    if sustain_samples > 0:
        envelope[idx:idx + sustain_samples] = sustain
        idx += sustain_samples

    # Release phase: linear fall to 0
    if release_samples > 0:
        envelope[idx:idx + release_samples] = np.linspace(sustain, 0, release_samples)

    return samples * envelope


def percussive_envelope(
    samples: NDArray[np.float64],
    attack: float = 0.01,
    decay: float = 0.3
) -> NDArray[np.float64]:
    """
    Apply a percussive envelope (fast attack, exponential decay).

    Perfect for laser shots, explosions, and impact sounds.
    Creates punchy, transient-heavy sounds.

    Args:
        samples: Input audio samples
        attack: Attack time as fraction of total duration (0.0-1.0)
        decay: Decay curve steepness (higher = faster decay)

    Returns:
        Samples with percussive envelope applied

    Example:
        >>> noise = white_noise(0.15)
        >>> laser = percussive_envelope(noise, attack=0.02, decay=0.5)
    """
    n = len(samples)
    envelope = np.zeros(n)

    attack_samples = int(n * attack)
    decay_samples = n - attack_samples

    # Fast linear attack
    if attack_samples > 0:
        envelope[:attack_samples] = np.linspace(0, 1.0, attack_samples)

    # Exponential decay
    if decay_samples > 0:
        t = np.linspace(0, decay, decay_samples)
        envelope[attack_samples:] = np.exp(-t * 5)  # Exponential decay

    return samples * envelope


def swell_envelope(
    samples: NDArray[np.float64],
    attack_time: float = 0.5
) -> NDArray[np.float64]:
    """
    Apply a gradual fade-in (swell) envelope.

    Creates smooth, gradual builds. Useful for ambient sounds,
    power-ups, or reverse-cymbal style effects.

    Args:
        samples: Input audio samples
        attack_time: Fade in time as fraction of total duration (0.0-1.0)

    Returns:
        Samples with swell envelope applied

    Example:
        >>> wave = triangle_wave(220, 1.0)
        >>> swell = swell_envelope(wave, attack_time=0.7)
    """
    n = len(samples)
    envelope = np.ones(n)

    attack_samples = int(n * attack_time)

    if attack_samples > 0:
        # Smooth S-curve fade in
        t = np.linspace(0, np.pi / 2, attack_samples)
        envelope[:attack_samples] = np.sin(t)  # Sine curve for smooth swell

    return samples * envelope


def wobble_envelope(
    samples: NDArray[np.float64],
    rate: float = 5.0,
    depth: float = 0.5
) -> NDArray[np.float64]:
    """
    Apply LFO (Low Frequency Oscillator) amplitude modulation.

    Creates a wobbling, pulsing effect. Great for alien sounds,
    sirens, or dubstep-style wobbles.

    Args:
        samples: Input audio samples
        rate: LFO frequency in Hz (how fast it wobbles)
        depth: Modulation depth (0.0-1.0), how much volume varies

    Returns:
        Samples with wobble modulation applied

    Example:
        >>> wave = sawtooth_wave(110, 2.0)
        >>> wobble = wobble_envelope(wave, rate=3.0, depth=0.8)
    """
    n = len(samples)
    sample_rate = n / 2.0  # Approximate based on typical durations

    t = np.arange(n) / sample_rate
    lfo = np.sin(2 * np.pi * rate * t)

    # Map LFO from [-1, 1] to [1-depth, 1]
    modulation = 1.0 - depth * (1.0 - lfo) / 2.0

    return samples * modulation
