"""
Destruction/explosion sound generator.

Creates 25 sounds:
- Per faction: 5 factions × 3 sizes (small/medium/large)
- Player death: 1 dramatic multi-layered explosion

Each faction has unique death characteristics matching their identity.
"""

import numpy as np

# Core module imports
try:
    from core.oscillators import square_wave, sawtooth_wave, triangle_wave, noise, pulse_wave
    from core.envelopes import adsr_envelope, percussive_envelope
    from core.effects import bitcrush, lowpass_filter, highpass_filter, distortion, pitch_sweep
    from core.mixer import mix_layers, normalize
    from core.export import export_wav, ensure_output_dir
except ImportError:
    print("Warning: Core modules not found. Using placeholder imports.")
    def square_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def sawtooth_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def triangle_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def noise(duration, color='white', sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def pulse_wave(freq, duration, duty=0.5, sample_rate=44100): return np.zeros(int(duration * sample_rate))
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


def generate_pirate_death(size: str) -> np.ndarray:
    """
    Pirate death: Metallic explosion + debris.
    Sharp, violent, with metallic ringing.
    """
    size_multiplier = {'small': 0.7, 'medium': 1.0, 'large': 1.5}[size]
    duration = 0.6 * size_multiplier

    # Initial explosion burst - descending frequency
    explosion_start = 600 * size_multiplier
    explosion_end = 100
    explosion = square_wave(explosion_start, duration * 0.4, sample_rate=SAMPLE_RATE)
    explosion = pitch_sweep(explosion, explosion_start, explosion_end, duration * 0.4, sample_rate=SAMPLE_RATE)
    explosion = percussive_envelope(explosion, attack=0.001, decay=duration * 0.4)

    # Metallic debris - harsh noise with metal resonance
    debris = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    debris = highpass_filter(debris, 1000, sample_rate=SAMPLE_RATE)
    debris = percussive_envelope(debris, attack=0.01, decay=duration)

    # Low rumble
    rumble = square_wave(50, duration * 0.7, sample_rate=SAMPLE_RATE)
    rumble = percussive_envelope(rumble, attack=0.02, decay=duration * 0.7)

    # Mix layers
    combined = mix_layers(explosion, debris, rumble, weights=[0.5, 0.3, 0.2])
    combined = distortion(combined, amount=0.6)
    combined = bitcrush(combined, bits=4)

    return normalize(combined)


def generate_scavenger_death(size: str) -> np.ndarray:
    """
    Scavenger death: Sputtering break-apart.
    Multiple small pops and crackles as ship falls apart.
    """
    size_multiplier = {'small': 0.6, 'medium': 1.0, 'large': 1.4}[size]
    duration = 0.7 * size_multiplier

    # Sputtering breakdown - random frequency bursts
    num_pops = int(8 * size_multiplier)
    breakdown = np.zeros(int(duration * SAMPLE_RATE))

    for i in range(num_pops):
        pop_time = (i / num_pops) * duration * 0.8
        pop_pos = int(pop_time * SAMPLE_RATE)
        pop_freq = np.random.randint(200, 1000)
        pop_duration = 0.05 + np.random.random() * 0.05

        pop = pulse_wave(pop_freq, pop_duration, duty=0.3, sample_rate=SAMPLE_RATE)
        pop = percussive_envelope(pop, attack=0.002, decay=pop_duration)

        end_pos = min(pop_pos + len(pop), len(breakdown))
        breakdown[pop_pos:end_pos] += pop[:end_pos - pop_pos] * (1 - i / num_pops)  # Fade out

    # Crackle layer
    crackle = noise(duration, color='pink', sample_rate=SAMPLE_RATE)
    crackle = highpass_filter(crackle, 2000, sample_rate=SAMPLE_RATE)
    crackle = percussive_envelope(crackle, attack=0.01, decay=duration)

    # Final collapse
    collapse = square_wave(80, duration * 0.3, sample_rate=SAMPLE_RATE)
    collapse_pos = int(duration * 0.7 * SAMPLE_RATE)
    collapse = percussive_envelope(collapse, attack=0.05, decay=duration * 0.3)

    # Add collapse at the end
    collapse_full = np.zeros(len(breakdown))
    end_pos = min(collapse_pos + len(collapse), len(collapse_full))
    collapse_full[collapse_pos:end_pos] = collapse[:end_pos - collapse_pos]

    # Mix
    combined = mix_layers(breakdown, crackle, collapse_full, weights=[0.5, 0.3, 0.2])
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_swarm_death(size: str) -> np.ndarray:
    """
    Swarm death: Organic squelch + dissolve.
    Wet, organic disintegration sound.
    """
    size_multiplier = {'small': 0.7, 'medium': 1.0, 'large': 1.6}[size]
    duration = 0.8 * size_multiplier

    # Organic squelch - low frequency with noise
    squelch_freq = 60 * size_multiplier
    squelch = triangle_wave(squelch_freq, duration * 0.4, sample_rate=SAMPLE_RATE)
    squelch = pitch_sweep(squelch, squelch_freq, squelch_freq * 0.5, duration * 0.4, sample_rate=SAMPLE_RATE)
    squelch = percussive_envelope(squelch, attack=0.02, decay=duration * 0.4)

    # Organic texture - brown noise (very low frequency)
    organic = noise(duration, color='brown', sample_rate=SAMPLE_RATE)
    organic = lowpass_filter(organic, 300 * size_multiplier, sample_rate=SAMPLE_RATE)
    organic = percussive_envelope(organic, attack=0.03, decay=duration)

    # Dissolve hiss
    dissolve = noise(duration * 0.6, color='white', sample_rate=SAMPLE_RATE)
    dissolve = highpass_filter(dissolve, 4000, sample_rate=SAMPLE_RATE)
    dissolve_full = np.zeros(int(duration * SAMPLE_RATE))
    dissolve_start = int(duration * 0.3 * SAMPLE_RATE)
    end_pos = min(dissolve_start + len(dissolve), len(dissolve_full))
    dissolve_full[dissolve_start:end_pos] = dissolve[:end_pos - dissolve_start]

    # Mix
    combined = mix_layers(squelch, organic, dissolve_full, weights=[0.4, 0.4, 0.2])
    combined = distortion(combined, amount=0.3)
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_void_death(size: str) -> np.ndarray:
    """
    Void death: Implosion + ethereal release.
    Inward collapse followed by otherworldly dissipation.
    """
    size_multiplier = {'small': 0.8, 'medium': 1.0, 'large': 1.5}[size]
    duration = 0.9 * size_multiplier

    # Implosion - rising frequency into singularity
    implosion_start = 100 * size_multiplier
    implosion_end = 2000 * size_multiplier
    implosion = triangle_wave(implosion_start, duration * 0.3, sample_rate=SAMPLE_RATE)
    implosion = pitch_sweep(implosion, implosion_start, implosion_end, duration * 0.3, sample_rate=SAMPLE_RATE)
    implosion = percussive_envelope(implosion, attack=0.05, decay=duration * 0.3)

    # Void pop at singularity
    pop = pulse_wave(1500, 0.05, duty=0.5, sample_rate=SAMPLE_RATE)
    pop = percussive_envelope(pop, attack=0.001, decay=0.05)
    pop_full = np.zeros(int(duration * SAMPLE_RATE))
    pop_pos = int(duration * 0.3 * SAMPLE_RATE)
    end_pos = min(pop_pos + len(pop), len(pop_full))
    pop_full[pop_pos:end_pos] = pop[:end_pos - pop_pos]

    # Ethereal release - high frequency dissipation
    release = noise(duration * 0.6, color='white', sample_rate=SAMPLE_RATE)
    release = highpass_filter(release, 5000, sample_rate=SAMPLE_RATE)
    release = lowpass_filter(release, 10000, sample_rate=SAMPLE_RATE)
    release_full = np.zeros(int(duration * SAMPLE_RATE))
    release_start = int(duration * 0.35 * SAMPLE_RATE)
    end_pos = min(release_start + len(release), len(release_full))
    release_full[release_start:end_pos] = release[:end_pos - release_start]
    release_full = percussive_envelope(release_full, attack=0.1, decay=duration * 0.6)

    # Mix
    combined = mix_layers(implosion, pop_full, release_full, weights=[0.5, 0.2, 0.3])
    combined = bitcrush(combined, bits=6)

    return normalize(combined)


def generate_rogue_miner_death(size: str) -> np.ndarray:
    """
    Rogue Miner death: Industrial explosion + grinding.
    Heavy machinery breaking down with metal grinding.
    """
    size_multiplier = {'small': 0.7, 'medium': 1.0, 'large': 1.4}[size]
    duration = 0.7 * size_multiplier

    # Industrial explosion - harsh sawtooth
    explosion = sawtooth_wave(400 * size_multiplier, duration * 0.4, sample_rate=SAMPLE_RATE)
    explosion = pitch_sweep(explosion, 400 * size_multiplier, 80, duration * 0.4, sample_rate=SAMPLE_RATE)
    explosion = percussive_envelope(explosion, attack=0.002, decay=duration * 0.4)

    # Grinding metal - modulated noise
    grinding = noise(duration * 0.6, color='white', sample_rate=SAMPLE_RATE)
    grinding = lowpass_filter(grinding, 2000, sample_rate=SAMPLE_RATE)
    grinding_full = np.zeros(int(duration * SAMPLE_RATE))
    grinding_start = int(duration * 0.2 * SAMPLE_RATE)
    end_pos = min(grinding_start + len(grinding), len(grinding_full))
    grinding_full[grinding_start:end_pos] = grinding[:end_pos - grinding_start]

    # Heavy bass thud
    thud = square_wave(60, duration * 0.5, sample_rate=SAMPLE_RATE)
    thud = percussive_envelope(thud, attack=0.01, decay=duration * 0.5)

    # Mix
    combined = mix_layers(explosion, grinding_full, thud, weights=[0.45, 0.35, 0.2])
    combined = distortion(combined, amount=0.5)
    combined = bitcrush(combined, bits=4)

    return normalize(combined)


def generate_player_death() -> np.ndarray:
    """
    Player death: Dramatic multi-layered explosion.
    Most impactful death sound - the player's ship exploding.
    """
    duration = 1.2

    # Primary explosion - powerful descending sweep
    explosion = square_wave(800, 0.5, sample_rate=SAMPLE_RATE)
    explosion = pitch_sweep(explosion, 800, 60, 0.5, sample_rate=SAMPLE_RATE)
    explosion = percussive_envelope(explosion, attack=0.001, decay=0.5)

    # Secondary explosions - cascade
    secondary = np.zeros(int(duration * SAMPLE_RATE))
    for i, time_offset in enumerate([0.15, 0.25, 0.35]):
        pos = int(time_offset * SAMPLE_RATE)
        mini_exp = square_wave(400 - i * 100, 0.2, sample_rate=SAMPLE_RATE)
        mini_exp = percussive_envelope(mini_exp, attack=0.002, decay=0.2)
        end_pos = min(pos + len(mini_exp), len(secondary))
        secondary[pos:end_pos] += mini_exp[:end_pos - pos] * 0.6

    # Debris field - long tail
    debris = noise(duration * 0.8, color='white', sample_rate=SAMPLE_RATE)
    debris = lowpass_filter(debris, 3000, sample_rate=SAMPLE_RATE)
    debris_full = np.zeros(int(duration * SAMPLE_RATE))
    debris_start = int(0.3 * SAMPLE_RATE)
    end_pos = min(debris_start + len(debris), len(debris_full))
    debris_full[debris_start:end_pos] = debris[:end_pos - debris_start]
    debris_full = percussive_envelope(debris_full, attack=0.1, decay=duration * 0.8)

    # Deep bass rumble
    rumble = square_wave(40, duration * 0.7, sample_rate=SAMPLE_RATE)
    rumble = percussive_envelope(rumble, attack=0.05, decay=duration * 0.7)

    # Mix all layers
    combined = mix_layers(explosion, secondary, debris_full, rumble,
                         weights=[0.4, 0.25, 0.2, 0.15])

    # Heavy processing
    combined = distortion(combined, amount=0.7)
    combined = bitcrush(combined, bits=4)

    return normalize(combined)


def generate_all():
    """Generate all 25 destruction sounds."""
    print("Generating destruction sounds...")

    base_path = "output/destruction"
    ensure_output_dir(base_path)

    factions = [
        ('pirate', generate_pirate_death),
        ('scavenger', generate_scavenger_death),
        ('swarm', generate_swarm_death),
        ('void', generate_void_death),
        ('rogue_miner', generate_rogue_miner_death)
    ]

    sizes = ['small', 'medium', 'large']

    # Generate faction deaths
    for faction_name, generator_func in factions:
        for size in sizes:
            sound = generator_func(size)
            filename = f"{base_path}/death_{faction_name}_{size}.wav"
            export_wav(sound, filename, SAMPLE_RATE)
            print(f"  Generated: death_{faction_name}_{size}.wav")

    # Generate player death
    sound = generate_player_death()
    export_wav(sound, f"{base_path}/death_player.wav", SAMPLE_RATE)
    print(f"  Generated: death_player.wav")

    print(f"Completed: 25 destruction sounds (24 faction + 1 player) generated in {base_path}/")


if __name__ == "__main__":
    generate_all()
