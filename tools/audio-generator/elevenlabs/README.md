# ElevenLabs sound generator

This generator is the source of truth for Galaxy Miner's AI-generated audio
prompts. It targets ElevenLabs Sound Effects v2, writes 44.1 kHz 128 kbps MP3s,
and trims short weapon/UI cues with `ffmpeg` so rapid fire and repeated menu
input do not create long overlapping tails.

## Requirements

- Node.js 22 or newer
- `ffmpeg` available on `PATH`
- `ELEVENLABS_API_KEY` exported in the environment for live generation

The API key is never accepted as a command-line option or written to output.
Listing, validation, tests, and dry runs do not require a key.

## Safe weapon and UI workflow

Run commands from this directory:

```bash
npm test
npm run validate
npm run dry-run:weapon-ui
npm run smoke
npm run generate:weapon-ui -- --force
npm run verify:weapon-ui
```

`smoke` makes one real API request for the Tier 1 base weapon and writes it to
`/tmp/galaxy-miner-elevenlabs-smoke`. Validate that candidate before running the
full refresh. To stage any selection elsewhere, append
`--output-dir /absolute/candidate/path`.

The `weapon-ui` collection contains only:

- 10 weapon families expanded to 42 assets: 10 fallback MP3s and 32 runtime
  variations (player tiers 1-5 plus Pirate, Scavenger, Swarm, Void, and Rogue
  Miner)
- 20 UI/menu assets from `ui`, `ui_extended`, and `ui_extras`

It deliberately excludes `destruction`, `destruction_variants`,
`base_destruction`, and the boss category. Do not use a forced tier generation
for a weapon/UI refresh because tiers also contain unrelated sounds.

## Useful commands

```bash
node generate.js --validate
node generate.js --list
node generate.js --dry-run --collection weapons
node generate.js --force --collection weapons
node generate.js --force --collection ui
node generate.js --single weapon_t1 --base-only --output-dir /tmp/sfx
```

Existing files are skipped unless `--force` is present. A generation failure
returns a nonzero exit code and does not replace the existing asset. Requests
time out, retry rate limits/transient server failures, validate MP3 data, remove
leading silence, trim the active cue, normalize it to a safe peak, and replace
the destination atomically. `postprocess:weapon-ui` reapplies that local
processing without spending API credits; it is useful for migrating candidates
made by an older version of the script.

## Prompt design

Weapon prompts describe the audible attack/body/cutoff for one muzzle or
launcher event. They explicitly separate firing from projectile flight,
impacts, and explosions. Each family has a short `activeDuration` (30-480 ms for
the refreshed weapon/UI scope); ElevenLabs receives its supported minimum clip
length and `ffmpeg` performs the final trim with a short fade.

UI prompts share a restrained dry spacecraft-console palette, then distinguish
click, hover, panel, notification, transaction, chat, toggle, and reward
semantics. Prompts are validated against ElevenLabs' 450-character limit.

The executable catalog in [`generate.js`](./generate.js) is authoritative.
[`SOUND_DESCRIPTIONS.md`](./SOUND_DESCRIPTIONS.md) is a human-readable design
reference.
