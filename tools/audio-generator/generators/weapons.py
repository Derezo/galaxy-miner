"""
Player weapon sound generator.

Creates 20 weapon sounds across 5 tiers with variations.
Each tier has a distinct character that reflects upgrade progression.
"""

import numpy as np
from typing import Tuple

# Core module imports (will be available when core is created)
try:
    from core.oscillators import square_wave, pulse_wave, sawtooth_wave, triangle_wave, noise
    from core.envelopes import adsr_envelope, percussive_envelope
    from core.effects import bitcrush, lowpass_filter, highpass_filter, distortion, pitch_sweep
    from core.mixer import mix_layers, normalize
    from core.export import export_wav, ensure_output_dir
except ImportError:
    print("Warning: Core modules not found. Using placeholder imports.")
    # Placeholder functions for testing
    def square_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def pulse_wave(freq, duration, duty=0.5, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def sawtooth_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def triangle_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def noise(duration, color='white', sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def adsr_envelope(signal, attack, decay, sustain_level, release): return signal
    def percussive_envelope(signal, attack, decay): return signal
    def bitcrush(signal, bits=8): return signal
    def lowpass_filter(signal, cutoff, sample_rate=44100): return signal
    def highpass_filter(signal, cutoff, sample_rate=44100): return signal
    def distortion(signal, amount=0.5): return signal
    def pitch_sweep(signal, start_freq, end_freq, duration, sample_rate=44100): return signal
    def mix_layers(*signals, weights=None): return signals[0] if signals else np.zeros(44100)
    def normalize(signal, target_db=-3): return signal
    def export_wav(signal, filename, sample_rate=44100): pass
    def ensure_output_dir(path): pass


SAMPLE_RATE = 44100


def generate_tier1_burst_laser(variation: int) -> np.ndarray:
    """
    Tier 1 Burst Laser: Short pulse wave bursts, 800-1200Hz.
    Classic 8-bit pew sound with slight variations.
    """
    duration = 0.08 + (variation * 0.01)  # 80-100ms
    base_freq = 800 + (variation * 200)  # 800, 1000, 1200Hz

    # Short pulse wave burst
    burst = pulse_wave(base_freq, duration, duty=0.3, sample_rate=SAMPLE_RATE)

    # Quick decay envelope
    burst = percussive_envelope(burst, attack=0.002, decay=duration)

    # Light bitcrush for retro feel
    burst = bitcrush(burst, bits=6)

    return normalize(burst)


def generate_tier2_dual_laser(variation: int) -> np.ndarray:
    """
    Tier 2 Dual Laser: Double pulse with slight delay.
    Two quick shots in succession.
    """
    duration = 0.12
    base_freq = 900 + (variation * 150)
    delay = 0.03 + (variation * 0.01)  # 30-50ms delay

    # First shot
    shot1 = pulse_wave(base_freq, 0.06, duty=0.25, sample_rate=SAMPLE_RATE)
    shot1 = percussive_envelope(shot1, attack=0.002, decay=0.06)

    # Second shot (slightly higher pitch)
    shot2 = pulse_wave(base_freq * 1.1, 0.06, duty=0.25, sample_rate=SAMPLE_RATE)
    shot2 = percussive_envelope(shot2, attack=0.002, decay=0.06)

    # Combine with delay
    silence = np.zeros(int(delay * SAMPLE_RATE))
    combined = np.concatenate([shot1, silence, shot2])

    combined = bitcrush(combined, bits=6)

    return normalize(combined)


def generate_tier3_pulse_cannon(variation: int) -> np.ndarray:
    """
    Tier 3 Pulse Cannon: Chunky square wave with bass.
    More powerful, lower frequency component.
    """
    duration = 0.15
    high_freq = 600 + (variation * 100)
    low_freq = 120 + (variation * 20)

    # High frequency square wave
    high = square_wave(high_freq, duration, sample_rate=SAMPLE_RATE)
    high = percussive_envelope(high, attack=0.005, decay=duration)

    # Low frequency bass thump
    bass = square_wave(low_freq, duration * 0.6, sample_rate=SAMPLE_RATE)
    bass = percussive_envelope(bass, attack=0.002, decay=duration * 0.6)

    # Mix layers
    combined = mix_layers(high, bass, weights=[0.6, 0.4])

    # Add some distortion for punch
    combined = distortion(combined, amount=0.3 + variation * 0.1)
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_tier4_beam_weapon(variation: int) -> np.ndarray:
    """
    Tier 4 Beam Weapon: Sustained with pitch sweep.
    Longer duration, sweeping frequency for beam effect.
    """
    duration = 0.25 + (variation * 0.05)
    start_freq = 400 + (variation * 100)
    end_freq = start_freq * 0.6  # Sweep down

    # Triangle wave for smoother beam sound
    beam = triangle_wave(start_freq, duration, sample_rate=SAMPLE_RATE)

    # Apply pitch sweep
    beam = pitch_sweep(beam, start_freq, end_freq, duration, sample_rate=SAMPLE_RATE)

    # ADSR envelope for sustained beam
    beam = adsr_envelope(beam, attack=0.01, decay=0.05, sustain_level=0.7, release=0.1)

    # Add noise layer for texture
    beam_noise = noise(duration, color='pink', sample_rate=SAMPLE_RATE)
    beam_noise = highpass_filter(beam_noise, 2000, sample_rate=SAMPLE_RATE)

    combined = mix_layers(beam, beam_noise, weights=[0.85, 0.15])
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_tier5_tesla_cannon(variation: int) -> np.ndarray:
    """
    Tier 5 Tesla Cannon: Electrical crackle + chain lightning arcs.
    Most complex weapon sound with multiple layers.
    """
    duration = 0.3 + (variation * 0.05)

    # Main arc - sweeping sawtooth
    arc_start = 800 + (variation * 200)
    arc_end = arc_start * 1.5
    arc = sawtooth_wave(arc_start, duration, sample_rate=SAMPLE_RATE)
    arc = pitch_sweep(arc, arc_start, arc_end, duration, sample_rate=SAMPLE_RATE)
    arc = adsr_envelope(arc, attack=0.005, decay=0.08, sustain_level=0.6, release=0.15)

    # Electrical crackle - filtered white noise
    crackle = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    crackle = highpass_filter(crackle, 3000 + variation * 500, sample_rate=SAMPLE_RATE)
    crackle = percussive_envelope(crackle, attack=0.001, decay=duration)

    # Low rumble for power
    rumble = square_wave(60 + variation * 10, duration * 0.5, sample_rate=SAMPLE_RATE)
    rumble = percussive_envelope(rumble, attack=0.01, decay=duration * 0.5)

    # Chain lightning pops - short bursts
    num_pops = 3 + variation
    pops = np.zeros(int(duration * SAMPLE_RATE))
    for i in range(num_pops):
        pop_pos = int((i / num_pops) * len(pops))
        pop_freq = 1200 + np.random.randint(-200, 200)
        pop = pulse_wave(pop_freq, 0.02, duty=0.2, sample_rate=SAMPLE_RATE)
        pop = percussive_envelope(pop, attack=0.001, decay=0.02)
        end_pos = min(pop_pos + len(pop), len(pops))
        pops[pop_pos:end_pos] += pop[:end_pos - pop_pos]

    # Mix all layers
    combined = mix_layers(arc, crackle, rumble, pops, weights=[0.4, 0.3, 0.2, 0.1])

    # Heavy distortion and bitcrush
    combined = distortion(combined, amount=0.5)
    combined = bitcrush(combined, bits=4)

    return normalize(combined)


def generate_all():
    """Generate all 20 player weapon sounds."""
    print("Generating player weapon sounds...")

    base_path = "output/weapons"
    ensure_output_dir(base_path)

    # Tier 1: Burst Laser (3 variations)
    for var in range(1, 4):
        sound = generate_tier1_burst_laser(var - 1)
        export_wav(sound, f"{base_path}/weapon_player_t1_{var:02d}.wav", SAMPLE_RATE)
        print(f"  Generated: weapon_player_t1_{var:02d}.wav")

    # Tier 2: Dual Laser (3 variations)
    for var in range(1, 4):
        sound = generate_tier2_dual_laser(var - 1)
        export_wav(sound, f"{base_path}/weapon_player_t2_{var:02d}.wav", SAMPLE_RATE)
        print(f"  Generated: weapon_player_t2_{var:02d}.wav")

    # Tier 3: Pulse Cannon (3 variations)
    for var in range(1, 4):
        sound = generate_tier3_pulse_cannon(var - 1)
        export_wav(sound, f"{base_path}/weapon_player_t3_{var:02d}.wav", SAMPLE_RATE)
        print(f"  Generated: weapon_player_t3_{var:02d}.wav")

    # Tier 4: Beam Weapon (3 variations)
    for var in range(1, 4):
        sound = generate_tier4_beam_weapon(var - 1)
        export_wav(sound, f"{base_path}/weapon_player_t4_{var:02d}.wav", SAMPLE_RATE)
        print(f"  Generated: weapon_player_t4_{var:02d}.wav")

    # Tier 5: Tesla Cannon (5 variations)
    for var in range(1, 6):
        sound = generate_tier5_tesla_cannon(var - 1)
        export_wav(sound, f"{base_path}/weapon_player_t5_{var:02d}.wav", SAMPLE_RATE)
        print(f"  Generated: weapon_player_t5_{var:02d}.wav")

    print(f"Completed: 20 player weapon sounds generated in {base_path}/")


if __name__ == "__main__":
    generate_all()
