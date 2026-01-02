"""
Boss sound generator.

Creates 15 boss sounds for the Swarm Queen:
- Phase transitions (4 sounds, increasingly intense)
- Special attacks (web snare, acid burst, roar)
- Death sequence (7.5 second dramatic multi-phase explosion)
"""

import numpy as np

# Core module imports
try:
    from core.oscillators import square_wave, sawtooth_wave, triangle_wave, noise, pulse_wave
    from core.envelopes import adsr_envelope, percussive_envelope
    from core.effects import (bitcrush, lowpass_filter, highpass_filter,
                              distortion, pitch_sweep, resonant_filter, phaser)
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
    def resonant_filter(signal, freq, resonance=5.0, sample_rate=22050): return signal
    def phaser(signal, rate=2.0, depth=1.0, sample_rate=22050): return signal
    def mix_layers(*signals, weights=None): return signals[0] if signals else np.zeros(22050)
    def normalize(signal, target_db=-3): return signal
    def export_wav(signal, filename, sample_rate=22050): pass
    def ensure_output_dir(path): pass


def generate_queen_phase_transition(phase: int) -> np.ndarray:
    """
    Queen phase transitions (1-4): Increasingly intense power-up sounds.
    Marks significant health thresholds and behavior changes.

    Args:
        phase: 1-4, each phase more intense than the last
    """
    duration = 1.0 + (phase * 0.3)  # 1.3, 1.6, 1.9, 2.2 seconds
    intensity = phase / 4.0

    # Rising organic drone - swarm signature
    drone_start = 30 + (phase * 10)
    drone_end = 80 + (phase * 40)
    drone = triangle_wave(drone_start, duration, sample_rate=SAMPLE_RATE)
    drone = pitch_sweep(drone, drone_start, drone_end, duration, sample_rate=SAMPLE_RATE)

    # Add harmonics for organic complexity
    harmonic1 = triangle_wave(drone_start * 2, duration, sample_rate=SAMPLE_RATE)
    harmonic1 = pitch_sweep(harmonic1, drone_start * 2, drone_end * 2, duration, sample_rate=SAMPLE_RATE)

    # Organic texture - brown noise with resonance
    organic = noise(duration, color='brown', sample_rate=SAMPLE_RATE)
    organic = lowpass_filter(organic, 200 + phase * 100, sample_rate=SAMPLE_RATE)
    organic = resonant_filter(organic, 100 + phase * 50, resonance=3.0 + phase, sample_rate=SAMPLE_RATE)

    # Power surge - high frequency burst at climax
    surge_start = duration * 0.7
    surge_duration = duration * 0.3
    surge = pulse_wave(400 + phase * 200, surge_duration, duty=0.3, sample_rate=SAMPLE_RATE)
    surge = percussive_envelope(surge, attack=0.05, decay=surge_duration)
    surge_full = np.zeros(int(duration * SAMPLE_RATE))
    surge_pos = int(surge_start * SAMPLE_RATE)
    end_pos = min(surge_pos + len(surge), len(surge_full))
    surge_full[surge_pos:end_pos] = surge[:end_pos - surge_pos]

    # Envelope for rising intensity
    combined = mix_layers(drone, harmonic1, organic, surge_full,
                         weights=[0.35, 0.2, 0.25, 0.2 * intensity])
    combined = adsr_envelope(combined, attack=0.1, decay=0.2,
                           sustain_level=0.7 + intensity * 0.2, release=0.3)

    # Processing intensity increases with phase
    combined = distortion(combined, amount=0.2 + intensity * 0.3)
    combined = bitcrush(combined, bits=6 - phase // 2)  # 6, 6, 5, 5 bits

    return normalize(combined, target_db=-3 - phase)  # Louder in later phases


def generate_queen_web_snare() -> np.ndarray:
    """
    Queen web snare: Sticky organic sound.
    Captures the feeling of being caught in webbing.
    """
    duration = 0.8

    # Sticky impact - low frequency thud
    impact = square_wave(60, 0.15, sample_rate=SAMPLE_RATE)
    impact = percussive_envelope(impact, attack=0.01, decay=0.15)

    # Web stretch - resonant sweep
    stretch_start = 200
    stretch_end = 400
    stretch = triangle_wave(stretch_start, 0.5, sample_rate=SAMPLE_RATE)
    stretch = pitch_sweep(stretch, stretch_start, stretch_end, 0.5, sample_rate=SAMPLE_RATE)
    stretch = resonant_filter(stretch, 300, resonance=8.0, sample_rate=SAMPLE_RATE)
    stretch_full = np.zeros(int(duration * SAMPLE_RATE))
    stretch_pos = int(0.15 * SAMPLE_RATE)
    end_pos = min(stretch_pos + len(stretch), len(stretch_full))
    stretch_full[stretch_pos:end_pos] = stretch[:end_pos - stretch_pos]

    # Organic squelch
    squelch = noise(0.4, color='pink', sample_rate=SAMPLE_RATE)
    squelch = lowpass_filter(squelch, 800, sample_rate=SAMPLE_RATE)
    squelch = percussive_envelope(squelch, attack=0.02, decay=0.4)
    squelch_full = np.zeros(int(duration * SAMPLE_RATE))
    squelch_pos = int(0.1 * SAMPLE_RATE)
    end_pos = min(squelch_pos + len(squelch), len(squelch_full))
    squelch_full[squelch_pos:end_pos] = squelch[:end_pos - squelch_pos]

    # Mix
    combined = mix_layers(impact, stretch_full, squelch_full, weights=[0.35, 0.4, 0.25])
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_queen_acid_burst() -> np.ndarray:
    """
    Queen acid burst: Sizzling spray sound.
    Corrosive attack with bubbling texture.
    """
    duration = 0.6

    # Initial spray - harsh burst
    spray = sawtooth_wave(800, 0.1, sample_rate=SAMPLE_RATE)
    spray = pitch_sweep(spray, 800, 400, 0.1, sample_rate=SAMPLE_RATE)
    spray = percussive_envelope(spray, attack=0.002, decay=0.1)

    # Sizzle - filtered white noise
    sizzle = noise(duration * 0.8, color='white', sample_rate=SAMPLE_RATE)
    sizzle = highpass_filter(sizzle, 3000, sample_rate=SAMPLE_RATE)
    sizzle = lowpass_filter(sizzle, 8000, sample_rate=SAMPLE_RATE)
    sizzle_full = np.zeros(int(duration * SAMPLE_RATE))
    sizzle_pos = int(0.08 * SAMPLE_RATE)
    end_pos = min(sizzle_pos + len(sizzle), len(sizzle_full))
    sizzle_full[sizzle_pos:end_pos] = sizzle[:end_pos - sizzle_pos]
    sizzle_full = percussive_envelope(sizzle_full, attack=0.05, decay=duration * 0.8)

    # Bubbling - pulsing low frequency
    bubble = pulse_wave(120, duration, duty=0.4, sample_rate=SAMPLE_RATE)
    bubble = lowpass_filter(bubble, 300, sample_rate=SAMPLE_RATE)
    bubble = percussive_envelope(bubble, attack=0.03, decay=duration)

    # Mix
    combined = mix_layers(spray, sizzle_full, bubble, weights=[0.3, 0.5, 0.2])
    combined = distortion(combined, amount=0.4)
    combined = bitcrush(combined, bits=5)

    return normalize(combined)


def generate_queen_roar() -> np.ndarray:
    """
    Queen roar/attack: Deep menacing roar.
    Intimidating sound for aggressive attack initiation.
    """
    duration = 1.2

    # Deep growl - low frequency modulation
    growl_base = 40
    growl = square_wave(growl_base, duration, sample_rate=SAMPLE_RATE)

    # Add tremolo effect (amplitude modulation)
    tremolo_rate = 8  # Hz
    t = np.linspace(0, duration, int(duration * SAMPLE_RATE))
    tremolo = 0.5 + 0.5 * np.sin(2 * np.pi * tremolo_rate * t)
    growl = growl * tremolo

    # Harmonic for aggression
    harmonic = square_wave(growl_base * 3, duration, sample_rate=SAMPLE_RATE)
    harmonic = harmonic * tremolo

    # Organic roar texture
    roar_noise = noise(duration, color='brown', sample_rate=SAMPLE_RATE)
    roar_noise = lowpass_filter(roar_noise, 500, sample_rate=SAMPLE_RATE)
    roar_noise = highpass_filter(roar_noise, 80, sample_rate=SAMPLE_RATE)

    # Rising pitch at end for aggression
    rise_start = duration * 0.7
    rise_duration = duration * 0.3
    rise = sawtooth_wave(200, rise_duration, sample_rate=SAMPLE_RATE)
    rise = pitch_sweep(rise, 200, 400, rise_duration, sample_rate=SAMPLE_RATE)
    rise_full = np.zeros(int(duration * SAMPLE_RATE))
    rise_pos = int(rise_start * SAMPLE_RATE)
    end_pos = min(rise_pos + len(rise), len(rise_full))
    rise_full[rise_pos:end_pos] = rise[:end_pos - rise_pos]

    # Envelope
    combined = mix_layers(growl, harmonic, roar_noise, rise_full,
                         weights=[0.35, 0.15, 0.35, 0.15])
    combined = adsr_envelope(combined, attack=0.15, decay=0.2, sustain_level=0.8, release=0.3)

    # Heavy distortion
    combined = distortion(combined, amount=0.6)
    combined = bitcrush(combined, bits=4)

    return normalize(combined, target_db=-2)  # Loud and aggressive


def generate_queen_death() -> np.ndarray:
    """
    Queen death sequence: 7.5 second dramatic multi-phase explosion.
    Epic finale with multiple stages of destruction.
    """
    duration = 7.5

    # Phase 1: Initial catastrophic hit (0-1.5s)
    impact = square_wave(600, 0.8, sample_rate=SAMPLE_RATE)
    impact = pitch_sweep(impact, 600, 80, 0.8, sample_rate=SAMPLE_RATE)
    impact = percussive_envelope(impact, attack=0.001, decay=0.8)
    impact = distortion(impact, amount=0.8)

    # Phase 2: Organic breakdown (1.0-4.0s)
    breakdown = noise(3.0, color='brown', sample_rate=SAMPLE_RATE)
    breakdown = lowpass_filter(breakdown, 400, sample_rate=SAMPLE_RATE)
    breakdown_full = np.zeros(int(duration * SAMPLE_RATE))
    breakdown_pos = int(1.0 * SAMPLE_RATE)
    end_pos = min(breakdown_pos + len(breakdown), len(breakdown_full))
    breakdown_full[breakdown_pos:end_pos] = breakdown[:end_pos - breakdown_pos]

    # Phase 3: Multiple secondary explosions (1.5-5.0s)
    secondary = np.zeros(int(duration * SAMPLE_RATE))
    explosion_times = [1.5, 2.2, 2.8, 3.5, 4.2, 4.8]
    for i, time_offset in enumerate(explosion_times):
        pos = int(time_offset * SAMPLE_RATE)
        exp_freq = 500 - i * 60
        exp = square_wave(exp_freq, 0.5, sample_rate=SAMPLE_RATE)
        exp = pitch_sweep(exp, exp_freq, 60, 0.5, sample_rate=SAMPLE_RATE)
        exp = percussive_envelope(exp, attack=0.002, decay=0.5)
        end_pos = min(pos + len(exp), len(secondary))
        secondary[pos:end_pos] += exp[:end_pos - pos] * (0.7 - i * 0.08)

    # Phase 4: Final implosion (5.0-6.5s)
    implosion_start = 80
    implosion_end = 2000
    implosion = triangle_wave(implosion_start, 1.5, sample_rate=SAMPLE_RATE)
    implosion = pitch_sweep(implosion, implosion_start, implosion_end, 1.5, sample_rate=SAMPLE_RATE)
    implosion = adsr_envelope(implosion, attack=0.3, decay=0.4, sustain_level=0.6, release=0.8)
    implosion_full = np.zeros(int(duration * SAMPLE_RATE))
    implosion_pos = int(5.0 * SAMPLE_RATE)
    end_pos = min(implosion_pos + len(implosion), len(implosion_full))
    implosion_full[implosion_pos:end_pos] = implosion[:end_pos - implosion_pos]

    # Phase 5: Debris field and dissipation (2.0-7.5s)
    debris = noise(5.5, color='white', sample_rate=SAMPLE_RATE)
    debris = lowpass_filter(debris, 3000, sample_rate=SAMPLE_RATE)
    debris_full = np.zeros(int(duration * SAMPLE_RATE))
    debris_pos = int(2.0 * SAMPLE_RATE)
    end_pos = min(debris_pos + len(debris), len(debris_full))
    debris_full[debris_pos:end_pos] = debris[:end_pos - debris_pos]
    debris_full = percussive_envelope(debris_full, attack=0.5, decay=5.5)

    # Deep rumble throughout
    rumble = square_wave(35, duration, sample_rate=SAMPLE_RATE)
    rumble = adsr_envelope(rumble, attack=0.2, decay=2.0, sustain_level=0.5, release=3.0)

    # Ethereal dissipation (final 2 seconds)
    ethereal = noise(2.0, color='white', sample_rate=SAMPLE_RATE)
    ethereal = highpass_filter(ethereal, 6000, sample_rate=SAMPLE_RATE)
    ethereal_full = np.zeros(int(duration * SAMPLE_RATE))
    ethereal_pos = int(5.5 * SAMPLE_RATE)
    end_pos = min(ethereal_pos + len(ethereal), len(ethereal_full))
    ethereal_full[ethereal_pos:end_pos] = ethereal[:end_pos - ethereal_pos]
    ethereal_full = percussive_envelope(ethereal_full, attack=0.3, decay=2.0)

    # Mix all phases
    combined = mix_layers(impact, breakdown_full, secondary, implosion_full,
                         debris_full, rumble, ethereal_full,
                         weights=[0.25, 0.15, 0.2, 0.15, 0.1, 0.1, 0.05])

    # Epic processing
    combined = distortion(combined, amount=0.7)
    combined = bitcrush(combined, bits=4)

    return normalize(combined, target_db=-1)  # Maximum impact


# ============================================================================
# Void Leviathan Boss Sounds
# ============================================================================

def generate_void_leviathan_spawn() -> np.ndarray:
    """
    Void Leviathan spawn: 7-second cinematic emergence.
    Multiple cracks spread, void energy pools, massive entity emerges.
    """
    duration = 7.0

    # Phase 1: Multiple cracks spreading (0-2s)
    cracks = np.zeros(int(duration * SAMPLE_RATE))
    crack_times = [0.0, 0.3, 0.5, 0.8, 1.2, 1.5, 1.8]
    for i, time_offset in enumerate(crack_times):
        pos = int(time_offset * SAMPLE_RATE)
        crack_freq = 300 + i * 50
        crack = pulse_wave(crack_freq, 0.15, duty=0.3, sample_rate=SAMPLE_RATE)
        crack = pitch_sweep(crack, crack_freq, crack_freq * 0.5, 0.15, sample_rate=SAMPLE_RATE)
        crack = percussive_envelope(crack, attack=0.002, decay=0.15)
        end_pos = min(pos + len(crack), len(cracks))
        cracks[pos:end_pos] += crack[:end_pos - pos] * (0.5 + i * 0.05)

    # Phase 2: Void energy pooling (1.5-4s)
    pool_duration = 2.5
    pool = triangle_wave(40, pool_duration, sample_rate=SAMPLE_RATE)
    pool = phaser(pool, rate=3.0, depth=0.8, sample_rate=SAMPLE_RATE)
    # Add tremolo
    t = np.linspace(0, pool_duration, int(pool_duration * SAMPLE_RATE))
    tremolo = 0.5 + 0.5 * np.sin(2 * np.pi * 4 * t)
    pool = pool * tremolo
    pool_full = np.zeros(int(duration * SAMPLE_RATE))
    pool_pos = int(1.5 * SAMPLE_RATE)
    end_pos = min(pool_pos + len(pool), len(pool_full))
    pool_full[pool_pos:end_pos] = pool[:end_pos - pool_pos]
    pool_full = adsr_envelope(pool_full, attack=0.5, decay=0.5, sustain_level=0.8, release=1.0)

    # Phase 3: Cracks converging into massive tear (3-5s)
    converge = sawtooth_wave(60, 2.0, sample_rate=SAMPLE_RATE)
    converge = pitch_sweep(converge, 60, 120, 2.0, sample_rate=SAMPLE_RATE)
    converge = resonant_filter(converge, 100, resonance=6.0, sample_rate=SAMPLE_RATE)
    converge_full = np.zeros(int(duration * SAMPLE_RATE))
    converge_pos = int(3.0 * SAMPLE_RATE)
    end_pos = min(converge_pos + len(converge), len(converge_full))
    converge_full[converge_pos:end_pos] = converge[:end_pos - converge_pos]
    converge_full = adsr_envelope(converge_full, attack=0.3, decay=0.4, sustain_level=0.7, release=0.8)

    # Phase 4: Leviathan emergence (4.5-7s) - massive entity pushing through
    emerge_duration = 2.5
    emerge = square_wave(25, emerge_duration, sample_rate=SAMPLE_RATE)
    # Slow pitch rise as entity emerges
    emerge = pitch_sweep(emerge, 25, 50, emerge_duration, sample_rate=SAMPLE_RATE)
    emerge_full = np.zeros(int(duration * SAMPLE_RATE))
    emerge_pos = int(4.5 * SAMPLE_RATE)
    end_pos = min(emerge_pos + len(emerge), len(emerge_full))
    emerge_full[emerge_pos:end_pos] = emerge[:end_pos - emerge_pos]
    emerge_full = adsr_envelope(emerge_full, attack=0.8, decay=0.5, sustain_level=0.9, release=1.0)

    # Void ambient throughout - dark otherworldly presence
    void_ambient = noise(duration, color='brown', sample_rate=SAMPLE_RATE)
    void_ambient = lowpass_filter(void_ambient, 300, sample_rate=SAMPLE_RATE)
    void_ambient = phaser(void_ambient, rate=1.0, depth=0.5, sample_rate=SAMPLE_RATE)
    void_ambient = adsr_envelope(void_ambient, attack=1.0, decay=1.0, sustain_level=0.6, release=2.0)

    # Final impact when fully emerged
    final_impact = square_wave(80, 0.5, sample_rate=SAMPLE_RATE)
    final_impact = pitch_sweep(final_impact, 80, 30, 0.5, sample_rate=SAMPLE_RATE)
    final_impact = percussive_envelope(final_impact, attack=0.01, decay=0.5)
    final_full = np.zeros(int(duration * SAMPLE_RATE))
    final_pos = int(6.5 * SAMPLE_RATE)
    end_pos = min(final_pos + len(final_impact), len(final_full))
    final_full[final_pos:end_pos] = final_impact[:end_pos - final_pos]

    # Mix all phases
    combined = mix_layers(cracks, pool_full, converge_full, emerge_full,
                         void_ambient, final_full,
                         weights=[0.2, 0.15, 0.2, 0.25, 0.1, 0.1])

    # Void processing
    combined = distortion(combined, amount=0.5)
    combined = bitcrush(combined, bits=4)

    return normalize(combined, target_db=-2)


def generate_void_gravity_warning() -> np.ndarray:
    """
    Void gravity well warning: Building energy, ominous power gathering.
    Deep bass rumble with rising intensity.
    """
    duration = 1.5

    # Building bass rumble
    rumble = square_wave(30, duration, sample_rate=SAMPLE_RATE)
    # Rising pitch as energy builds
    rumble = pitch_sweep(rumble, 30, 50, duration, sample_rate=SAMPLE_RATE)

    # Tremolo for pulsing effect - accelerating
    t = np.linspace(0, duration, int(duration * SAMPLE_RATE))
    # Frequency increases over time (2 Hz to 8 Hz)
    tremolo_freq = 2 + 6 * (t / duration)
    tremolo = 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(tremolo_freq) / SAMPLE_RATE)
    rumble = rumble * tremolo

    # Rising void energy
    rise = triangle_wave(100, duration, sample_rate=SAMPLE_RATE)
    rise = pitch_sweep(rise, 100, 300, duration, sample_rate=SAMPLE_RATE)
    rise = phaser(rise, rate=5.0, depth=0.7, sample_rate=SAMPLE_RATE)

    # Crackling energy
    crackle = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    crackle = resonant_filter(crackle, 800, resonance=10.0, sample_rate=SAMPLE_RATE)
    crackle = highpass_filter(crackle, 500, sample_rate=SAMPLE_RATE)
    # Increasing intensity envelope
    intensity_env = t / duration
    crackle = crackle * intensity_env

    # Envelope: gradual build
    combined = mix_layers(rumble, rise, crackle, weights=[0.45, 0.35, 0.2])
    combined = adsr_envelope(combined, attack=0.1, decay=0.2, sustain_level=0.9, release=0.2)

    # Void aesthetic
    combined = distortion(combined, amount=0.4)
    combined = bitcrush(combined, bits=5)

    return normalize(combined, target_db=-4)


def generate_void_gravity_active() -> np.ndarray:
    """
    Void gravity well active: Sustained gravitational pull vortex.
    Thrumming, swirling energy (loopable).
    """
    duration = 2.0

    # Deep thrumming base
    thrum = square_wave(35, duration, sample_rate=SAMPLE_RATE)
    # Pulsing at gravity frequency
    t = np.linspace(0, duration, int(duration * SAMPLE_RATE))
    pulse = 0.6 + 0.4 * np.sin(2 * np.pi * 6 * t)  # 6 Hz throb
    thrum = thrum * pulse

    # Swirling vortex - phased sawtooth
    vortex = sawtooth_wave(80, duration, sample_rate=SAMPLE_RATE)
    vortex = phaser(vortex, rate=2.0, depth=1.0, sample_rate=SAMPLE_RATE)
    vortex = lowpass_filter(vortex, 400, sample_rate=SAMPLE_RATE)

    # Void energy crackling
    void_crackle = noise(duration, color='pink', sample_rate=SAMPLE_RATE)
    void_crackle = resonant_filter(void_crackle, 600, resonance=8.0, sample_rate=SAMPLE_RATE)
    void_crackle = lowpass_filter(void_crackle, 2000, sample_rate=SAMPLE_RATE)

    # Subtle high-frequency shimmer
    shimmer = triangle_wave(400, duration, sample_rate=SAMPLE_RATE)
    shimmer = phaser(shimmer, rate=8.0, depth=0.5, sample_rate=SAMPLE_RATE)
    shimmer = highpass_filter(shimmer, 300, sample_rate=SAMPLE_RATE)

    # Mix
    combined = mix_layers(thrum, vortex, void_crackle, shimmer,
                         weights=[0.35, 0.3, 0.2, 0.15])

    # Ensure seamless looping
    fade_samples = int(0.05 * SAMPLE_RATE)
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)
    end_section = combined[-fade_samples:].copy()
    start_section = combined[:fade_samples].copy()
    crossfaded = end_section * fade_out + start_section * fade_in
    combined[:fade_samples] = crossfaded

    # Void aesthetic
    combined = distortion(combined, amount=0.35)
    combined = bitcrush(combined, bits=5)

    return normalize(combined, target_db=-6)  # Sustained ambient level


def generate_void_consume() -> np.ndarray:
    """
    Void consume: Dark tendrils extending, energy drain, dissolution.
    Sinister grabbing and draining sound.
    """
    duration = 1.0

    # Tendril extension - whooshing sweep
    tendril = sawtooth_wave(200, 0.4, sample_rate=SAMPLE_RATE)
    tendril = pitch_sweep(tendril, 200, 600, 0.4, sample_rate=SAMPLE_RATE)
    tendril = phaser(tendril, rate=10.0, depth=0.8, sample_rate=SAMPLE_RATE)
    tendril = percussive_envelope(tendril, attack=0.02, decay=0.4)
    tendril_full = np.zeros(int(duration * SAMPLE_RATE))
    tendril_full[:len(tendril)] = tendril

    # Grabbing impact
    grab = square_wave(100, 0.15, sample_rate=SAMPLE_RATE)
    grab = percussive_envelope(grab, attack=0.005, decay=0.15)
    grab_full = np.zeros(int(duration * SAMPLE_RATE))
    grab_pos = int(0.35 * SAMPLE_RATE)
    end_pos = min(grab_pos + len(grab), len(grab_full))
    grab_full[grab_pos:end_pos] = grab[:end_pos - grab_pos]

    # Energy drain - descending tone
    drain = triangle_wave(400, 0.5, sample_rate=SAMPLE_RATE)
    drain = pitch_sweep(drain, 400, 80, 0.5, sample_rate=SAMPLE_RATE)
    drain = resonant_filter(drain, 200, resonance=6.0, sample_rate=SAMPLE_RATE)
    drain = percussive_envelope(drain, attack=0.05, decay=0.5)
    drain_full = np.zeros(int(duration * SAMPLE_RATE))
    drain_pos = int(0.4 * SAMPLE_RATE)
    end_pos = min(drain_pos + len(drain), len(drain_full))
    drain_full[drain_pos:end_pos] = drain[:end_pos - drain_pos]

    # Dissolution hiss at end
    dissolve = noise(0.3, color='white', sample_rate=SAMPLE_RATE)
    dissolve = highpass_filter(dissolve, 4000, sample_rate=SAMPLE_RATE)
    dissolve = percussive_envelope(dissolve, attack=0.02, decay=0.3)
    dissolve_full = np.zeros(int(duration * SAMPLE_RATE))
    dissolve_pos = int(0.7 * SAMPLE_RATE)
    end_pos = min(dissolve_pos + len(dissolve), len(dissolve_full))
    dissolve_full[dissolve_pos:end_pos] = dissolve[:end_pos - dissolve_pos]

    # Mix
    combined = mix_layers(tendril_full, grab_full, drain_full, dissolve_full,
                         weights=[0.3, 0.25, 0.3, 0.15])

    # Void aesthetic
    combined = distortion(combined, amount=0.4)
    combined = bitcrush(combined, bits=5)

    return normalize(combined, target_db=-3)


def generate_all():
    """Generate all boss sounds."""
    print("Generating boss sounds...")

    base_path = "output/bosses"
    ensure_output_dir(base_path)

    # Queen phase transitions (4 sounds)
    for phase in range(1, 5):
        sound = generate_queen_phase_transition(phase)
        filename = f"{base_path}/queen_phase_{phase}.wav"
        export_wav(sound, filename, SAMPLE_RATE)
        print(f"  Generated: queen_phase_{phase}.wav")

    # Queen attacks
    attacks = [
        ('web_snare', generate_queen_web_snare),
        ('acid_burst', generate_queen_acid_burst),
        ('roar', generate_queen_roar)
    ]

    for attack_name, generator_func in attacks:
        sound = generator_func()
        filename = f"{base_path}/queen_{attack_name}.wav"
        export_wav(sound, filename, SAMPLE_RATE)
        print(f"  Generated: queen_{attack_name}.wav")

    # Queen death sequence
    sound = generate_queen_death()
    export_wav(sound, f"{base_path}/queen_death.wav", SAMPLE_RATE)
    print(f"  Generated: queen_death.wav")

    # Void Leviathan sounds
    void_sounds = [
        ('void_leviathan_spawn', generate_void_leviathan_spawn),
        ('void_gravity_warning', generate_void_gravity_warning),
        ('void_gravity_active', generate_void_gravity_active),
        ('void_consume', generate_void_consume)
    ]

    for sound_name, generator_func in void_sounds:
        sound = generator_func()
        filename = f"{base_path}/{sound_name}.wav"
        export_wav(sound, filename, SAMPLE_RATE)
        print(f"  Generated: {sound_name}.wav")

    print(f"Completed: 12 boss sounds generated in {base_path}/")


if __name__ == "__main__":
    generate_all()
