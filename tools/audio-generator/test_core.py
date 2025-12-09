#!/usr/bin/env python3
"""
Quick test script to verify all core audio generation modules work correctly.

This creates sample sounds using each oscillator, envelope, and effect.
"""

import numpy as np
from core import oscillators, envelopes, effects, mixer, export
from config import SAMPLE_RATE, DEFAULT_DURATION


def test_oscillators():
    """Test all oscillator functions."""
    print("Testing oscillators...")

    # Test square wave
    square = oscillators.square_wave(440, DEFAULT_DURATION, SAMPLE_RATE)
    assert len(square) > 0
    assert np.all(np.abs(square) <= 1.0)
    print("  ✓ square_wave")

    # Test pulse wave
    pulse = oscillators.pulse_wave(220, DEFAULT_DURATION, duty_cycle=0.25, sample_rate=SAMPLE_RATE)
    assert len(pulse) > 0
    print("  ✓ pulse_wave")

    # Test triangle wave
    triangle = oscillators.triangle_wave(880, DEFAULT_DURATION, SAMPLE_RATE)
    assert len(triangle) > 0
    print("  ✓ triangle_wave")

    # Test sawtooth wave
    saw = oscillators.sawtooth_wave(110, DEFAULT_DURATION, SAMPLE_RATE)
    assert len(saw) > 0
    print("  ✓ sawtooth_wave")

    # Test sine wave
    sine = oscillators.sine_wave(440, DEFAULT_DURATION, SAMPLE_RATE)
    assert len(sine) > 0
    print("  ✓ sine_wave")

    # Test white noise
    white = oscillators.white_noise(DEFAULT_DURATION, SAMPLE_RATE)
    assert len(white) > 0
    print("  ✓ white_noise")

    # Test brown noise
    brown = oscillators.brown_noise(DEFAULT_DURATION, SAMPLE_RATE)
    assert len(brown) > 0
    print("  ✓ brown_noise")


def test_envelopes():
    """Test all envelope functions."""
    print("\nTesting envelopes...")

    base_wave = oscillators.square_wave(440, 0.5, SAMPLE_RATE)

    # Test ADSR
    adsr = envelopes.adsr_envelope(base_wave, attack=0.1, decay=0.2, sustain=0.7, release=0.3)
    assert len(adsr) == len(base_wave)
    print("  ✓ adsr_envelope")

    # Test percussive
    perc = envelopes.percussive_envelope(base_wave.copy(), attack=0.01, decay=0.4)
    assert len(perc) == len(base_wave)
    print("  ✓ percussive_envelope")

    # Test swell
    swell = envelopes.swell_envelope(base_wave.copy(), attack_time=0.6)
    assert len(swell) == len(base_wave)
    print("  ✓ swell_envelope")

    # Test wobble
    wobble = envelopes.wobble_envelope(base_wave.copy(), rate=5.0, depth=0.5)
    assert len(wobble) == len(base_wave)
    print("  ✓ wobble_envelope")


def test_effects():
    """Test all effect functions."""
    print("\nTesting effects...")

    base_wave = oscillators.triangle_wave(440, 0.5, SAMPLE_RATE)

    # Test bitcrush
    crushed = effects.bitcrush(base_wave.copy(), bits=5)
    assert len(crushed) == len(base_wave)
    print("  ✓ bitcrush")

    # Test lowpass filter
    lp = effects.lowpass_filter(base_wave.copy(), cutoff=2000, sample_rate=SAMPLE_RATE)
    assert len(lp) == len(base_wave)
    print("  ✓ lowpass_filter")

    # Test highpass filter
    hp = effects.highpass_filter(base_wave.copy(), cutoff=1000, sample_rate=SAMPLE_RATE)
    assert len(hp) == len(base_wave)
    print("  ✓ highpass_filter")

    # Test resonant filter
    res = effects.resonant_filter(base_wave.copy(), cutoff=1500, resonance=3.0, sample_rate=SAMPLE_RATE)
    assert len(res) == len(base_wave)
    print("  ✓ resonant_filter")

    # Test reverb
    verb = effects.simple_reverb(base_wave.copy(), delay=0.05, decay=0.3)
    assert len(verb) == len(base_wave)
    print("  ✓ simple_reverb")

    # Test pitch bend
    bent = effects.pitch_bend(base_wave.copy(), start_pitch=1.0, end_pitch=0.5)
    assert len(bent) == len(base_wave)
    print("  ✓ pitch_bend")

    # Test distortion
    dist = effects.distortion(base_wave.copy(), drive=3.0)
    assert len(dist) == len(base_wave)
    print("  ✓ distortion")

    # Test ring modulation
    ring = effects.ring_modulate(base_wave.copy(), mod_freq=100, sample_rate=SAMPLE_RATE)
    assert len(ring) == len(base_wave)
    print("  ✓ ring_modulate")


def test_mixer():
    """Test mixer functions."""
    print("\nTesting mixer...")

    wave1 = oscillators.square_wave(220, 0.3, SAMPLE_RATE)
    wave2 = oscillators.triangle_wave(330, 0.3, SAMPLE_RATE)

    # Test mix layers
    mixed = mixer.mix_layers([wave1, wave2], weights=[0.5, 0.5])
    assert len(mixed) == len(wave1)
    print("  ✓ mix_layers")

    # Test normalize
    normalized = mixer.normalize(wave1.copy(), target_db=-3.0)
    assert len(normalized) == len(wave1)
    print("  ✓ normalize")

    # Test fade in
    faded_in = mixer.fade_in(wave1.copy(), duration_samples=1000)
    assert len(faded_in) == len(wave1)
    print("  ✓ fade_in")

    # Test fade out
    faded_out = mixer.fade_out(wave1.copy(), duration_samples=1000)
    assert len(faded_out) == len(wave1)
    print("  ✓ fade_out")


def test_export():
    """Test export functionality."""
    print("\nTesting export...")

    # Create simple test sound
    wave = oscillators.square_wave(440, 0.2, SAMPLE_RATE)
    wave = envelopes.percussive_envelope(wave, attack=0.01, decay=0.3)

    # Test export
    path = export.export_wav(wave, 'test_sound.wav', SAMPLE_RATE)
    assert path.exists()
    print(f"  ✓ export_wav (created {path})")

    # Test directory creation
    subdir = export.ensure_output_dir('test_subdir')
    assert subdir.exists()
    print(f"  ✓ ensure_output_dir (created {subdir})")


def create_demo_sound():
    """Create a demo sound showcasing the system."""
    print("\nCreating demo sound...")

    # Layer 1: Base tone with pitch bend
    base = oscillators.square_wave(440, 0.5, SAMPLE_RATE)
    base = effects.pitch_bend(base, start_pitch=1.0, end_pitch=0.3)
    base = envelopes.percussive_envelope(base, attack=0.01, decay=0.4)

    # Layer 2: Harmonic with distortion
    harmonic = oscillators.sawtooth_wave(880, 0.5, SAMPLE_RATE)
    harmonic = effects.distortion(harmonic, drive=2.5)
    harmonic = envelopes.adsr_envelope(harmonic, attack=0.05, decay=0.2, sustain=0.3, release=0.4)

    # Layer 3: Noise burst
    noise = oscillators.white_noise(0.5, SAMPLE_RATE)
    noise = effects.lowpass_filter(noise, cutoff=3000, sample_rate=SAMPLE_RATE)
    noise = envelopes.percussive_envelope(noise, attack=0.001, decay=0.15)

    # Mix all layers
    final = mixer.mix_layers([base, harmonic, noise], weights=[0.5, 0.3, 0.2])

    # Apply bitcrush for 8-bit aesthetic
    final = effects.bitcrush(final, bits=5)

    # Add reverb
    final = effects.simple_reverb(final, delay=0.05, decay=0.4)

    # Normalize
    final = mixer.normalize(final, target_db=-3.0)

    # Export
    path = export.export_wav(final, 'demo_laser_shot.wav', SAMPLE_RATE)
    print(f"  ✓ Demo sound created: {path}")


if __name__ == '__main__':
    print("=" * 60)
    print("8-Bit Procedural Audio System - Core Module Tests")
    print("=" * 60)

    test_oscillators()
    test_envelopes()
    test_effects()
    test_mixer()
    test_export()
    create_demo_sound()

    print("\n" + "=" * 60)
    print("All tests passed! Core modules are fully functional.")
    print("=" * 60)
