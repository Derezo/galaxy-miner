#!/usr/bin/env python3
"""
Example sound generation recipes showcasing the 8-bit audio system.

Run this file to generate example sounds demonstrating various techniques.
"""

from core import oscillators, envelopes, effects, mixer, export
from config import SAMPLE_RATE


def example_laser_shot():
    """Classic downward-sweeping laser shot."""
    print("Generating laser shot...")

    # Start with square wave
    laser = oscillators.square_wave(880, 0.3, SAMPLE_RATE)

    # Pitch sweep downward
    laser = effects.pitch_bend(laser, start_pitch=1.5, end_pitch=0.3)

    # Quick attack, fast decay
    laser = envelopes.percussive_envelope(laser, attack=0.01, decay=0.4)

    # Add 8-bit crunch
    laser = effects.bitcrush(laser, bits=5)

    # Normalize and export
    laser = mixer.normalize(laser, target_db=-3.0)
    path = export.export_wav(laser, 'example_laser.wav', SAMPLE_RATE)
    print(f"  ✓ {path}")


def example_explosion():
    """Layered explosion with multiple frequency bands."""
    print("Generating explosion...")

    # Low rumble
    rumble = oscillators.brown_noise(0.8, SAMPLE_RATE)
    rumble = effects.lowpass_filter(rumble, cutoff=400, sample_rate=SAMPLE_RATE)
    rumble = envelopes.percussive_envelope(rumble, attack=0.01, decay=0.7)

    # Mid crunch
    crunch = oscillators.white_noise(0.8, SAMPLE_RATE)
    crunch = effects.lowpass_filter(crunch, cutoff=2500, sample_rate=SAMPLE_RATE)
    crunch = envelopes.percussive_envelope(crunch, attack=0.001, decay=0.4)

    # High burst
    burst = oscillators.white_noise(0.8, SAMPLE_RATE)
    burst = effects.highpass_filter(burst, cutoff=3000, sample_rate=SAMPLE_RATE)
    burst = envelopes.percussive_envelope(burst, attack=0.001, decay=0.2)

    # Mix layers
    explosion = mixer.mix_layers([rumble, crunch, burst], weights=[0.5, 0.3, 0.2])

    # Add reverb
    explosion = effects.simple_reverb(explosion, delay=0.06, decay=0.4)

    # 8-bit aesthetic
    explosion = effects.bitcrush(explosion, bits=5)

    # Normalize and export
    explosion = mixer.normalize(explosion, target_db=-3.0)
    path = export.export_wav(explosion, 'example_explosion.wav', SAMPLE_RATE)
    print(f"  ✓ {path}")


def example_power_up():
    """Rising tone power-up sound."""
    print("Generating power-up...")

    # Triangle wave for smoothness
    power = oscillators.triangle_wave(220, 0.6, SAMPLE_RATE)

    # Pitch sweep upward
    power = effects.pitch_bend(power, start_pitch=0.5, end_pitch=2.0)

    # Gradual swell
    power = envelopes.swell_envelope(power, attack_time=0.7)

    # Add shimmer with ring modulation
    power = effects.ring_modulate(power, mod_freq=8, sample_rate=SAMPLE_RATE)

    # Bitcrush
    power = effects.bitcrush(power, bits=6)

    # Normalize and export
    power = mixer.normalize(power, target_db=-3.0)
    path = export.export_wav(power, 'example_power_up.wav', SAMPLE_RATE)
    print(f"  ✓ {path}")


def example_alien_ambience():
    """Eerie alien ambience with wobble."""
    print("Generating alien ambience...")

    # Base tone
    base = oscillators.sawtooth_wave(110, 2.0, SAMPLE_RATE)

    # Add wobble modulation
    base = envelopes.wobble_envelope(base, rate=2.5, depth=0.7)

    # Resonant filter sweep
    base = effects.resonant_filter(base, cutoff=800, resonance=4.0, sample_rate=SAMPLE_RATE)

    # Add some noise texture
    noise = oscillators.white_noise(2.0, SAMPLE_RATE)
    noise = effects.lowpass_filter(noise, cutoff=1200, sample_rate=SAMPLE_RATE)
    noise = mixer.normalize(noise, target_db=-15.0)  # Quiet background

    # Mix
    alien = mixer.mix_layers([base, noise], weights=[0.8, 0.2])

    # Reverb for space
    alien = effects.simple_reverb(alien, delay=0.1, decay=0.6)

    # Bitcrush
    alien = effects.bitcrush(alien, bits=5)

    # Normalize and export
    alien = mixer.normalize(alien, target_db=-6.0)
    path = export.export_wav(alien, 'example_alien_ambience.wav', SAMPLE_RATE)
    print(f"  ✓ {path}")


def example_hit_impact():
    """Sharp metallic impact sound."""
    print("Generating hit impact...")

    # Metallic tone with ring modulation
    hit = oscillators.square_wave(880, 0.15, SAMPLE_RATE)
    hit = effects.ring_modulate(hit, mod_freq=120, sample_rate=SAMPLE_RATE)

    # Add noise burst
    noise = oscillators.white_noise(0.15, SAMPLE_RATE)
    noise = effects.highpass_filter(noise, cutoff=2000, sample_rate=SAMPLE_RATE)

    # Mix
    hit = mixer.mix_layers([hit, noise], weights=[0.6, 0.4])

    # Very fast percussive envelope
    hit = envelopes.percussive_envelope(hit, attack=0.001, decay=0.25)

    # Add distortion for punch
    hit = effects.distortion(hit, drive=2.0)

    # Bitcrush
    hit = effects.bitcrush(hit, bits=5)

    # Normalize and export
    hit = mixer.normalize(hit, target_db=-3.0)
    path = export.export_wav(hit, 'example_hit_impact.wav', SAMPLE_RATE)
    print(f"  ✓ {path}")


def example_engine_hum():
    """Continuous engine hum with harmonics."""
    print("Generating engine hum...")

    # Fundamental frequency
    fundamental = oscillators.sawtooth_wave(55, 1.5, SAMPLE_RATE)

    # Add harmonic
    harmonic = oscillators.sawtooth_wave(110, 1.5, SAMPLE_RATE)

    # Mix with fundamental dominant
    engine = mixer.mix_layers([fundamental, harmonic], weights=[0.7, 0.3])

    # Add slight wobble for realism
    engine = envelopes.wobble_envelope(engine, rate=1.5, depth=0.3)

    # Lowpass to remove harsh high end
    engine = effects.lowpass_filter(engine, cutoff=1500, sample_rate=SAMPLE_RATE)

    # Bitcrush
    engine = effects.bitcrush(engine, bits=5)

    # Add fade in/out
    engine = mixer.fade_in(engine, duration_samples=2000)
    engine = mixer.fade_out(engine, duration_samples=3000)

    # Normalize and export
    engine = mixer.normalize(engine, target_db=-6.0)
    path = export.export_wav(engine, 'example_engine_hum.wav', SAMPLE_RATE)
    print(f"  ✓ {path}")


def main():
    """Generate all example sounds."""
    print("=" * 70)
    print("8-Bit Procedural Audio System - Example Sounds")
    print("=" * 70)
    print()

    # Ensure output directory exists
    export.ensure_output_dir()

    example_laser_shot()
    example_explosion()
    example_power_up()
    example_alien_ambience()
    example_hit_impact()
    example_engine_hum()

    print()
    print("=" * 70)
    print("All examples generated successfully!")
    print("Check the output/ directory for WAV files.")
    print("=" * 70)


if __name__ == '__main__':
    main()
