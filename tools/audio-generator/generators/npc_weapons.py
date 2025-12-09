"""
NPC weapon sound generator.

Creates 15 faction-specific weapon sounds (5 factions × 3 variations).
Each faction has a unique sonic signature matching their AI behavior.
"""

import numpy as np

# Core module imports
try:
    from core.oscillators import square_wave, pulse_wave, sawtooth_wave, triangle_wave, noise
    from core.envelopes import adsr_envelope, percussive_envelope
    from core.effects import bitcrush, lowpass_filter, highpass_filter, distortion, phaser, resonant_filter
    from core.mixer import mix_layers, normalize
    from core.export import export_wav, ensure_output_dir
    import config
    SAMPLE_RATE = config.SAMPLE_RATE
except ImportError:
    print("Warning: Core modules not found. Using placeholder imports.")
    SAMPLE_RATE = 22050
    def square_wave(freq, duration, sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def pulse_wave(freq, duration, duty=0.5, sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def sawtooth_wave(freq, duration, sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def triangle_wave(freq, duration, sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def noise(duration, color='white', sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def adsr_envelope(signal, attack, decay, sustain_level, release): return signal
    def percussive_envelope(signal, attack, decay): return signal
    def bitcrush(signal, bits=8): return signal
    def lowpass_filter(signal, cutoff, sample_rate=22050): return signal
    def highpass_filter(signal, cutoff, sample_rate=22050): return signal
    def distortion(signal, amount=0.5): return signal
    def phaser(signal, rate=2.0, depth=1.0, sample_rate=22050): return signal
    def resonant_filter(signal, freq, resonance=5.0, sample_rate=22050): return signal
    def mix_layers(*signals, weights=None): return signals[0] if signals else np.zeros(22050)
    def normalize(signal, target_db=-3): return signal
    def export_wav(signal, filename, sample_rate=22050): pass
    def ensure_output_dir(path): pass


def generate_pirate_weapon(variation: int) -> np.ndarray:
    """
    Pirate weapons: Aggressive square wave + distortion, 100-800Hz.
    Raw, aggressive, unrefined sound matching flanking AI behavior.
    """
    duration = 0.12 + (variation * 0.02)
    base_freq = 300 + (variation * 250)  # 300, 550, 800Hz

    # Aggressive square wave
    main = square_wave(base_freq, duration, sample_rate=SAMPLE_RATE)

    # Add harmonic for aggression
    harmonic = square_wave(base_freq * 1.5, duration, sample_rate=SAMPLE_RATE)

    # Mix and apply heavy distortion
    combined = mix_layers(main, harmonic, weights=[0.7, 0.3])
    combined = percussive_envelope(combined, attack=0.003, decay=duration)
    combined = distortion(combined, amount=0.6 + variation * 0.1)

    # Aggressive bitcrush
    combined = bitcrush(combined, bits=4)

    return normalize(combined)


def generate_scavenger_weapon(variation: int) -> np.ndarray:
    """
    Scavenger weapons: Unstable pulse, sputtering, 200-1200Hz.
    Erratic and unreliable sound matching retreat AI behavior.
    """
    duration = 0.1 + (variation * 0.015)
    freq = 400 + (variation * 400)  # 400, 800, 1200Hz

    # Unstable pulse with varying duty cycle
    duty = 0.2 + (variation * 0.15)
    sputter = pulse_wave(freq, duration, duty=duty, sample_rate=SAMPLE_RATE)

    # Add random pitch variations (sputtering effect)
    sputter_noise = noise(duration, color='pink', sample_rate=SAMPLE_RATE)
    sputter_noise = highpass_filter(sputter_noise, 1000, sample_rate=SAMPLE_RATE)

    # Erratic envelope
    sputter = percussive_envelope(sputter, attack=0.005, decay=duration)

    # Mix with noise for instability
    combined = mix_layers(sputter, sputter_noise, weights=[0.75, 0.25])

    # Light distortion
    combined = distortion(combined, amount=0.3)
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_swarm_weapon(variation: int) -> np.ndarray:
    """
    Swarm weapons: Brown noise + low pulse, organic 30-200Hz.
    Deep, organic, unsettling sound matching swarm coordination.
    """
    duration = 0.15 + (variation * 0.02)
    low_freq = 50 + (variation * 75)  # 50, 125, 200Hz

    # Deep organic pulse
    pulse = triangle_wave(low_freq, duration, sample_rate=SAMPLE_RATE)

    # Brown noise for organic texture
    organic_noise = noise(duration, color='brown', sample_rate=SAMPLE_RATE)
    organic_noise = lowpass_filter(organic_noise, 300 + variation * 100, sample_rate=SAMPLE_RATE)

    # Sub-bass rumble
    rumble = square_wave(30 + variation * 5, duration, sample_rate=SAMPLE_RATE)

    # Mix layers for organic feel
    combined = mix_layers(pulse, organic_noise, rumble, weights=[0.4, 0.4, 0.2])
    combined = percussive_envelope(combined, attack=0.01, decay=duration)

    # Slight distortion for grit
    combined = distortion(combined, amount=0.2)
    combined = bitcrush(combined, bits=6)

    return normalize(combined)


def generate_void_weapon(variation: int) -> np.ndarray:
    """
    Void weapons: Resonant filter + phase, hollow 80-600Hz.
    Ethereal, otherworldly sound matching formation AI.
    """
    duration = 0.18 + (variation * 0.02)
    center_freq = 200 + (variation * 200)  # 200, 400, 600Hz

    # Hollow sine-like base (using triangle for 8-bit feel)
    base = triangle_wave(center_freq, duration, sample_rate=SAMPLE_RATE)

    # Add resonant filtering for hollow effect
    base = resonant_filter(base, center_freq, resonance=8.0, sample_rate=SAMPLE_RATE)

    # Phaser effect for otherworldly feel
    base = phaser(base, rate=3.0 + variation, depth=0.8, sample_rate=SAMPLE_RATE)

    # Ethereal noise layer
    ethereal = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    ethereal = highpass_filter(ethereal, 4000, sample_rate=SAMPLE_RATE)
    ethereal = lowpass_filter(ethereal, 8000, sample_rate=SAMPLE_RATE)

    # Mix
    combined = mix_layers(base, ethereal, weights=[0.8, 0.2])
    combined = adsr_envelope(combined, attack=0.02, decay=0.05, sustain_level=0.6, release=0.08)

    # Light bitcrush to maintain 8-bit character
    combined = bitcrush(combined, bits=6)

    return normalize(combined)


def generate_rogue_miner_weapon(variation: int) -> np.ndarray:
    """
    Rogue Miner weapons: Sawtooth + noise, industrial 300-2000Hz.
    Harsh, industrial sound matching territorial AI behavior.
    """
    duration = 0.13 + (variation * 0.02)
    freq = 600 + (variation * 700)  # 600, 1300, 2000Hz

    # Industrial sawtooth
    industrial = sawtooth_wave(freq, duration, sample_rate=SAMPLE_RATE)

    # Harsh noise component
    harsh_noise = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    harsh_noise = highpass_filter(harsh_noise, 2000, sample_rate=SAMPLE_RATE)

    # Lower harmonic for depth
    low_harmonic = sawtooth_wave(freq * 0.5, duration, sample_rate=SAMPLE_RATE)

    # Mix layers
    combined = mix_layers(industrial, harsh_noise, low_harmonic, weights=[0.5, 0.3, 0.2])
    combined = percussive_envelope(combined, attack=0.004, decay=duration)

    # Industrial distortion
    combined = distortion(combined, amount=0.4 + variation * 0.1)
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_all():
    """Generate all 15 NPC faction weapon sounds."""
    print("Generating NPC faction weapon sounds...")

    base_path = "output/weapons"
    ensure_output_dir(base_path)

    factions = [
        ('pirate', generate_pirate_weapon),
        ('scavenger', generate_scavenger_weapon),
        ('swarm', generate_swarm_weapon),
        ('void', generate_void_weapon),
        ('rogue_miner', generate_rogue_miner_weapon)
    ]

    for faction_name, generator_func in factions:
        for var in range(1, 4):
            sound = generator_func(var - 1)
            filename = f"{base_path}/weapon_{faction_name}_{var:02d}.wav"
            export_wav(sound, filename, SAMPLE_RATE)
            print(f"  Generated: weapon_{faction_name}_{var:02d}.wav")

    print(f"Completed: 15 NPC faction weapon sounds generated in {base_path}/")


if __name__ == "__main__":
    generate_all()
