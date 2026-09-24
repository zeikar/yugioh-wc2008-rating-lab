# WC2008 Internals

How *Yu-Gi-Oh! World Championship 2008* stores the data this app tracks: the
ROM, the save file and RAM. Use it to read ratings from a save or an
emulator. For the game as seen in play, see [game.md](game.md); the CPU
roster is in [roster.md](roster.md).

Confidence labels follow game.md. **[owner's files]** means checked directly
against the owner's ROM and save. Source keys are listed in §5.

## 1. Version

- The owner plays the Korean release on the Delta emulator for iOS. [owner's
  files, 2026-09-24]
  - Game code `YG8K`, ROM version 0, published by Daewon Media.
  - The owner's ROM has SHA-1 `1b5ad981bafbb04130f3a676b23bbcf6c69e383f`.
- The other releases are `YG8J` (JP), `YG8E` (US) and `YG8P` (EU) [single:
  AR]. Addresses differ between releases, so everything below applies to
  `YG8K` only unless it says otherwise.

## 2. Save file

- **File:** Delta exports the save as `.dsv`, but the file is the raw
  256 KiB (262144-byte) save with no DeSmuME footer. Other emulators take it
  as is; for melonDS, rename it to `.sav`. [owner's files, 2026-09-24]
- **Layout** [owner's files, 2026-09-24; the block offsets and the 256 KiB
  size match SE's WC2008 profile]:
  - Four blocks, at 0x28000, 0x2AB00, 0x2D600 and 0x30100. Each header is
    the magic `TDGY`, then three u32 LE values: a version, the compressed
    length, and the CRC32 of the compressed bytes.
  - The payload is LZ10 (Nintendo LZ77, type 0x10) and decompresses to
    0x26F0 (9968) bytes.
  - The blocks come in identical pairs. In the owner's save, blocks 3 and 4
    had the higher version. Read the block with the highest version whose CRC
    matches.

## 3. Decompressed game data

- **Rating table:** 78 u16 LE values at offset 0x396, one per singles CPU in
  the in-game list order. That is the order of `src/data/duelists.ts`.
  [owner's files, 2026-09-24]
  - Checked against the app on 2026-09-24: all 36 CPUs with a recorded
    rating match exactly, and the other 42 sit at their initial value.
  - The total is 94800, the documented initial sum (game.md §3.1).
- **DP:** the u32 LE at offset 0x24 [SE; confirmed in-game by the owner,
  2026-09-24]. The owner's save holds 35116 there, the DP the game shows.

## 4. RAM

RAM holds the decompressed game data as one block at 0x0211468C, so every
offset in §3 maps straight onto RAM. [owner's files in melonDS DS,
2026-09-24]
- **Rating table:** 0x02114A22. Its 156 bytes match the save's table
  exactly, and it is the only match in the 4 MiB of main RAM.
- **DP:** 0x021146B0, the address the Action Replay code uses [AR]. It held
  35116, the owner's DP.
- **Duelist unlock bitfield:** 0x02116018–0x02116027 [single: AR, not
  checked].
- **When it appears:** at boot the game fills this area with fresh-game
  defaults (DP 1500, title screen showing NEW GAME). The block appears once
  the save is loaded, after pressing A on the title screen.

Not yet checked: whether the table in RAM changes the moment a CPU duel
ends, or only when the game saves.

### Reading it in an emulator

Checked on 2026-09-24 with the melonDS DS libretro core (v1.3.1,
macOS arm64) driven from Python by libretro.py (0.12.0).
`tools/emulator/probe.py` does all of this:
- The core boots the ROM with its built-in BIOS and firmware. The core
  options are `melonds_boot_mode: direct`, `melonds_console_mode: ds` and
  `melonds_sysfile_mode: builtin`.
- The core leaves the save to the frontend. Copy the save file's bytes into
  `RETRO_MEMORY_SAVE_RAM` before the first frame; otherwise the game starts
  with NEW GAME. For the same reason, the frontend has to write that memory
  back to a file itself to keep what the game saves.
- Main RAM is `RETRO_MEMORY_SYSTEM_RAM`, where offset 0 is 0x02000000.

## 5. Sources

- SE (yugioh-sav-editor, WC2008 save profile): https://github.com/chaye7417/yugioh-sav-editor
- AR (DeadSkullzJr's Action Replay codes, mirrored for melonDS): https://github.com/Lyrx997/MelonDS-Desktop-Cheats
