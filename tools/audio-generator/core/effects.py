"""
Audio processing effects for 8-bit sound design.

This module provides various effects to transform and enhance audio:
bitcrushing, filtering, distortion, pitch modulation, and spatial effects.
"""

import numpy as np
from numpy.typing import NDArray
from scipy import signal


def bitcrush(
    samples: NDArray[np.float64],
    bits: int = 5
) -> NDArray[np.float64]:
    """
    Reduce bit depth for authentic 8-bit aesthetic.

    Bitcrushing quantizes samples to fewer bits, creating the
    characteristic lo-fi digital artifacts of retro game audio.

    Args:
        samples: Input audio samples in range [-1.0, 1.0]
        bits: Target bit depth (4-6 typical for 8-bit sound)

    Returns:
        Bitcrushed samples

    Example:
        >>> wave = triangle_wave(440, 0.3)
        >>> crushed = bitcrush(wave, bits=5)
    """
    bits = max(1, min(bits, 16))  # Clamp to valid range
    levels = 2 ** bits

    # Quantize to fewer levels
    quantized = np.round(samples * (levels / 2)) / (levels / 2)

    return np.clip(quantized, -1.0, 1.0)


def lowpass_filter(
    samples: NDArray[np.float64],
    cutoff: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Apply a simple lowpass filter (removes high frequencies).

    Softens harsh sounds by removing frequencies above the cutoff.
    Creates muffled, warm tones.

    Args:
        samples: Input audio samples
        cutoff: Cutoff frequency in Hz
        sample_rate: Sample rate in Hz

    Returns:
        Filtered samples

    Example:
        >>> wave = sawtooth_wave(220, 0.5)
        >>> smooth = lowpass_filter(wave, cutoff=2000)
    """
    # Nyquist frequency
    nyquist = sample_rate / 2.0
    normalized_cutoff = cutoff / nyquist
    normalized_cutoff = min(0.99, max(0.01, normalized_cutoff))

    # 2nd order Butterworth lowpass
    b, a = signal.butter(2, normalized_cutoff, btype='low')

    return signal.filtfilt(b, a, samples)


def highpass_filter(
    samples: NDArray[np.float64],
    cutoff: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Apply a simple highpass filter (removes low frequencies).

    Removes rumble and bass, creating thin, tinny sounds.
    Useful for radio effects or emphasizing high-frequency transients.

    Args:
        samples: Input audio samples
        cutoff: Cutoff frequency in Hz
        sample_rate: Sample rate in Hz

    Returns:
        Filtered samples

    Example:
        >>> wave = square_wave(440, 0.3)
        >>> thin = highpass_filter(wave, cutoff=1000)
    """
    nyquist = sample_rate / 2.0
    normalized_cutoff = cutoff / nyquist
    normalized_cutoff = min(0.99, max(0.01, normalized_cutoff))

    # 2nd order Butterworth highpass
    b, a = signal.butter(2, normalized_cutoff, btype='high')

    return signal.filtfilt(b, a, samples)


def resonant_filter(
    samples: NDArray[np.float64],
    cutoff: float,
    resonance: float = 2.0,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Apply a resonant lowpass filter with emphasis at cutoff frequency.

    Creates characteristic "wah" sounds and sweeping timbres.
    Higher resonance creates more pronounced peaks.

    Args:
        samples: Input audio samples
        cutoff: Cutoff frequency in Hz
        resonance: Resonance amount (1.0-10.0), higher = more emphasis
        sample_rate: Sample rate in Hz

    Returns:
        Filtered samples with resonance

    Example:
        >>> wave = sawtooth_wave(110, 1.0)
        >>> wah = resonant_filter(wave, cutoff=1500, resonance=5.0)
    """
    nyquist = sample_rate / 2.0
    normalized_cutoff = cutoff / nyquist
    normalized_cutoff = min(0.99, max(0.01, normalized_cutoff))

    # Calculate Q factor from resonance (higher Q = more resonance)
    Q = max(0.5, min(resonance, 20.0))

    # Design resonant lowpass (using bandpass for resonance effect)
    b, a = signal.iirfilter(2, normalized_cutoff, btype='low', ftype='butter')

    # Apply multiple passes for resonance effect
    filtered = samples.copy()
    for _ in range(int(resonance)):
        filtered = signal.filtfilt(b, a, filtered)

    return filtered


def simple_reverb(
    samples: NDArray[np.float64],
    delay: float = 0.05,
    decay: float = 0.3
) -> NDArray[np.float64]:
    """
    Apply basic reverb using multiple delayed echoes.

    Creates a sense of space and depth. Simple implementation
    using comb filtering.

    Args:
        samples: Input audio samples
        delay: Delay time in seconds (room size)
        decay: Echo decay factor (0.0-1.0), how long reverb lasts

    Returns:
        Samples with reverb applied

    Example:
        >>> wave = pulse_wave(880, 0.2)
        >>> spacey = simple_reverb(wave, delay=0.08, decay=0.5)
    """
    sample_rate = 22050  # Assumed
    delay_samples = int(delay * sample_rate)

    if delay_samples <= 0 or delay_samples >= len(samples):
        return samples

    # Create output buffer with room for tail
    output = np.zeros(len(samples) + delay_samples * 3)
    output[:len(samples)] = samples

    # Multiple echo taps for richer reverb
    delays = [delay_samples, int(delay_samples * 1.5), int(delay_samples * 2.3)]
    decays = [decay, decay * 0.7, decay * 0.5]

    for d, dec in zip(delays, decays):
        for i in range(d, len(output)):
            output[i] += output[i - d] * dec

    # Trim to original length
    return output[:len(samples)]


def pitch_bend(
    samples: NDArray[np.float64],
    start_pitch: float = 1.0,
    end_pitch: float = 0.5
) -> NDArray[np.float64]:
    """
    Apply pitch sweep (pitch bend) effect.

    Gradually changes pitch from start to end. Creates falling/rising
    tones perfect for explosions, lasers, or sci-fi effects.

    Args:
        samples: Input audio samples
        start_pitch: Starting pitch multiplier (1.0 = original)
        end_pitch: Ending pitch multiplier (0.5 = octave down, 2.0 = octave up)

    Returns:
        Pitch-bent samples

    Example:
        >>> wave = square_wave(440, 0.3)
        >>> falling = pitch_bend(wave, start_pitch=1.5, end_pitch=0.3)
    """
    n = len(samples)

    # Generate pitch curve
    pitch_curve = np.linspace(start_pitch, end_pitch, n)

    # Calculate cumulative phase shift
    phase_shift = np.cumsum(pitch_curve) / pitch_curve.mean()

    # Interpolate samples at new phase positions
    original_indices = np.arange(n)
    new_indices = np.clip(phase_shift, 0, n - 1)

    # Linear interpolation
    bent = np.interp(new_indices, original_indices, samples)

    return bent[:n]  # Ensure same length


def distortion(
    samples: NDArray[np.float64],
    drive: float = 2.0,
    amount: float = None
) -> NDArray[np.float64]:
    """
    Apply soft clipping distortion.

    Adds harmonic richness and aggression through waveform clipping.
    Higher drive creates more distortion.

    Args:
        samples: Input audio samples
        drive: Distortion amount (1.0-10.0), higher = more distortion
        amount: Alias for drive parameter

    Returns:
        Distorted samples

    Example:
        >>> wave = triangle_wave(220, 0.5)
        >>> gritty = distortion(wave, drive=4.0)
    """
    # Support both 'drive' and 'amount' parameter names
    if amount is not None:
        drive = amount

    # Amplify then soft clip
    driven = samples * drive

    # Soft clipping using tanh (smooth saturation)
    distorted = np.tanh(driven)

    # Normalize to prevent excessive volume
    max_val = np.max(np.abs(distorted))
    if max_val > 0:
        distorted = distorted / max_val * 0.9

    return distorted


def ring_modulate(
    samples: NDArray[np.float64],
    mod_freq: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Apply ring modulation effect.

    Multiplies signal with a sine wave, creating metallic, inharmonic
    timbres. Classic vintage effect perfect for robots and aliens.

    Args:
        samples: Input audio samples
        mod_freq: Modulation frequency in Hz
        sample_rate: Sample rate in Hz

    Returns:
        Ring-modulated samples

    Example:
        >>> wave = square_wave(440, 0.4)
        >>> robot = ring_modulate(wave, mod_freq=100)
    """
    n = len(samples)
    t = np.arange(n) / sample_rate

    # Generate modulation oscillator
    modulator = np.sin(2 * np.pi * mod_freq * t)

    # Multiply (ring modulate)
    return samples * modulator


def pitch_sweep(
    samples: NDArray[np.float64],
    start_freq: float,
    end_freq: float,
    duration: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Apply pitch sweep effect (alias for pitch_bend with frequency-based interface).

    Gradually changes pitch from start to end frequency ratio.
    Creates falling/rising tones perfect for lasers and sci-fi effects.

    Args:
        samples: Input audio samples
        start_freq: Starting frequency (used to calculate ratio)
        end_freq: Ending frequency (used to calculate ratio)
        duration: Duration parameter (unused, for API compatibility)
        sample_rate: Sample rate in Hz

    Returns:
        Pitch-swept samples
    """
    # Calculate pitch ratios from frequencies
    if start_freq > 0:
        start_pitch = 1.0
        end_pitch = end_freq / start_freq
    else:
        start_pitch = 1.0
        end_pitch = 0.5

    return pitch_bend(samples, start_pitch, end_pitch)


def phaser(
    samples: NDArray[np.float64],
    rate: float = 2.0,
    depth: float = 1.0,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Apply phaser effect using all-pass filter modulation.

    Creates a sweeping, swooshing sound by modulating phase.
    Classic vintage effect for adding motion and texture.

    Args:
        samples: Input audio samples
        rate: LFO rate in Hz (speed of sweep)
        depth: Effect depth (0.0-1.0)
        sample_rate: Sample rate in Hz

    Returns:
        Phased samples

    Example:
        >>> wave = sawtooth_wave(220, 1.0)
        >>> phased = phaser(wave, rate=0.5, depth=0.8)
    """
    n = len(samples)
    t = np.arange(n) / sample_rate

    # LFO modulates the all-pass filter frequency
    lfo = np.sin(2 * np.pi * rate * t)

    # Map LFO to frequency range (200Hz - 2000Hz)
    min_freq = 200
    max_freq = 2000
    center_freq = (min_freq + max_freq) / 2
    mod_range = (max_freq - min_freq) / 2

    # Create output buffer
    output = np.zeros_like(samples)

    # Simple phaser using comb filtering approach
    for i, freq in enumerate(center_freq + lfo * mod_range * depth):
        delay_samples = int(sample_rate / max(freq, 100))
        if delay_samples > 0 and i >= delay_samples:
            # Mix original with delayed (creates comb filtering / phase cancellation)
            output[i] = samples[i] + samples[i - delay_samples] * 0.7

    # Mix with original
    result = samples * (1 - depth * 0.5) + output * (depth * 0.5)

    # Normalize
    max_val = np.max(np.abs(result))
    if max_val > 0:
        result = result / max_val * 0.9

    return result
