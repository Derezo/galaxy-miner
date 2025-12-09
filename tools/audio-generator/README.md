# 8-Bit Procedural Audio Generator

A modern Python 3.12+ system for generating retro-style 8-bit game audio procedurally. Built with numpy and scipy for high-performance audio synthesis.

## Features

- **7 Waveform Oscillators**: Square, pulse, triangle, sawtooth, sine, white noise, brown noise
- **4 Envelope Shapers**: ADSR, percussive, swell, wobble (LFO)
- **8 Audio Effects**: Bitcrush, lowpass/highpass filters, resonant filter, reverb, pitch bend, distortion, ring modulation
- **Mixing Utilities**: Layer mixing, normalization, fade in/out
- **WAV Export**: 16-bit mono WAV file export

## Installation

Requires Python 3.12+ with numpy and scipy:

```bash
pip install numpy scipy
```

## Quick Start

```python
from core import oscillators, envelopes, effects, mixer, export
from config import SAMPLE_RATE

# Create a laser shot sound
laser = oscillators.square_wave(440, 0.3, SAMPLE_RATE)
laser = effects.pitch_bend(laser, start_pitch=1.5, end_pitch=0.3)
laser = envelopes.percussive_envelope(laser, attack=0.01, decay=0.4)
laser = effects.bitcrush(laser, bits=5)
laser = mixer.normalize(laser, target_db=-3.0)

# Export as WAV
path = export.export_wav(laser, 'laser_shot.wav', SAMPLE_RATE)
print(f"Exported to {path}")
```

## Module Overview

### config.py

Global constants for the audio system:
- `SAMPLE_RATE = 22050` - Classic 8-bit era sample rate
- `BIT_DEPTH = 16` - Export bit depth
- `DEFAULT_DURATION = 0.3` - Default sound duration (seconds)
- `OUTPUT_DIR` - Output directory path

### core/oscillators.py

Basic waveform generators returning numpy arrays in range [-1.0, 1.0]:

| Function | Description | Use Case |
|----------|-------------|----------|
| `square_wave(freq, duration)` | Harsh, hollow tone | Classic 8-bit melodies |
| `pulse_wave(freq, duration, duty_cycle)` | Variable pulse width | Timbral variation |
| `triangle_wave(freq, duration)` | Soft, mellow tone | Smoother melodies |
| `sawtooth_wave(freq, duration)` | Bright, buzzy tone | Bass and lead sounds |
| `sine_wave(freq, duration)` | Pure tone | Sub-bass, modulation |
| `white_noise(duration)` | Random noise | Percussion, explosions |
| `brown_noise(duration)` | Low-frequency rumble | Engine sounds, Swarm faction |

### core/envelopes.py

Amplitude shaping functions:

| Function | Description | Use Case |
|----------|-------------|----------|
| `adsr_envelope(samples, attack, decay, sustain, release)` | Standard ADSR envelope | Musical notes |
| `percussive_envelope(samples, attack, decay)` | Fast attack, exponential decay | Laser shots, impacts |
| `swell_envelope(samples, attack_time)` | Gradual fade in | Ambient, power-ups |
| `wobble_envelope(samples, rate, depth)` | LFO amplitude modulation | Alien sounds, wobble bass |

### core/effects.py

Audio processing effects:

| Function | Description | Use Case |
|----------|-------------|----------|
| `bitcrush(samples, bits)` | Reduce bit depth (4-6 bits) | 8-bit aesthetic |
| `lowpass_filter(samples, cutoff)` | Remove high frequencies | Soften harsh sounds |
| `highpass_filter(samples, cutoff)` | Remove low frequencies | Thin, tinny sounds |
| `resonant_filter(samples, cutoff, resonance)` | Resonant sweep | Wah effects |
| `simple_reverb(samples, delay, decay)` | Echo/reverb | Spatial depth |
| `pitch_bend(samples, start_pitch, end_pitch)` | Pitch sweep | Falling/rising tones |
| `distortion(samples, drive)` | Soft clipping | Add grit and harmonics |
| `ring_modulate(samples, mod_freq)` | Ring modulation | Metallic, robotic sounds |

### core/mixer.py

Audio layering and mixing:

| Function | Description | Use Case |
|----------|-------------|----------|
| `mix_layers(layer_list, weights)` | Combine multiple sounds | Layered synthesis |
| `normalize(samples, target_db)` | Normalize to target level | Prevent clipping |
| `fade_in(samples, duration_samples)` | Smooth fade in | Remove clicks |
| `fade_out(samples, duration_samples)` | Smooth fade out | Remove clicks |

### core/export.py

WAV file export utilities:

| Function | Description |
|----------|-------------|
| `export_wav(samples, filename, sample_rate)` | Export as 16-bit mono WAV |
| `ensure_output_dir(subdir)` | Create output subdirectories |

## Example: Creating Complex Sounds

```python
from core import oscillators, envelopes, effects, mixer, export
from config import SAMPLE_RATE

# Layered explosion sound
# Layer 1: Low rumble
rumble = oscillators.brown_noise(0.8, SAMPLE_RATE)
rumble = effects.lowpass_filter(rumble, cutoff=300, sample_rate=SAMPLE_RATE)
rumble = envelopes.percussive_envelope(rumble, attack=0.01, decay=0.6)

# Layer 2: Mid-range crunch
crunch = oscillators.white_noise(0.8, SAMPLE_RATE)
crunch = effects.lowpass_filter(crunch, cutoff=2000, sample_rate=SAMPLE_RATE)
crunch = envelopes.percussive_envelope(crunch, attack=0.001, decay=0.4)

# Layer 3: High frequency burst
burst = oscillators.white_noise(0.8, SAMPLE_RATE)
burst = effects.highpass_filter(burst, cutoff=3000, sample_rate=SAMPLE_RATE)
burst = envelopes.percussive_envelope(burst, attack=0.001, decay=0.15)

# Mix layers
explosion = mixer.mix_layers([rumble, crunch, burst], weights=[0.5, 0.3, 0.2])

# Apply 8-bit aesthetic
explosion = effects.bitcrush(explosion, bits=5)

# Add reverb for space
explosion = effects.simple_reverb(explosion, delay=0.08, decay=0.4)

# Normalize and export
explosion = mixer.normalize(explosion, target_db=-3.0)
export.export_wav(explosion, 'explosion.wav', SAMPLE_RATE)
```

## Testing

Run the test suite to verify all modules work correctly:

```bash
python test_core.py
```

This will:
1. Test all oscillators, envelopes, effects, and mixer functions
2. Test WAV export functionality
3. Create a demo laser shot sound showcasing the system

## Architecture

All functions use numpy arrays for performance. The audio pipeline is:

1. **Oscillators** generate raw waveforms
2. **Effects** process and transform waveforms
3. **Envelopes** shape amplitude over time
4. **Mixer** combines and balances multiple layers
5. **Export** saves final audio as WAV files

All functions accept and return samples in range [-1.0, 1.0] as float64 numpy arrays.

## Output

Generated WAV files are saved to `/tools/audio-generator/output/` by default. Use `ensure_output_dir()` to create subdirectories for organization:

```python
export.ensure_output_dir('weapons')
export.export_wav(laser, 'weapons/laser_shot.wav', SAMPLE_RATE)
```

## Type Hints

All functions are fully type-hinted using modern Python 3.12+ syntax with `numpy.typing.NDArray` for array types.

## Performance

- Sample rate: 22050 Hz (classic 8-bit era)
- All operations use vectorized numpy for performance
- Typical sound generation: < 10ms per sound
- Memory efficient: processes in-place where possible

## License

Part of the Galaxy Miner game project.
