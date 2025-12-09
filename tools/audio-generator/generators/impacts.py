"""
Impact sound generator.

Creates 30 hit sounds (shield/hull × 5 tiers × 3 variations).
Tier scales impact intensity (duration, pitch, volume).
"""

import numpy as np

# Core module imports
try:
    from core.oscillators import square_wave, pulse_wave, noise, triangle_wave
    from core.envelopes import percussive_envelope
    from core.effects import bitcrush, lowpass_filter, highpass_filter, distortion
    from core.mixer import mix_layers, normalize
    from core.export import export_wav, ensure_output_dir
except ImportError:
    print("Warning: Core modules not found. Using placeholder imports.")
    def square_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def pulse_wave(freq, duration, duty=0.5, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def noise(duration, color='white', sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def triangle_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def percussive_envelope(signal, attack, decay): return signal
    def bitcrush(signal, bits=8): return signal
    def lowpass_filter(signal, cutoff, sample_rate=44100): return signal
    def highpass_filter(signal, cutoff, sample_rate=44100): return signal
    def distortion(signal, amount=0.5): return signal
    def mix_layers(*signals, weights=None): return signals[0] if signals else np.zeros(44100)
    def normalize(signal, target_db=-3): return signal
    def export_wav(signal, filename, sample_rate=44100): pass
    def ensure_output_dir(path): pass


SAMPLE_RATE = 44100


def generate_shield_hit(tier: int, variation: int) -> np.ndarray:
    """
    Shield hit: High frequency ping, bitcrushed.
    Higher tiers have more resonance and longer decay.

    Args:
        tier: 1-5, affects intensity and duration
        variation: 0-2, provides sonic variety
    """
    # Scale parameters by tier
    duration = 0.08 + (tier * 0.02) + (variation * 0.01)
    base_freq = 1200 + (tier * 400) + (variation * 200)  # Higher pitch for shields

    # High frequency ping - triangle wave for shield energy
    ping = triangle_wave(base_freq, duration, sample_rate=SAMPLE_RATE)

    # Add harmonic for resonance (more prominent in higher tiers)
    harmonic_strength = 0.2 + (tier * 0.08)
    harmonic = triangle_wave(base_freq * 2, duration, sample_rate=SAMPLE_RATE)

    # Electric crackle - filtered noise
    crackle = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    crackle = highpass_filter(crackle, 3000 + tier * 500, sample_rate=SAMPLE_RATE)

    # Mix layers
    combined = mix_layers(ping, harmonic, crackle,
                         weights=[0.6, harmonic_strength, 0.2])

    # Sharp attack, medium decay
    decay_time = duration * 0.8
    combined = percussive_envelope(combined, attack=0.001, decay=decay_time)

    # Bitcrush intensity decreases with tier (lower tiers = more crushed)
    bits = 4 + tier  # 5-9 bits
    combined = bitcrush(combined, bits=bits)

    return normalize(combined)


def generate_hull_hit(tier: int, variation: int) -> np.ndarray:
    """
    Hull hit: Low thud, distorted.
    Higher tiers have deeper impact and more distortion.

    Args:
        tier: 1-5, affects intensity and bass
        variation: 0-2, provides sonic variety
    """
    # Scale parameters by tier
    duration = 0.1 + (tier * 0.03) + (variation * 0.015)

    # Lower frequencies for hull impacts
    high_freq = 300 - (tier * 20) + (variation * 50)  # Metal impact
    low_freq = 80 - (tier * 5) + (variation * 10)     # Bass thud

    # High frequency metal impact
    impact = square_wave(high_freq, duration * 0.6, sample_rate=SAMPLE_RATE)
    impact = percussive_envelope(impact, attack=0.002, decay=duration * 0.6)

    # Low frequency thud
    thud = square_wave(low_freq, duration, sample_rate=SAMPLE_RATE)
    thud = percussive_envelope(thud, attack=0.005, decay=duration)

    # Impact noise - debris/crunch
    debris = noise(duration * 0.5, color='white', sample_rate=SAMPLE_RATE)
    debris = lowpass_filter(debris, 2000 - tier * 200, sample_rate=SAMPLE_RATE)
    debris = percussive_envelope(debris, attack=0.001, decay=duration * 0.5)

    # Mix layers - more bass in higher tiers
    bass_weight = 0.3 + (tier * 0.08)
    combined = mix_layers(impact, thud, debris,
                         weights=[0.5, bass_weight, 0.2])

    # Distortion increases with tier
    distortion_amount = 0.3 + (tier * 0.1)
    combined = distortion(combined, amount=distortion_amount)

    # Heavy bitcrush for metallic feel
    combined = bitcrush(combined, bits=4)

    return normalize(combined)


def generate_all():
    """Generate all 30 impact sounds (shield + hull × 5 tiers × 3 variations)."""
    print("Generating impact sounds...")

    base_path = "output/impacts"
    ensure_output_dir(base_path)

    # Generate shield hits
    for tier in range(1, 6):
        for var in range(1, 4):
            sound = generate_shield_hit(tier, var - 1)
            filename = f"{base_path}/hit_shield_t{tier}_{var:02d}.wav"
            export_wav(sound, filename, SAMPLE_RATE)
            print(f"  Generated: hit_shield_t{tier}_{var:02d}.wav")

    # Generate hull hits
    for tier in range(1, 6):
        for var in range(1, 4):
            sound = generate_hull_hit(tier, var - 1)
            filename = f"{base_path}/hit_hull_t{tier}_{var:02d}.wav"
            export_wav(sound, filename, SAMPLE_RATE)
            print(f"  Generated: hit_hull_t{tier}_{var:02d}.wav")

    print(f"Completed: 30 impact sounds generated in {base_path}/")


if __name__ == "__main__":
    generate_all()
