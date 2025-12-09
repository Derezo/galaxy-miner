"""
Sound generators for Galaxy Miner 8-bit audio system.

Each module generates a category of game sounds using the core audio engine.
"""

from . import weapons
from . import npc_weapons
from . import impacts
from . import destruction
from . import bosses
from . import mining
from . import environment
from . import ui
from . import movement

__all__ = [
    'weapons',
    'npc_weapons',
    'impacts',
    'destruction',
    'bosses',
    'mining',
    'environment',
    'ui',
    'movement'
]
