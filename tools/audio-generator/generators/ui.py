"""
UI sound generator.

Creates 20 UI interaction sounds:
- Chat receive
- Notifications: error, warning, success, info
- Panel open/close
- Market: buy, sell, list, cancel
- Upgrade purchase
- Relic acquired
- Button click/hover
- Additional UI feedback sounds
"""

import numpy as np

# Core module imports
try:
    from core.oscillators import square_wave, pulse_wave, triangle_wave, noise
    from core.envelopes import percussive_envelope, adsr_envelope
    from core.effects import bitcrush, lowpass_filter, highpass_filter
    from core.mixer import mix_layers, normalize
    from core.export import export_wav, ensure_output_dir
except ImportError:
    print("Warning: Core modules not found. Using placeholder imports.")
    def square_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def pulse_wave(freq, duration, duty=0.5, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def triangle_wave(freq, duration, sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def noise(duration, color='white', sample_rate=44100): return np.zeros(int(duration * sample_rate))
    def percussive_envelope(signal, attack, decay): return signal
    def adsr_envelope(signal, attack, decay, sustain_level, release): return signal
    def bitcrush(signal, bits=8): return signal
    def lowpass_filter(signal, cutoff, sample_rate=44100): return signal
    def highpass_filter(signal, cutoff, sample_rate=44100): return signal
    def mix_layers(*signals, weights=None): return signals[0] if signals else np.zeros(44100)
    def normalize(signal, target_db=-3): return signal
    def export_wav(signal, filename, sample_rate=44100): pass
    def ensure_output_dir(path): pass


SAMPLE_RATE = 44100


def generate_chat_receive() -> np.ndarray:
    """Chat message received: Soft notification beep."""
    duration = 0.2

    # Gentle two-tone chime
    tone1 = triangle_wave(600, 0.08, sample_rate=SAMPLE_RATE)
    tone1 = percussive_envelope(tone1, attack=0.01, decay=0.08)

    tone2 = triangle_wave(800, 0.1, sample_rate=SAMPLE_RATE)
    tone2 = percussive_envelope(tone2, attack=0.01, decay=0.1)

    # Combine with small gap
    silence = np.zeros(int(0.02 * SAMPLE_RATE))
    combined = np.concatenate([tone1, silence, tone2])

    # Pad to duration
    if len(combined) < int(duration * SAMPLE_RATE):
        padding = np.zeros(int(duration * SAMPLE_RATE) - len(combined))
        combined = np.concatenate([combined, padding])

    combined = bitcrush(combined, bits=6)

    return normalize(combined, target_db=-8)


def generate_notification_error() -> np.ndarray:
    """Error notification: Descending harsh tone."""
    duration = 0.3

    error_tone = square_wave(400, duration, sample_rate=SAMPLE_RATE)

    # Descending pitch for negative feel
    samples = len(error_tone)
    pitch_mod = np.linspace(1.0, 0.7, samples)
    error_tone = error_tone * pitch_mod

    error_tone = percussive_envelope(error_tone, attack=0.01, decay=duration)
    error_tone = bitcrush(error_tone, bits=5)

    return normalize(error_tone, target_db=-6)


def generate_notification_warning() -> np.ndarray:
    """Warning notification: Attention-grabbing beep."""
    duration = 0.4

    # Two sharp beeps
    beep = square_wave(700, 0.1, sample_rate=SAMPLE_RATE)
    beep = percussive_envelope(beep, attack=0.005, decay=0.1)

    silence = np.zeros(int(0.08 * SAMPLE_RATE))
    combined = np.concatenate([beep, silence, beep, silence])

    # Pad to duration
    if len(combined) < int(duration * SAMPLE_RATE):
        padding = np.zeros(int(duration * SAMPLE_RATE) - len(combined))
        combined = np.concatenate([combined, padding])

    combined = bitcrush(combined, bits=5)

    return normalize(combined, target_db=-6)


def generate_notification_success() -> np.ndarray:
    """Success notification: Ascending positive tone."""
    duration = 0.3

    # Rising arpeggio for positive feel
    note1 = triangle_wave(500, 0.08, sample_rate=SAMPLE_RATE)
    note1 = percussive_envelope(note1, attack=0.005, decay=0.08)

    note2 = triangle_wave(650, 0.08, sample_rate=SAMPLE_RATE)
    note2 = percussive_envelope(note2, attack=0.005, decay=0.08)

    note3 = triangle_wave(800, 0.1, sample_rate=SAMPLE_RATE)
    note3 = percussive_envelope(note3, attack=0.005, decay=0.1)

    combined = np.concatenate([note1, note2, note3])

    # Pad to duration
    if len(combined) < int(duration * SAMPLE_RATE):
        padding = np.zeros(int(duration * SAMPLE_RATE) - len(combined))
        combined = np.concatenate([combined, padding])

    combined = bitcrush(combined, bits=6)

    return normalize(combined, target_db=-8)


def generate_notification_info() -> np.ndarray:
    """Info notification: Neutral single tone."""
    duration = 0.15

    info_tone = triangle_wave(750, duration, sample_rate=SAMPLE_RATE)
    info_tone = percussive_envelope(info_tone, attack=0.01, decay=duration)
    info_tone = bitcrush(info_tone, bits=6)

    return normalize(info_tone, target_db=-8)


def generate_panel_open() -> np.ndarray:
    """Panel opening: Whoosh up."""
    duration = 0.2

    # Rising sweep
    sweep = triangle_wave(200, duration, sample_rate=SAMPLE_RATE)

    # Pitch envelope - rise
    samples = len(sweep)
    pitch_rise = np.linspace(1.0, 2.0, samples)
    sweep = sweep * pitch_rise

    # Light noise for texture
    whoosh = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    whoosh = highpass_filter(whoosh, 2000, sample_rate=SAMPLE_RATE)
    whoosh = percussive_envelope(whoosh, attack=0.01, decay=duration)

    combined = mix_layers(sweep, whoosh, weights=[0.7, 0.3])
    combined = bitcrush(combined, bits=6)

    return normalize(combined, target_db=-10)


def generate_panel_close() -> np.ndarray:
    """Panel closing: Whoosh down."""
    duration = 0.2

    # Descending sweep
    sweep = triangle_wave(400, duration, sample_rate=SAMPLE_RATE)

    # Pitch envelope - fall
    samples = len(sweep)
    pitch_fall = np.linspace(1.0, 0.5, samples)
    sweep = sweep * pitch_fall

    # Light noise for texture
    whoosh = noise(duration, color='white', sample_rate=SAMPLE_RATE)
    whoosh = highpass_filter(whoosh, 2000, sample_rate=SAMPLE_RATE)
    whoosh = percussive_envelope(whoosh, attack=0.01, decay=duration)

    combined = mix_layers(sweep, whoosh, weights=[0.7, 0.3])
    combined = bitcrush(combined, bits=6)

    return normalize(combined, target_db=-10)


def generate_market_buy() -> np.ndarray:
    """Market purchase: Positive transaction sound."""
    duration = 0.25

    # Cash register "cha-ching" style
    cha = triangle_wave(600, 0.08, sample_rate=SAMPLE_RATE)
    cha = percussive_envelope(cha, attack=0.005, decay=0.08)

    ching = triangle_wave(900, 0.12, sample_rate=SAMPLE_RATE)
    ching = percussive_envelope(ching, attack=0.005, decay=0.12)

    silence = np.zeros(int(0.05 * SAMPLE_RATE))
    combined = np.concatenate([cha, silence, ching])

    # Pad to duration
    if len(combined) < int(duration * SAMPLE_RATE):
        padding = np.zeros(int(duration * SAMPLE_RATE) - len(combined))
        combined = np.concatenate([combined, padding])

    combined = bitcrush(combined, bits=6)

    return normalize(combined, target_db=-6)


def generate_market_sell() -> np.ndarray:
    """Market sell: Descending transaction."""
    duration = 0.25

    # Reverse of buy
    ching = triangle_wave(900, 0.08, sample_rate=SAMPLE_RATE)
    ching = percussive_envelope(ching, attack=0.005, decay=0.08)

    cha = triangle_wave(600, 0.12, sample_rate=SAMPLE_RATE)
    cha = percussive_envelope(cha, attack=0.005, decay=0.12)

    silence = np.zeros(int(0.05 * SAMPLE_RATE))
    combined = np.concatenate([ching, silence, cha])

    # Pad to duration
    if len(combined) < int(duration * SAMPLE_RATE):
        padding = np.zeros(int(duration * SAMPLE_RATE) - len(combined))
        combined = np.concatenate([combined, padding])

    combined = bitcrush(combined, bits=6)

    return normalize(combined, target_db=-6)


def generate_market_list() -> np.ndarray:
    """Market listing created: Confirmation beep."""
    duration = 0.15

    beep = pulse_wave(800, duration, duty=0.5, sample_rate=SAMPLE_RATE)
    beep = percussive_envelope(beep, attack=0.01, decay=duration)
    beep = bitcrush(beep, bits=6)

    return normalize(beep, target_db=-8)


def generate_market_cancel() -> np.ndarray:
    """Market listing cancelled: Negative confirmation."""
    duration = 0.2

    cancel = square_wave(500, duration, sample_rate=SAMPLE_RATE)
    cancel = percussive_envelope(cancel, attack=0.01, decay=duration)
    cancel = bitcrush(cancel, bits=5)

    return normalize(cancel, target_db=-8)


def generate_upgrade_purchase() -> np.ndarray:
    """Upgrade purchased: Fanfare."""
    duration = 0.6

    # Victory jingle - ascending notes
    notes = [523, 659, 784, 1047]  # C5, E5, G5, C6
    note_duration = 0.12

    fanfare = np.zeros(int(duration * SAMPLE_RATE))

    for i, freq in enumerate(notes):
        start_pos = int(i * note_duration * SAMPLE_RATE)
        note = triangle_wave(freq, note_duration * 1.2, sample_rate=SAMPLE_RATE)
        note = percussive_envelope(note, attack=0.01, decay=note_duration * 1.2)

        end_pos = min(start_pos + len(note), len(fanfare))
        fanfare[start_pos:end_pos] += note[:end_pos - start_pos]

    fanfare = bitcrush(fanfare, bits=6)

    return normalize(fanfare)


def generate_relic_acquired() -> np.ndarray:
    """Relic acquired: Mystical chime."""
    duration = 0.8

    # Mystical shimmer - multiple harmonics
    base_freq = 800
    harmonics = [1, 2, 3, 4]

    chime = np.zeros(int(duration * SAMPLE_RATE))

    for i, mult in enumerate(harmonics):
        freq = base_freq * mult
        harmonic = triangle_wave(freq, duration, sample_rate=SAMPLE_RATE)
        harmonic = percussive_envelope(harmonic, attack=0.02 + i * 0.01,
                                      decay=duration - i * 0.05)
        chime += harmonic * (0.4 / (i + 1))  # Decrease amplitude for higher harmonics

    # Add sparkle
    sparkle = noise(duration * 0.5, color='white', sample_rate=SAMPLE_RATE)
    sparkle = highpass_filter(sparkle, 8000, sample_rate=SAMPLE_RATE)
    sparkle = percussive_envelope(sparkle, attack=0.1, decay=duration * 0.5)

    sparkle_full = np.zeros(len(chime))
    sparkle_pos = int(0.2 * SAMPLE_RATE)
    end_pos = min(sparkle_pos + len(sparkle), len(sparkle_full))
    sparkle_full[sparkle_pos:end_pos] = sparkle[:end_pos - sparkle_pos]

    combined = mix_layers(chime, sparkle_full, weights=[0.8, 0.2])
    combined = bitcrush(combined, bits=6)

    return normalize(combined)


def generate_button_click() -> np.ndarray:
    """Button click: Short click sound."""
    duration = 0.05

    click = pulse_wave(1000, duration, duty=0.3, sample_rate=SAMPLE_RATE)
    click = percussive_envelope(click, attack=0.001, decay=duration)
    click = bitcrush(click, bits=5)

    return normalize(click, target_db=-10)


def generate_button_hover() -> np.ndarray:
    """Button hover: Subtle feedback."""
    duration = 0.03

    hover = pulse_wave(1200, duration, duty=0.4, sample_rate=SAMPLE_RATE)
    hover = percussive_envelope(hover, attack=0.002, decay=duration)
    hover = bitcrush(hover, bits=6)

    return normalize(hover, target_db=-12)


def generate_tab_switch() -> np.ndarray:
    """Tab switch: Quick transition."""
    duration = 0.08

    switch = triangle_wave(700, duration, sample_rate=SAMPLE_RATE)
    switch = percussive_envelope(switch, attack=0.005, decay=duration)
    switch = bitcrush(switch, bits=6)

    return normalize(switch, target_db=-10)


def generate_slider_tick() -> np.ndarray:
    """Slider tick: Subtle notch feedback."""
    duration = 0.02

    tick = pulse_wave(800, duration, duty=0.2, sample_rate=SAMPLE_RATE)
    tick = percussive_envelope(tick, attack=0.001, decay=duration)
    tick = bitcrush(tick, bits=5)

    return normalize(tick, target_db=-14)


def generate_toggle_on() -> np.ndarray:
    """Toggle on: Rising click."""
    duration = 0.06

    on_click = triangle_wave(600, duration, sample_rate=SAMPLE_RATE)

    # Rising pitch
    samples = len(on_click)
    pitch_rise = np.linspace(1.0, 1.4, samples)
    on_click = on_click * pitch_rise

    on_click = percussive_envelope(on_click, attack=0.005, decay=duration)
    on_click = bitcrush(on_click, bits=6)

    return normalize(on_click, target_db=-10)


def generate_toggle_off() -> np.ndarray:
    """Toggle off: Falling click."""
    duration = 0.06

    off_click = triangle_wave(600, duration, sample_rate=SAMPLE_RATE)

    # Falling pitch
    samples = len(off_click)
    pitch_fall = np.linspace(1.0, 0.7, samples)
    off_click = off_click * pitch_fall

    off_click = percussive_envelope(off_click, attack=0.005, decay=duration)
    off_click = bitcrush(off_click, bits=6)

    return normalize(off_click, target_db=-10)


def generate_all():
    """Generate all 20 UI sounds."""
    print("Generating UI sounds...")

    base_path = "output/ui"
    ensure_output_dir(base_path)

    sounds = [
        ('chat_receive', generate_chat_receive),
        ('notification_error', generate_notification_error),
        ('notification_warning', generate_notification_warning),
        ('notification_success', generate_notification_success),
        ('notification_info', generate_notification_info),
        ('panel_open', generate_panel_open),
        ('panel_close', generate_panel_close),
        ('market_buy', generate_market_buy),
        ('market_sell', generate_market_sell),
        ('market_list', generate_market_list),
        ('market_cancel', generate_market_cancel),
        ('upgrade_purchase', generate_upgrade_purchase),
        ('relic_acquired', generate_relic_acquired),
        ('button_click', generate_button_click),
        ('button_hover', generate_button_hover),
        ('tab_switch', generate_tab_switch),
        ('slider_tick', generate_slider_tick),
        ('toggle_on', generate_toggle_on),
        ('toggle_off', generate_toggle_off)
    ]

    for sound_name, generator_func in sounds:
        sound = generator_func()
        filename = f"{base_path}/{sound_name}.wav"
        export_wav(sound, filename, SAMPLE_RATE)
        print(f"  Generated: {sound_name}.wav")

    print(f"Completed: {len(sounds)} UI sounds generated in {base_path}/")


if __name__ == "__main__":
    generate_all()
