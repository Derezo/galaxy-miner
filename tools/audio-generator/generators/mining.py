"""
Mining sound generator.

Creates 12 mining-related sounds:
- Drill tiers 1-5: Escalating intensity, loopable ~1 second
- Mining complete: Satisfying completion chime
- Cargo warning: Alert beep
- Loot pickup by rarity: 4 sounds (common, uncommon, rare, ultrarare)
"""

import numpy as np

# Core module imports
try:
    from core.oscillators import square_wave, pulse_wave, sawtooth_wave, triangle_wave, noise
    from core.envelopes import adsr_envelope, percussive_envelope
    from core.effects import bitcrush, lowpass_filter, highpass_filter, distortion
    from core.mixer import mix_layers, normalize
    from core.export import export_wav, ensure_output_dir
except ImportError:
    print("Warning: Core modules not found. Using placeholder imports.")
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
    def mix_layers(*signals, weights=None): return signals[0] if signals else np.zeros(44100)
    def normalize(signal, target_db=-3): return signal
    def export_wav(signal, filename, sample_rate=44100): pass
    def ensure_output_dir(path): pass


SAMPLE_RATE = 44100


def generate_drill_sound(tier: int) -> np.ndarray:
    """
    Generate loopable drill sound for mining beam.
    Higher tiers = more powerful, lower frequency, more aggressive.

    Args:
        tier: 1-5, affects power and character
    """
    duration = 1.0  # Loopable 1 second

    # Drill frequency decreases with tier (more powerful = deeper)
    drill_freq = 300 - (tier * 30)  # 270, 240, 210, 180, 150 Hz

    # Main drill tone - sawtooth for cutting feel
    drill = sawtooth_wave(drill_freq, duration, sample_rate=SAMPLE_RATE)

    # Harmonic for complexity
    harmonic = sawtooth_wave(drill_freq * 1.5, duration, sample_rate=SAMPLE_RATE)

    # Drill noise - grinding texture
    grinding = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    grinding = lowpass_filter(grinding, 2000 + tier * 200, sample_rate=SAMPLE_RATE)

    # Low rumble increases with tier
    rumble_strength = 0.1 + (tier * 0.05)
    rumble = square_wave(60 - tier * 5, duration, sample_rate=SAMPLE_RATE)

    # Mix layers - more rumble and noise in higher tiers
    weights = [0.5 - tier * 0.03, 0.2, 0.2 + tier * 0.02, rumble_strength]
    combined = mix_layers(drill, harmonic, grinding, rumble, weights=weights)

    # Distortion increases with tier
    combined = distortion(combined, amount=0.2 + tier * 0.08)

    # Bitcrush for 8-bit character
    combined = bitcrush(combined, bits=5)

    # Ensure loopable - fade in/out at edges for smooth loop
    fade_samples = int(0.01 * SAMPLE_RATE)  # 10ms fade
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)
    combined[:fade_samples] *= fade_in
    combined[-fade_samples:] *= fade_out

    return normalize(combined, target_db=-6)  # Quieter for looping


def generate_mining_complete() -> np.ndarray:
    """
    Mining complete: Satisfying completion chime.
    Positive feedback for successful mining.
    """
    duration = 0.6

    # Rising arpeggio - C major chord (262, 330, 392 Hz)
    notes = [262, 330, 392, 523]  # C4, E4, G4, C5
    note_duration = duration / len(notes)

    arpeggio = np.zeros(int(duration * SAMPLE_RATE))

    for i, freq in enumerate(notes):
        start_pos = int(i * note_duration * SAMPLE_RATE)
        note = triangle_wave(freq, note_duration * 1.2, sample_rate=SAMPLE_RATE)  # Overlap slightly
        note = percussive_envelope(note, attack=0.01, decay=note_duration * 1.2)

        end_pos = min(start_pos + len(note), len(arpeggio))
        arpeggio[start_pos:end_pos] += note[:end_pos - start_pos]

    # Add sparkle
    sparkle = pulse_wave(1046, 0.3, duty=0.5, sample_rate=SAMPLE_RATE)  # C6
    sparkle = percussive_envelope(sparkle, attack=0.005, decay=0.3)
    sparkle_full = np.zeros(len(arpeggio))
    sparkle_pos = int(duration * 0.5 * SAMPLE_RATE)
    end_pos = min(sparkle_pos + len(sparkle), len(sparkle_full))
    sparkle_full[sparkle_pos:end_pos] = sparkle[:end_pos - sparkle_pos]

    # Mix
    combined = mix_layers(arpeggio, sparkle_full, weights=[0.75, 0.25])
    combined = bitcrush(combined, bits=6)

    return normalize(combined)


def generate_cargo_warning() -> np.ndarray:
    """
    Cargo warning: Alert beep when cargo is full.
    Attention-grabbing but not harsh.
    """
    duration = 0.5

    # Two-tone alert beep
    beep1_freq = 800
    beep2_freq = 600

    # First beep
    beep1 = square_wave(beep1_freq, 0.15, sample_rate=SAMPLE_RATE)
    beep1 = percussive_envelope(beep1, attack=0.01, decay=0.15)

    # Second beep
    beep2 = square_wave(beep2_freq, 0.15, sample_rate=SAMPLE_RATE)
    beep2 = percussive_envelope(beep2, attack=0.01, decay=0.15)

    # Combine with gap
    silence = np.zeros(int(0.05 * SAMPLE_RATE))
    combined = np.concatenate([beep1, silence, beep2])

    # Pad to full duration
    if len(combined) < int(duration * SAMPLE_RATE):
        padding = np.zeros(int(duration * SAMPLE_RATE) - len(combined))
        combined = np.concatenate([combined, padding])

    combined = bitcrush(combined, bits=5)

    return normalize(combined, target_db=-6)


def generate_loot_pickup(rarity: str) -> np.ndarray:
    """
    Loot pickup sounds by rarity.
    More elaborate for rarer items.

    Args:
        rarity: 'common', 'uncommon', 'rare', or 'ultrarare'
    """
    rarity_params = {
        'common': {
            'duration': 0.2,
            'base_freq': 400,
            'num_tones': 1,
            'sparkle': False
        },
        'uncommon': {
            'duration': 0.3,
            'base_freq': 500,
            'num_tones': 2,
            'sparkle': False
        },
        'rare': {
            'duration': 0.4,
            'base_freq': 600,
            'num_tones': 3,
            'sparkle': True
        },
        'ultrarare': {
            'duration': 0.6,
            'base_freq': 700,
            'num_tones': 4,
            'sparkle': True
        }
    }

    params = rarity_params[rarity]
    duration = params['duration']
    base_freq = params['base_freq']
    num_tones = params['num_tones']

    # Generate rising tones
    pickup = np.zeros(int(duration * SAMPLE_RATE))
    tone_duration = duration / (num_tones + 1)

    for i in range(num_tones):
        freq = base_freq + (i * 200)
        start_pos = int(i * tone_duration * SAMPLE_RATE)

        tone = triangle_wave(freq, tone_duration * 1.2, sample_rate=SAMPLE_RATE)
        tone = percussive_envelope(tone, attack=0.005, decay=tone_duration * 1.2)

        end_pos = min(start_pos + len(tone), len(pickup))
        pickup[start_pos:end_pos] += tone[:end_pos - start_pos]

    # Add sparkle for rare+ items
    if params['sparkle']:
        sparkle_duration = duration * 0.4
        sparkle = pulse_wave(2000, sparkle_duration, duty=0.3, sample_rate=SAMPLE_RATE)
        sparkle = percussive_envelope(sparkle, attack=0.01, decay=sparkle_duration)

        sparkle_full = np.zeros(len(pickup))
        sparkle_pos = int(duration * 0.4 * SAMPLE_RATE)
        end_pos = min(sparkle_pos + len(sparkle), len(sparkle_full))
        sparkle_full[sparkle_pos:end_pos] = sparkle[:end_pos - sparkle_pos]

        pickup = mix_layers(pickup, sparkle_full, weights=[0.75, 0.25])

    pickup = bitcrush(pickup, bits=6)

    return normalize(pickup)


def generate_all():
    """Generate all 12 mining sounds."""
    print("Generating mining sounds...")

    base_path = "output/mining"
    ensure_output_dir(base_path)

    # Drill tiers 1-5
    for tier in range(1, 6):
        sound = generate_drill_sound(tier)
        filename = f"{base_path}/drill_t{tier}.wav"
        export_wav(sound, filename, SAMPLE_RATE)
        print(f"  Generated: drill_t{tier}.wav")

    # Mining complete
    sound = generate_mining_complete()
    export_wav(sound, f"{base_path}/complete.wav", SAMPLE_RATE)
    print(f"  Generated: complete.wav")

    # Cargo warning
    sound = generate_cargo_warning()
    export_wav(sound, f"{base_path}/cargo_warning.wav", SAMPLE_RATE)
    print(f"  Generated: cargo_warning.wav")

    # Loot pickups by rarity
    rarities = ['common', 'uncommon', 'rare', 'ultrarare']
    for rarity in rarities:
        sound = generate_loot_pickup(rarity)
        filename = f"{base_path}/loot_{rarity}.wav"
        export_wav(sound, filename, SAMPLE_RATE)
        print(f"  Generated: loot_{rarity}.wav")

    print(f"Completed: 12 mining sounds generated in {base_path}/")


if __name__ == "__main__":
    generate_all()
