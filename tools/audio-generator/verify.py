#!/usr/bin/env python3
"""
Verification script to ensure all core modules are properly installed and functional.
"""

import sys

def verify_imports():
    """Verify all core modules can be imported."""
    print("Verifying imports...")
    try:
        from core import oscillators, envelopes, effects, mixer, export
        print("  ✓ All core modules imported successfully")
        return True
    except ImportError as e:
        print(f"  ✗ Import failed: {e}")
        return False

def verify_dependencies():
    """Verify required dependencies are installed."""
    print("\nVerifying dependencies...")

    try:
        import numpy
        print(f"  ✓ numpy {numpy.__version__}")
    except ImportError:
        print("  ✗ numpy not installed (pip install numpy)")
        return False

    try:
        import scipy
        print(f"  ✓ scipy {scipy.__version__}")
    except ImportError:
        print("  ✗ scipy not installed (pip install scipy)")
        return False

    return True

def verify_config():
    """Verify configuration is correct."""
    print("\nVerifying configuration...")
    try:
        import config
        print(f"  ✓ SAMPLE_RATE: {config.SAMPLE_RATE} Hz")
        print(f"  ✓ BIT_DEPTH: {config.BIT_DEPTH} bits")
        print(f"  ✓ DEFAULT_DURATION: {config.DEFAULT_DURATION} seconds")
        print(f"  ✓ OUTPUT_DIR: {config.OUTPUT_DIR}")

        if not config.OUTPUT_DIR.exists():
            print(f"  ✗ Output directory does not exist")
            return False

        return True
    except Exception as e:
        print(f"  ✗ Configuration error: {e}")
        return False

def verify_functionality():
    """Verify basic functionality works."""
    print("\nVerifying basic functionality...")
    try:
        from core import oscillators, envelopes, export
        from config import SAMPLE_RATE

        # Generate a simple sound
        wave = oscillators.square_wave(440, 0.1, SAMPLE_RATE)
        wave = envelopes.percussive_envelope(wave, attack=0.01, decay=0.3)

        # Export it
        path = export.export_wav(wave, 'verify_test.wav', SAMPLE_RATE)

        if path.exists():
            print(f"  ✓ Generated test sound: {path}")
            # Clean up
            path.unlink()
            print(f"  ✓ Cleanup successful")
            return True
        else:
            print(f"  ✗ Failed to generate test sound")
            return False

    except Exception as e:
        print(f"  ✗ Functionality test failed: {e}")
        return False

def main():
    """Run all verification checks."""
    print("=" * 70)
    print("8-Bit Procedural Audio System - Verification")
    print("=" * 70)

    checks = [
        verify_dependencies(),
        verify_imports(),
        verify_config(),
        verify_functionality()
    ]

    print("\n" + "=" * 70)
    if all(checks):
        print("SUCCESS: All verification checks passed!")
        print("The audio system is ready to use.")
        print("\nNext steps:")
        print("  - Run 'python test_core.py' for comprehensive tests")
        print("  - See README.md for usage examples")
        print("=" * 70)
        return 0
    else:
        print("FAILURE: Some verification checks failed.")
        print("Please install missing dependencies or fix errors above.")
        print("=" * 70)
        return 1

if __name__ == '__main__':
    sys.exit(main())
