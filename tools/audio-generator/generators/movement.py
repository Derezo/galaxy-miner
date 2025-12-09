"""
Movement sound generator.

Creates 12 movement-related sounds:
- Engine tiers 1-5: Loopable thrust sounds with escalating power
- Boost activation + sustain loop
- Shield recharge: Energy buildup
- Shield hit absorption: Electric crackle
- Additional movement feedback
"""

import numpy as np

# Core module imports
try:
    from core.oscillators import square_wave, pulse_wave, sawtooth_wave, triangle_wave, noise
    from core.envelopes import adsr_envelope, percussive_envelope
    from core.effects import bitcrush, lowpass_filter, highpass_filter, distortion
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
    def mix_layers(*signals, weights=None): return signals[0] if signals else np.zeros(22050)
    def normalize(signal, target_db=-3): return signal
    def export_wav(signal, filename, sample_rate=22050): pass
    def ensure_output_dir(path): pass


def generate_engine_thrust(tier: int) -> np.ndarray:
    """
    Generate loopable engine thrust sound.
    Higher tiers = more powerful, deeper, more complex.

    Args:
        tier: 1-5, affects power and character
    """
    duration = 1.0  # Loopable 1 second

    # Base thrust frequency - moderate decrease for power without mud
    thrust_freq = 160 - (tier * 10)  # 150, 140, 130, 120, 110 Hz

    # Main thrust tone - triangle wave for smoother looping character
    thrust = triangle_wave(thrust_freq, duration, sample_rate=SAMPLE_RATE)

    # Harmonic overtone - gives presence without harshness
    overtone = triangle_wave(thrust_freq * 2, duration, sample_rate=SAMPLE_RATE)

    # Engine rumble - filtered noise (less at higher tiers to keep clean)
    rumble = noise(duration, color='pink', sample_rate=SAMPLE_RATE)
    rumble = lowpass_filter(rumble, 600 + tier * 100, sample_rate=SAMPLE_RATE)
    rumble = highpass_filter(rumble, 80, sample_rate=SAMPLE_RATE)

    # Sub-bass for power - square wave for that 8-bit punch
    sub_freq = 55 - tier * 3  # 52, 49, 46, 43, 40 Hz
    sub_bass = square_wave(sub_freq, duration, sample_rate=SAMPLE_RATE)
    sub_bass = lowpass_filter(sub_bass, 120, sample_rate=SAMPLE_RATE)  # Keep it smooth

    # Mix layers - balanced for all tiers
    thrust_weight = 0.4
    overtone_weight = 0.2 + tier * 0.02
    rumble_weight = 0.2 - tier * 0.02  # Less noise at higher tiers
    sub_weight = 0.1 + tier * 0.03
    combined = mix_layers(thrust, overtone, rumble, sub_bass,
                         weights=[thrust_weight, overtone_weight, rumble_weight, sub_weight])

    # Gentle amplitude modulation - slower rate for smooth pulsing
    pulse_rate = 4 + tier  # 5, 6, 7, 8, 9 Hz - much smoother
    t = np.linspace(0, duration, int(duration * SAMPLE_RATE))
    pulse_mod = 0.92 + 0.08 * np.sin(2 * np.pi * pulse_rate * t)
    combined = combined * pulse_mod

    # Light distortion - keeps character without harshness
    combined = distortion(combined, amount=0.08 + tier * 0.02)

    # Bitcrush - 6 bits for cleaner sound while keeping 8-bit character
    combined = bitcrush(combined, bits=6)

    # Ensure seamless looping - crossfade end into beginning
    fade_samples = int(0.05 * SAMPLE_RATE)  # 50ms crossfade for smooth loop
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)

    # Create crossfade: blend the end of the sound over the beginning
    # This makes the loop point seamless
    end_section = combined[-fade_samples:].copy()
    start_section = combined[:fade_samples].copy()

    # Crossfade: end fades out while start fades in
    crossfaded = end_section * fade_out + start_section * fade_in
    combined[:fade_samples] = crossfaded

    return normalize(combined, target_db=-8)  # Moderate volume for looping


def generate_boost_activation() -> np.ndarray:
    """Boost activation: Power surge."""
    duration = 0.4

    # Rising power surge
    surge_start = 100
    surge_end = 600
    surge = sawtooth_wave(surge_start, duration, sample_rate=SAMPLE_RATE)

    # Pitch sweep for acceleration feel
    samples = len(surge)
    pitch_sweep = np.linspace(1.0, 3.0, samples)
    surge = surge * pitch_sweep

    # Energy crackle
    crackle = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    crackle = highpass_filter(crackle, 3000, sample_rate=SAMPLE_RATE)
    crackle = percussive_envelope(crackle, attack=0.01, decay=duration)

    # Bass thump
    thump = square_wave(60, 0.15, sample_rate=SAMPLE_RATE)
    thump = percussive_envelope(thump, attack=0.005, decay=0.15)

    # Mix
    combined = mix_layers(surge, crackle, thump, weights=[0.5, 0.3, 0.2])
    combined = percussive_envelope(combined, attack=0.01, decay=duration)
    combined = distortion(combined, amount=0.4)
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_boost_sustain() -> np.ndarray:
    """Boost sustain: High-power engine loop."""
    duration = 1.0  # Loopable

    # Intense thrust
    thrust = sawtooth_wave(120, duration, sample_rate=SAMPLE_RATE)

    # High frequency whine
    whine = pulse_wave(400, duration, duty=0.2, sample_rate=SAMPLE_RATE)

    # Intense noise
    noise_layer = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    noise_layer = lowpass_filter(noise_layer, 2000, sample_rate=SAMPLE_RATE)
    noise_layer = highpass_filter(noise_layer, 200, sample_rate=SAMPLE_RATE)

    # Deep bass
    bass = square_wave(50, duration, sample_rate=SAMPLE_RATE)

    # Mix
    combined = mix_layers(thrust, whine, noise_layer, bass,
                         weights=[0.35, 0.25, 0.25, 0.15])

    # Distortion for power
    combined = distortion(combined, amount=0.5)
    combined = bitcrush(combined, bits=4)

    # Ensure seamless looping - crossfade end into beginning
    fade_samples = int(0.05 * SAMPLE_RATE)  # 50ms crossfade
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)

    end_section = combined[-fade_samples:].copy()
    start_section = combined[:fade_samples].copy()
    crossfaded = end_section * fade_out + start_section * fade_in
    combined[:fade_samples] = crossfaded

    return normalize(combined, target_db=-6)


def generate_shield_recharge() -> np.ndarray:
    """Shield recharge: Energy buildup."""
    duration = 1.2

    # Rising energy tone
    charge_start = 200
    charge_end = 800
    charge = triangle_wave(charge_start, duration, sample_rate=SAMPLE_RATE)

    # Pitch rise
    samples = len(charge)
    pitch_rise = np.linspace(1.0, 2.0, samples)
    charge = charge * pitch_rise

    # Electric hum
    hum = pulse_wave(120, duration, duty=0.5, sample_rate=SAMPLE_RATE)

    # Energy crackle - increases toward end
    crackle = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    crackle = highpass_filter(crackle, 4000, sample_rate=SAMPLE_RATE)
    crackle_envelope = np.linspace(0, 1, len(crackle))
    crackle = crackle * crackle_envelope

    # Mix
    combined = mix_layers(charge, hum, crackle, weights=[0.5, 0.3, 0.2])
    combined = adsr_envelope(combined, attack=0.1, decay=0.2,
                           sustain_level=0.7, release=0.3)
    combined = bitcrush(combined, bits=6)

    return normalize(combined)


def generate_shield_absorption() -> np.ndarray:
    """Shield hit absorption: Electric crackle."""
    duration = 0.3

    # Electric discharge
    discharge = pulse_wave(800, duration, duty=0.3, sample_rate=SAMPLE_RATE)
    discharge = percussive_envelope(discharge, attack=0.005, decay=duration)

    # Static crackle
    crackle = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    crackle = highpass_filter(crackle, 3000, sample_rate=SAMPLE_RATE)
    crackle = percussive_envelope(crackle, attack=0.002, decay=duration)

    # Energy wave
    wave = triangle_wave(400, duration, sample_rate=SAMPLE_RATE)
    wave = percussive_envelope(wave, attack=0.01, decay=duration)

    # Mix
    combined = mix_layers(discharge, crackle, wave, weights=[0.4, 0.35, 0.25])
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_thrust_start() -> np.ndarray:
    """Engine start: Ignition sound."""
    duration = 0.5

    # Ignition burst
    ignite = square_wave(150, 0.15, sample_rate=SAMPLE_RATE)
    ignite = percussive_envelope(ignite, attack=0.02, decay=0.15)

    # Spin up to steady
    spinup = pulse_wave(120, duration * 0.7, duty=0.4, sample_rate=SAMPLE_RATE)

    # Amplitude ramp
    ramp = np.linspace(0, 1, len(spinup))
    spinup = spinup * ramp

    # Combine
    combined = np.concatenate([ignite, spinup])

    # Pad to duration
    if len(combined) < int(duration * SAMPLE_RATE):
        padding = np.zeros(int(duration * SAMPLE_RATE) - len(combined))
        combined = np.concatenate([combined, padding])

    combined = distortion(combined, amount=0.2)
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_thrust_stop() -> np.ndarray:
    """Engine stop: Power down."""
    duration = 0.4

    # Spin down
    spindown = pulse_wave(120, duration, duty=0.4, sample_rate=SAMPLE_RATE)

    # Amplitude ramp down
    ramp = np.linspace(1, 0, len(spindown))
    spindown = spindown * ramp

    # Pitch fall
    pitch_fall = np.linspace(1.0, 0.5, len(spindown))
    spindown = spindown * pitch_fall

    spindown = bitcrush(spindown, bits=5)

    return normalize(spindown, target_db=-8)


def generate_collision_impact() -> np.ndarray:
    """Ship collision: Metallic impact."""
    duration = 0.3

    # Metal crash
    crash = square_wave(250, 0.15, sample_rate=SAMPLE_RATE)
    crash = percussive_envelope(crash, attack=0.002, decay=0.15)

    # Impact noise
    impact = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    impact = lowpass_filter(impact, 2000, sample_rate=SAMPLE_RATE)
    impact = percussive_envelope(impact, attack=0.002, decay=duration)

    # Bass thud
    thud = square_wave(80, duration * 0.6, sample_rate=SAMPLE_RATE)
    thud = percussive_envelope(thud, attack=0.005, decay=duration * 0.6)

    # Mix
    combined = mix_layers(crash, impact, thud, weights=[0.4, 0.35, 0.25])
    combined = distortion(combined, amount=0.5)
    combined = bitcrush(combined, bits=4)

    return normalize(combined)


def generate_all():
    """Generate all 12 movement sounds."""
    print("Generating movement sounds...")

    base_path = "output/movement"
    ensure_output_dir(base_path)

    # Engine tiers 1-5
    for tier in range(1, 6):
        sound = generate_engine_thrust(tier)
        filename = f"{base_path}/engine_t{tier}.wav"
        export_wav(sound, filename, SAMPLE_RATE)
        print(f"  Generated: engine_t{tier}.wav")

    # Boost sounds
    sound = generate_boost_activation()
    export_wav(sound, f"{base_path}/boost_activation.wav", SAMPLE_RATE)
    print(f"  Generated: boost_activation.wav")

    sound = generate_boost_sustain()
    export_wav(sound, f"{base_path}/boost_sustain.wav", SAMPLE_RATE)
    print(f"  Generated: boost_sustain.wav")

    # Shield sounds
    sound = generate_shield_recharge()
    export_wav(sound, f"{base_path}/shield_recharge.wav", SAMPLE_RATE)
    print(f"  Generated: shield_recharge.wav")

    sound = generate_shield_absorption()
    export_wav(sound, f"{base_path}/shield_absorption.wav", SAMPLE_RATE)
    print(f"  Generated: shield_absorption.wav")

    # Additional movement sounds
    sound = generate_thrust_start()
    export_wav(sound, f"{base_path}/thrust_start.wav", SAMPLE_RATE)
    print(f"  Generated: thrust_start.wav")

    sound = generate_thrust_stop()
    export_wav(sound, f"{base_path}/thrust_stop.wav", SAMPLE_RATE)
    print(f"  Generated: thrust_stop.wav")

    sound = generate_collision_impact()
    export_wav(sound, f"{base_path}/collision_impact.wav", SAMPLE_RATE)
    print(f"  Generated: collision_impact.wav")

    print(f"Completed: 12 movement sounds generated in {base_path}/")


if __name__ == "__main__":
    generate_all()
