"""
Basic waveform generators for 8-bit audio synthesis.

This module provides fundamental oscillator functions that generate
raw audio waveforms. All functions return numpy arrays of samples
in the range [-1.0, 1.0].
"""

import numpy as np
from numpy.typing import NDArray


def square_wave(
    freq: float,
    duration: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Generate a classic 8-bit square wave.

    Square waves produce a harsh, hollow sound characteristic of early
    video game audio. They contain only odd harmonics.

    Args:
        freq: Frequency in Hz
        duration: Duration in seconds
        sample_rate: Sample rate in Hz

    Returns:
        numpy array of samples in range [-1.0, 1.0]

    Example:
        >>> wave = square_wave(440.0, 0.5)  # A4 for 0.5 seconds
    """
    num_samples = int(duration * sample_rate)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    return np.sign(np.sin(2 * np.pi * freq * t))


def pulse_wave(
    freq: float,
    duration: float,
    duty_cycle: float = 0.5,
    duty: float = None,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Generate a pulse wave with variable pulse width.

    Pulse waves allow timbral variation by adjusting the duty cycle.
    duty_cycle=0.5 produces a square wave, lower values create thinner sounds.

    Args:
        freq: Frequency in Hz
        duration: Duration in seconds
        duty_cycle: Pulse width ratio (0.0-1.0), default 0.5 for square wave
        duty: Alias for duty_cycle
        sample_rate: Sample rate in Hz

    Returns:
        numpy array of samples in range [-1.0, 1.0]

    Example:
        >>> wave = pulse_wave(220.0, 0.3, duty_cycle=0.25)  # Thin pulse
    """
    # Support both 'duty' and 'duty_cycle' parameter names
    if duty is not None:
        duty_cycle = duty
    duty_cycle = np.clip(duty_cycle, 0.01, 0.99)  # Prevent edge cases
    num_samples = int(duration * sample_rate)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    phase = (freq * t) % 1.0
    return np.where(phase < duty_cycle, 1.0, -1.0)


def triangle_wave(
    freq: float,
    duration: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Generate a triangle wave.

    Triangle waves produce a softer, more mellow sound than square waves.
    They contain only odd harmonics with rapidly decreasing amplitudes.

    Args:
        freq: Frequency in Hz
        duration: Duration in seconds
        sample_rate: Sample rate in Hz

    Returns:
        numpy array of samples in range [-1.0, 1.0]

    Example:
        >>> wave = triangle_wave(880.0, 0.2)  # A5 for 0.2 seconds
    """
    num_samples = int(duration * sample_rate)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    phase = (freq * t) % 1.0
    return 2.0 * np.abs(2.0 * (phase - 0.5)) - 1.0


def sawtooth_wave(
    freq: float,
    duration: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Generate a harsh sawtooth wave.

    Sawtooth waves contain all harmonics (odd and even) and produce
    a bright, buzzy sound. Common in bass and lead sounds.

    Args:
        freq: Frequency in Hz
        duration: Duration in seconds
        sample_rate: Sample rate in Hz

    Returns:
        numpy array of samples in range [-1.0, 1.0]

    Example:
        >>> wave = sawtooth_wave(110.0, 0.4)  # A2 bass note
    """
    num_samples = int(duration * sample_rate)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    phase = (freq * t) % 1.0
    return 2.0 * phase - 1.0


def sine_wave(
    freq: float,
    duration: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Generate a pure sine wave.

    Sine waves contain only the fundamental frequency with no harmonics.
    Produces a clean, pure tone. Useful for sub-bass and modulation.

    Args:
        freq: Frequency in Hz
        duration: Duration in seconds
        sample_rate: Sample rate in Hz

    Returns:
        numpy array of samples in range [-1.0, 1.0]

    Example:
        >>> wave = sine_wave(440.0, 1.0)  # A4 pure tone
    """
    num_samples = int(duration * sample_rate)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    return np.sin(2 * np.pi * freq * t)


def white_noise(
    duration: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Generate white noise.

    White noise contains equal energy at all frequencies. Useful for
    percussion, explosions, and texture.

    Args:
        duration: Duration in seconds
        sample_rate: Sample rate in Hz

    Returns:
        numpy array of samples in range [-1.0, 1.0]

    Example:
        >>> noise = white_noise(0.1)  # Short noise burst
    """
    num_samples = int(duration * sample_rate)
    return np.random.uniform(-1.0, 1.0, num_samples)


def brown_noise(
    duration: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Generate brown noise (Brownian noise).

    Brown noise has more energy at lower frequencies than white noise,
    producing a deep rumbling sound. Perfect for the Swarm faction's
    ominous presence or engine rumbles.

    Args:
        duration: Duration in seconds
        sample_rate: Sample rate in Hz

    Returns:
        numpy array of samples in range [-1.0, 1.0]

    Example:
        >>> rumble = brown_noise(0.5)  # Deep rumble
    """
    num_samples = int(duration * sample_rate)
    white = np.random.randn(num_samples)

    # Brown noise is cumulative sum of white noise
    brown = np.cumsum(white)

    # Normalize to [-1.0, 1.0] range
    brown = brown - np.mean(brown)  # Remove DC offset
    max_val = np.max(np.abs(brown))
    if max_val > 0:
        brown = brown / max_val

    return brown


def pink_noise(
    duration: float,
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Generate pink noise (1/f noise).

    Pink noise has equal energy per octave, sounding more natural
    and less harsh than white noise. Good for engine rumbles and
    ambient textures.

    Args:
        duration: Duration in seconds
        sample_rate: Sample rate in Hz

    Returns:
        numpy array of samples in range [-1.0, 1.0]

    Example:
        >>> rumble = pink_noise(0.5)  # Engine texture
    """
    num_samples = int(duration * sample_rate)

    # Generate white noise
    white = np.random.randn(num_samples)

    # Apply 1/f filter using Voss-McCartney algorithm approximation
    # Use multiple rows of random values with different update rates
    num_rows = 16
    pink = np.zeros(num_samples)

    rows = np.zeros(num_rows)
    running_sum = 0.0

    for i in range(num_samples):
        # Determine which rows to update
        for j in range(num_rows):
            if i % (2 ** j) == 0:
                running_sum -= rows[j]
                rows[j] = np.random.randn()
                running_sum += rows[j]

        pink[i] = running_sum + np.random.randn()

    # Normalize to [-1.0, 1.0]
    pink = pink - np.mean(pink)
    max_val = np.max(np.abs(pink))
    if max_val > 0:
        pink = pink / max_val

    return pink


def noise(
    duration: float,
    color: str = 'white',
    sample_rate: int = 22050
) -> NDArray[np.float64]:
    """
    Generate noise with specified color.

    Convenience wrapper that selects between noise types
    based on the color parameter.

    Args:
        duration: Duration in seconds
        color: Type of noise - 'white', 'brown', or 'pink'
        sample_rate: Sample rate in Hz

    Returns:
        numpy array of samples in range [-1.0, 1.0]

    Example:
        >>> n = noise(0.5, color='brown')  # Deep rumble
        >>> n = noise(0.5, color='pink')   # Engine texture
    """
    if color == 'brown':
        return brown_noise(duration, sample_rate)
    elif color == 'pink':
        return pink_noise(duration, sample_rate)
    else:
        return white_noise(duration, sample_rate)
