# Galaxy Miner ElevenLabs sound design

The executable prompt catalog in `generate.js` is authoritative. This document
summarizes the weapon and UI/menu refresh; unrelated categories retain their
existing definitions.

## Shared generation direction

Weapon prompts request a dry, isolated, game-ready firing one-shot with a clean
cutoff, punchy mono-compatible mix, and no projectile flight, target impact,
ricochet, explosion, destruction, reverb, ambience, music, or voice.

UI prompts request a dry, isolated spacecraft-interface one-shot with a clean
cutoff and a restrained, non-fatiguing, mono-compatible mix. They exclude
ambience, music, voice, reverb, echo, and long tails.

ElevenLabs receives a 0.5-0.8 second source duration (the API minimum is 0.5
seconds). The generator then removes leading silence, trims each cue to its
active duration with a short fade, and normalizes the result to a safe peak.
Requests pin `eleven_text_to_sound_v2`, use prompt influence `0.6`, and request
`mp3_44100_128`.

## Player weapons

Each base file is a fallback. The variation pattern is the normal runtime path.

| ID | Base file | Variations | Active | Audible identity |
| --- | --- | ---: | ---: | --- |
| `weapon_t1` | `weapon_player_t1.mp3` | `weapon_player_t1_01..03.mp3` | 90 ms | Compact cyan pulse blaster; needle-sharp electronic snap, bright glassy zap, tiny power-cell chirp. |
| `weapon_t2` | `weapon_player_t2.mp3` | `weapon_player_t2_01..03.mp3` | 120 ms | Paired cyan emitters; two laser snaps about 20 ms apart with crisp electrical transients. |
| `weapon_t3` | `weapon_player_t3.mp3` | `weapon_player_t3_01..03.mp3` | 160 ms | Green plasma-orb launcher; firm capacitor punch, dense rounded bloom, fast ion hiss, weighty low-mid body. |
| `weapon_t4` | `weapon_player_t4.mp3` | `weapon_player_t4_01..03.mp3` | 160 ms | Orange thermal beam ignition; hard contact snap, compact searing buzz, precise power-gate cutoff. |
| `weapon_t5` | `weapon_player_t5.mp3` | `weapon_player_t5_01..05.mp3` | 150 ms | Tesla cannon; violent coil snap, branching electrical arcs, brief high-voltage crackle without thunder or sustained hum. |

## NPC faction weapons

| ID | Base file | Variations | Active | Audible identity |
| --- | --- | ---: | ---: | --- |
| `npc_pirate` | `weapon_npc_pirate.mp3` | `weapon_pirate_01..03.mp3` | 140 ms | Brutal cannon muzzle report; hot propellant punch, scorched-metal crack, short spark spit. |
| `npc_scavenger` | `weapon_npc_scavenger.mp3` | `weapon_scavenger_01..03.mp3` | 130 ms | Jury-rigged laser; uneven double energy spit, loose relay tick, unstable capacitor crackle. |
| `npc_swarm` | `weapon_npc_swarm.mp3` | `weapon_swarm_01..03.mp3` | 160 ms | Bio-projectile launch; chitin click, wet membrane snap, deep vacuum pulse, short tendril hiss; non-vocal. |
| `npc_void` | `weapon_npc_void.mp3` | `weapon_void_01..03.mp3` | 180 ms | Focused Void beam; inverse-suction transient, dense low pulse, cold crystalline edge, dimensional snap. |
| `npc_miner` | `weapon_npc_miner.mp3` | `weapon_rogue_miner_01..03.mp3` | 160 ms | Repurposed mining laser; heavy contactor clack, abrasive cutting arc, brief motor strain. |

This is 10 weapon families and 42 generated MP3 assets. `npc_weapon_rogue`
and `npc_weapon_rogue_miner` intentionally share the Rogue Miner family.

## UI and menu sounds

| ID | File | Active | Audible identity |
| --- | --- | ---: | --- |
| `ui_click` | `ui_click.mp3` | 60 ms | Tiny polymer button click plus one clean high digital tick. |
| `ui_hover` | `ui_hover.mp3` | 40 ms | Very quiet capacitive hover tick and soft glassy blip, with no bass. |
| `ui_panel_open` | `ui_panel_open.mp3` | 180 ms | Rising filtered-data sweep, two scan ticks, soft digital latch. |
| `ui_panel_close` | `ui_panel_close.mp3` | 160 ms | Descending inverse data sweep and muted latch. |
| `ui_notification` | `ui_notification.mp3` | 220 ms | Neutral two-pulse alert; rounded ping and brighter answer ping. |
| `ui_error` | `ui_error.mp3` | 200 ms | Two low dissonant refusal pulses ending in a muted terminal thunk. |
| `ui_success` | `ui_success.mp3` | 240 ms | Rounded confirmation ping followed by a brighter resolved sparkle. |
| `ui_warning` | `ui_warning.mp3` | 300 ms | Two warning beeps over one firm low pulse; caution, not emergency. |
| `ui_info` | `ui_info.mp3` | 140 ms | Neutral data ping with a tiny soft interface click. |
| `ui_tab_switch` | `ui_tab_switch.mp3` | 70 ms | Tiny lateral digital swipe ending in a mechanical detent. |
| `ui_upgrade` | `ui_upgrade_purchase.mp3` | 400 ms | Mechanical lock clunk, rising power surge, bright energy seal. |
| `market_list` | `market_list.mp3` | 160 ms | Scanner click, upward data chirp, final register tick. |
| `market_buy` | `market_buy.mp3` | 220 ms | Terminal stamp and short descending digital debit tone. |
| `market_sell` | `market_sell.mp3` | 240 ms | Terminal tick, ascending credit-arrival cascade, final ping. |
| `market_cancel` | `market_cancel.mp3` | 150 ms | Muted reverse data chirp and soft mechanical release. |
| `chat_receive` | `chat_message.mp3` | 130 ms | Two soft, rounded radio-data pips without static or ringtone. |
| `slider_tick` | `slider_tick.mp3` | 30 ms | Extremely short, quiet, unpitched mechanical detent. |
| `toggle_on` | `toggle_on.mp3` | 80 ms | Physical switch snap and short rising activation blip. |
| `toggle_off` | `toggle_off.mp3` | 80 ms | Physical switch snap and softer falling deactivation blip. |
| `relic_acquired` | `relic_acquired.mp3` | 480 ms | Low energy bloom, layered glass shimmer, final harmonic ping. |

The `ui` collection includes all 20 files above, including the retained generic
`ui_notification` cue even though it currently has no runtime trigger.

## Explicit exclusions

The weapon/UI collection never selects:

- `destruction`
- `destruction_variants`
- `base_destruction`
- boss death sounds, including `queen_death` and `void_leviathan_death`

NPC destruction/explosion prompts and assets are intentionally unchanged.
