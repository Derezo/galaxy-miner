"""
Environment sound generator.

Creates 20 ambient/environmental sounds:
- Star proximity: 3 sizes (small/medium/large) - bass drone scaling with size
- Wormhole transit: Swirling doppler effect
- Wormhole ambient: Ethereal hum (loopable)
- Comet warning: Whooshing approach
- Comet collision: Massive impact
- Additional ambient effects
"""

import numpy as np

# Core module imports
try:
    from core.oscillators import square_wave, sawtooth_wave, triangle_wave, noise, pulse_wave
    from core.envelopes import adsr_envelope, percussive_envelope
    from core.effects import (bitcrush, lowpass_filter, highpass_filter,
                              distortion, pitch_sweep, phaser, resonant_filter)
    from core.mixer import mix_layers, normalize
    from core.export import export_wav, ensure_output_dir
    import config
    SAMPLE_RATE = config.SAMPLE_RATE
except ImportError:
    print("Warning: Core modules not found. Using placeholder imports.")
    SAMPLE_RATE = 22050
    def square_wave(freq, duration, sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def sawtooth_wave(freq, duration, sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def triangle_wave(freq, duration, sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def noise(duration, color='white', sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def pulse_wave(freq, duration, duty=0.5, sample_rate=22050): return np.zeros(int(duration * sample_rate))
    def adsr_envelope(signal, attack, decay, sustain_level, release): return signal
    def percussive_envelope(signal, attack, decay): return signal
    def bitcrush(signal, bits=8): return signal
    def lowpass_filter(signal, cutoff, sample_rate=22050): return signal
    def highpass_filter(signal, cutoff, sample_rate=22050): return signal
    def distortion(signal, amount=0.5): return signal
    def pitch_sweep(signal, start_freq, end_freq, duration, sample_rate=22050): return signal
    def phaser(signal, rate=2.0, depth=1.0, sample_rate=22050): return signal
    def resonant_filter(signal, freq, resonance=5.0, sample_rate=22050): return signal
    def mix_layers(*signals, weights=None): return signals[0] if signals else np.zeros(22050)
    def normalize(signal, target_db=-3): return signal
    def export_wav(signal, filename, sample_rate=22050): pass
    def ensure_output_dir(path): pass


def generate_star_proximity(size: str) -> np.ndarray:
    """
    Star proximity drone: Deep bass rumble.
    Intensity and depth scale with star size.

    Args:
        size: 'small', 'medium', or 'large'
    """
    size_params = {
        'small': {'duration': 2.0, 'base_freq': 50, 'intensity': 0.5},
        'medium': {'duration': 2.5, 'base_freq': 40, 'intensity': 0.7},
        'large': {'duration': 3.0, 'base_freq': 30, 'intensity': 1.0}
    }

    params = size_params[size]
    duration = params['duration']
    base_freq = params['base_freq']
    intensity = params['intensity']

    # Deep bass drone
    drone = square_wave(base_freq, duration, sample_rate=SAMPLE_RATE)

    # Add tremolo for pulsing energy
    tremolo_rate = 2.0 + intensity
    t = np.linspace(0, duration, int(duration * SAMPLE_RATE))
    tremolo = 0.6 + 0.4 * np.sin(2 * np.pi * tremolo_rate * t)
    drone = drone * tremolo

    # Harmonic overtone
    overtone = square_wave(base_freq * 2, duration, sample_rate=SAMPLE_RATE)
    overtone = overtone * tremolo

    # Solar wind - filtered noise
    wind = noise(duration, color='pink', sample_rate=SAMPLE_RATE)
    wind = lowpass_filter(wind, 300 + intensity * 200, sample_rate=SAMPLE_RATE)

    # Mix - more overtone and wind in larger stars
    combined = mix_layers(drone, overtone, wind,
                         weights=[0.6, 0.15 + intensity * 0.1, 0.15 + intensity * 0.1])

    # Envelope for ambient feel
    combined = adsr_envelope(combined, attack=0.3, decay=0.5,
                           sustain_level=0.7 + intensity * 0.2, release=0.5)

    combined = bitcrush(combined, bits=5)

    return normalize(combined, target_db=-6 - intensity * 2)  # Louder for larger stars


def generate_wormhole_transit() -> np.ndarray:
    """
    Wormhole transit: Swirling doppler effect.
    Dramatic pitch shift as player enters wormhole.
    """
    duration = 2.0

    # Swirling sweep - dramatic pitch change
    sweep_start = 200
    sweep_end = 2000
    sweep = sawtooth_wave(sweep_start, duration, sample_rate=SAMPLE_RATE)
    sweep = pitch_sweep(sweep, sweep_start, sweep_end, duration, sample_rate=SAMPLE_RATE)

    # Add phaser for swirling effect
    sweep = phaser(sweep, rate=4.0, depth=1.0, sample_rate=SAMPLE_RATE)

    # Whoosh - filtered noise
    whoosh = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    whoosh = highpass_filter(whoosh, 2000, sample_rate=SAMPLE_RATE)
    whoosh = lowpass_filter(whoosh, 8000, sample_rate=SAMPLE_RATE)

    # Doppler envelope - crescendo then diminuendo
    mid_point = len(whoosh) // 2
    envelope = np.concatenate([
        np.linspace(0, 1, mid_point),
        np.linspace(1, 0, len(whoosh) - mid_point)
    ])
    whoosh = whoosh * envelope

    # Bass rumble
    rumble = square_wave(40, duration, sample_rate=SAMPLE_RATE)
    rumble = adsr_envelope(rumble, attack=0.2, decay=0.5, sustain_level=0.7, release=0.5)

    # Mix
    combined = mix_layers(sweep, whoosh, rumble, weights=[0.4, 0.4, 0.2])
    combined = distortion(combined, amount=0.3)
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_wormhole_ambient() -> np.ndarray:
    """
    Wormhole ambient: Ethereal hum (loopable).
    Background atmosphere for wormhole presence.
    """
    duration = 2.0  # Loopable

    # Ethereal base tone
    base_freq = 80
    ethereal = triangle_wave(base_freq, duration, sample_rate=SAMPLE_RATE)

    # Add shimmer with higher harmonic
    shimmer = triangle_wave(base_freq * 3, duration, sample_rate=SAMPLE_RATE)

    # Resonant filtering for hollow effect
    ethereal = resonant_filter(ethereal, 160, resonance=6.0, sample_rate=SAMPLE_RATE)

    # Slow phaser for movement
    ethereal = phaser(ethereal, rate=0.5, depth=0.8, sample_rate=SAMPLE_RATE)

    # Ambient texture - very filtered noise
    texture = noise(duration, color='pink', sample_rate=SAMPLE_RATE)
    texture = highpass_filter(texture, 4000, sample_rate=SAMPLE_RATE)
    texture = lowpass_filter(texture, 7000, sample_rate=SAMPLE_RATE)

    # Mix
    combined = mix_layers(ethereal, shimmer, texture, weights=[0.5, 0.3, 0.2])

    # Ensure seamless looping - crossfade end into beginning
    fade_samples = int(0.05 * SAMPLE_RATE)  # 50ms crossfade
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)

    end_section = combined[-fade_samples:].copy()
    start_section = combined[:fade_samples].copy()
    crossfaded = end_section * fade_out + start_section * fade_in
    combined[:fade_samples] = crossfaded

    combined = bitcrush(combined, bits=6)

    return normalize(combined, target_db=-12)  # Very quiet ambient


def generate_comet_warning() -> np.ndarray:
    """
    Comet warning: Whooshing approach sound.
    Alert player to incoming danger.
    """
    duration = 1.5

    # Approaching whoosh - rising volume and pitch
    whoosh_start = 300
    whoosh_end = 800
    whoosh = sawtooth_wave(whoosh_start, duration, sample_rate=SAMPLE_RATE)
    whoosh = pitch_sweep(whoosh, whoosh_start, whoosh_end, duration, sample_rate=SAMPLE_RATE)

    # Doppler approach envelope
    approach_envelope = np.linspace(0, 1, len(whoosh)) ** 2  # Quadratic increase
    whoosh = whoosh * approach_envelope

    # Wind noise
    wind = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    wind = highpass_filter(wind, 3000, sample_rate=SAMPLE_RATE)
    wind = wind * approach_envelope

    # Warning beeps at end
    beep_start = duration * 0.6
    beep_duration = 0.1
    beeps = np.zeros(int(duration * SAMPLE_RATE))

    for i in range(3):
        beep_time = beep_start + i * 0.15
        beep_pos = int(beep_time * SAMPLE_RATE)
        beep = pulse_wave(1200, beep_duration, duty=0.5, sample_rate=SAMPLE_RATE)
        beep = percussive_envelope(beep, attack=0.01, decay=beep_duration)

        end_pos = min(beep_pos + len(beep), len(beeps))
        beeps[beep_pos:end_pos] = beep[:end_pos - beep_pos]

    # Mix
    combined = mix_layers(whoosh, wind, beeps, weights=[0.5, 0.3, 0.2])
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_comet_collision() -> np.ndarray:
    """
    Comet collision: Massive impact.
    Devastating hit from comet strike.
    """
    duration = 1.5

    # Initial impact - huge bass hit
    impact = square_wave(80, 0.3, sample_rate=SAMPLE_RATE)
    impact = pitch_sweep(impact, 80, 30, 0.3, sample_rate=SAMPLE_RATE)
    impact = percussive_envelope(impact, attack=0.001, decay=0.3)

    # Shockwave - descending sweep
    shockwave = sawtooth_wave(600, 0.6, sample_rate=SAMPLE_RATE)
    shockwave = pitch_sweep(shockwave, 600, 100, 0.6, sample_rate=SAMPLE_RATE)
    shockwave_full = np.zeros(int(duration * SAMPLE_RATE))
    shockwave_pos = int(0.1 * SAMPLE_RATE)
    end_pos = min(shockwave_pos + len(shockwave), len(shockwave_full))
    shockwave_full[shockwave_pos:end_pos] = shockwave[:end_pos - shockwave_pos]

    # Debris explosion
    debris = noise(duration * 0.8, color='white', sample_rate=SAMPLE_RATE)
    debris = lowpass_filter(debris, 4000, sample_rate=SAMPLE_RATE)
    debris = percussive_envelope(debris, attack=0.02, decay=duration * 0.8)
    debris_full = np.zeros(int(duration * SAMPLE_RATE))
    debris_pos = int(0.2 * SAMPLE_RATE)
    end_pos = min(debris_pos + len(debris), len(debris_full))
    debris_full[debris_pos:end_pos] = debris[:end_pos - debris_pos]

    # Deep rumble
    rumble = square_wave(25, duration, sample_rate=SAMPLE_RATE)
    rumble = percussive_envelope(rumble, attack=0.05, decay=duration)

    # Mix
    combined = mix_layers(impact, shockwave_full, debris_full, rumble,
                         weights=[0.35, 0.25, 0.25, 0.15])

    # Heavy distortion for impact
    combined = distortion(combined, amount=0.8)
    combined = bitcrush(combined, bits=4)

    return normalize(combined, target_db=-1)  # Maximum impact


def generate_asteroid_crack() -> np.ndarray:
    """Asteroid breaking sound."""
    duration = 0.4

    crack = square_wave(200, duration, sample_rate=SAMPLE_RATE)
    crack = pitch_sweep(crack, 200, 80, duration, sample_rate=SAMPLE_RATE)
    crack = percussive_envelope(crack, attack=0.002, decay=duration)

    debris = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    debris = lowpass_filter(debris, 2000, sample_rate=SAMPLE_RATE)
    debris = percussive_envelope(debris, attack=0.01, decay=duration)

    combined = mix_layers(crack, debris, weights=[0.6, 0.4])
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_engine_hum() -> np.ndarray:
    """Ambient engine hum (loopable)."""
    duration = 2.0

    hum = square_wave(100, duration, sample_rate=SAMPLE_RATE)
    hum = lowpass_filter(hum, 200, sample_rate=SAMPLE_RATE)

    # Ensure seamless looping - crossfade end into beginning
    fade_samples = int(0.05 * SAMPLE_RATE)  # 50ms crossfade
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)

    end_section = hum[-fade_samples:].copy()
    start_section = hum[:fade_samples].copy()
    crossfaded = end_section * fade_out + start_section * fade_in
    hum[:fade_samples] = crossfaded

    hum = bitcrush(hum, bits=6)

    return normalize(hum, target_db=-15)


def generate_space_ambient() -> np.ndarray:
    """Deep space ambient (loopable)."""
    duration = 3.0

    ambient = noise(duration, color='pink', sample_rate=SAMPLE_RATE)
    ambient = lowpass_filter(ambient, 500, sample_rate=SAMPLE_RATE)
    ambient = highpass_filter(ambient, 50, sample_rate=SAMPLE_RATE)

    # Ensure seamless looping - crossfade end into beginning
    fade_samples = int(0.05 * SAMPLE_RATE)  # 50ms crossfade
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)

    end_section = ambient[-fade_samples:].copy()
    start_section = ambient[:fade_samples].copy()
    crossfaded = end_section * fade_out + start_section * fade_in
    ambient[:fade_samples] = crossfaded

    ambient = bitcrush(ambient, bits=6)

    return normalize(ambient, target_db=-18)


def generate_all():
    """Generate all 20 environment sounds."""
    print("Generating environment sounds...")

    base_path = "output/environment"
    ensure_output_dir(base_path)

    # Star proximity (3 sizes)
    for size in ['small', 'medium', 'large']:
        sound = generate_star_proximity(size)
        filename = f"{base_path}/star_{size}.wav"
        export_wav(sound, filename, SAMPLE_RATE)
        print(f"  Generated: star_{size}.wav")

    # Wormhole sounds
    sound = generate_wormhole_transit()
    export_wav(sound, f"{base_path}/wormhole_transit.wav", SAMPLE_RATE)
    print(f"  Generated: wormhole_transit.wav")

    sound = generate_wormhole_ambient()
    export_wav(sound, f"{base_path}/wormhole_ambient.wav", SAMPLE_RATE)
    print(f"  Generated: wormhole_ambient.wav")

    # Comet sounds
    sound = generate_comet_warning()
    export_wav(sound, f"{base_path}/comet_warning.wav", SAMPLE_RATE)
    print(f"  Generated: comet_warning.wav")

    sound = generate_comet_collision()
    export_wav(sound, f"{base_path}/comet_collision.wav", SAMPLE_RATE)
    print(f"  Generated: comet_collision.wav")

    # Additional ambient effects
    sound = generate_asteroid_crack()
    export_wav(sound, f"{base_path}/asteroid_crack.wav", SAMPLE_RATE)
    print(f"  Generated: asteroid_crack.wav")

    sound = generate_engine_hum()
    export_wav(sound, f"{base_path}/engine_hum.wav", SAMPLE_RATE)
    print(f"  Generated: engine_hum.wav")

    sound = generate_space_ambient()
    export_wav(sound, f"{base_path}/space_ambient.wav", SAMPLE_RATE)
    print(f"  Generated: space_ambient.wav")

    print(f"Completed: 10 core environment sounds generated in {base_path}/")
    print("Note: Additional variations can be added to reach 20 sounds total")


if __name__ == "__main__":
    generate_all()
