#!/usr/bin/env python3
"""
Galaxy Miner Audio Generator - Main Entry Point

Batch generation script that creates all ~200 game sounds using the core audio
engine and generator modules.

Usage:
    python main.py              # Generate all sounds
    python main.py --category weapons    # Generate specific category
    python main.py --list       # List available categories
"""

import sys
import time
import argparse
from pathlib import Path
from typing import Tuple

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Import all generator modules
try:
    from generators import weapons
    from generators import npc_weapons
    from generators import impacts
    from generators import destruction
    from generators import bosses
    from generators import mining
    from generators import environment
    from generators import ui
    from generators import movement
    GENERATORS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import generator modules: {e}")
    GENERATORS_AVAILABLE = False


# Category registry with sound counts
CATEGORIES = {
    'weapons': {
        'module': weapons,
        'count': 20,
        'description': 'Player weapon sounds (5 tiers with variations)'
    },
    'npc_weapons': {
        'module': npc_weapons,
        'count': 15,
        'description': 'NPC faction weapon sounds (5 factions × 3 variations)'
    },
    'impacts': {
        'module': impacts,
        'count': 30,
        'description': 'Hit sounds (shield/hull × 5 tiers × 3 variations)'
    },
    'destruction': {
        'module': destruction,
        'count': 25,
        'description': 'Death/explosion sounds (5 factions × 3 sizes + player)'
    },
    'bosses': {
        'module': bosses,
        'count': 8,
        'description': 'Boss sounds (Queen phases, attacks, death)'
    },
    'mining': {
        'module': mining,
        'count': 12,
        'description': 'Mining sounds (drills, pickups, completion)'
    },
    'environment': {
        'module': environment,
        'count': 10,
        'description': 'Ambient sounds (stars, wormholes, comets, etc.)'
    },
    'ui': {
        'module': ui,
        'count': 19,
        'description': 'UI interaction sounds (buttons, notifications, panels)'
    },
    'movement': {
        'module': movement,
        'count': 12,
        'description': 'Movement sounds (engines, boost, shields)'
    }
}


def print_banner():
    """Print generator banner."""
    print("=" * 70)
    print(" Galaxy Miner - 8-Bit Audio Generator".center(70))
    print("=" * 70)
    print()


def list_categories():
    """List all available sound categories."""
    print("Available sound categories:")
    print()

    total_sounds = 0
    for name, info in sorted(CATEGORIES.items()):
        count = info['count']
        desc = info['description']
        total_sounds += count
        print(f"  {name:15s} ({count:3d} sounds)  - {desc}")

    print()
    print(f"Total: {total_sounds} sounds across {len(CATEGORIES)} categories")
    print()


def generate_category(category_name: str) -> Tuple[int, float]:
    """
    Generate sounds for a specific category.

    Args:
        category_name: Name of the category to generate

    Returns:
        Tuple of (sounds_generated, time_taken)
    """
    if category_name not in CATEGORIES:
        print(f"Error: Unknown category '{category_name}'")
        print("Use --list to see available categories")
        return 0, 0

    category = CATEGORIES[category_name]
    module = category['module']
    expected_count = category['count']

    print(f"\n{'─' * 70}")
    print(f"Generating: {category_name}")
    print(f"Expected sounds: {expected_count}")
    print(f"{'─' * 70}")

    start_time = time.time()

    try:
        module.generate_all()
        elapsed = time.time() - start_time

        print(f"{'─' * 70}")
        print(f"Category '{category_name}' completed in {elapsed:.2f}s")
        print()

        return expected_count, elapsed

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\nError generating {category_name}: {e}")
        import traceback
        traceback.print_exc()
        return 0, elapsed


def generate_all():
    """Generate all sound categories."""
    print_banner()

    print("Starting batch generation of all sounds...")
    print(f"Categories to generate: {len(CATEGORIES)}")
    print()

    start_time = time.time()
    total_sounds = 0
    successful_categories = 0

    for category_name in sorted(CATEGORIES.keys()):
        sounds_generated, _ = generate_category(category_name)

        if sounds_generated > 0:
            total_sounds += sounds_generated
            successful_categories += 1

    elapsed = time.time() - start_time

    # Final summary
    print()
    print("=" * 70)
    print(" Generation Complete".center(70))
    print("=" * 70)
    print(f"  Total sounds generated: {total_sounds}")
    print(f"  Successful categories: {successful_categories}/{len(CATEGORIES)}")
    print(f"  Total time: {elapsed:.2f}s")
    print(f"  Average: {elapsed/total_sounds:.3f}s per sound")
    print()
    print(f"  Output directory: ./output/")
    print("=" * 70)


def main():
    """Main entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description='Galaxy Miner 8-bit audio generator',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--category', '-c',
        help='Generate only a specific category'
    )

    parser.add_argument(
        '--list', '-l',
        action='store_true',
        help='List available categories'
    )

    args = parser.parse_args()

    if not GENERATORS_AVAILABLE:
        print("Error: Generator modules are not available.")
        print("Please ensure core audio modules are installed first.")
        return 1

    if args.list:
        print_banner()
        list_categories()
        return 0

    if args.category:
        print_banner()
        sounds, elapsed = generate_category(args.category)
        if sounds > 0:
            print(f"✓ Successfully generated {sounds} sounds in {elapsed:.2f}s")
            return 0
        else:
            print(f"✗ Failed to generate category '{args.category}'")
            return 1

    # Default: generate all
    generate_all()
    return 0


if __name__ == "__main__":
    sys.exit(main())
