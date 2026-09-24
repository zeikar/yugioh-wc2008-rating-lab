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
- **Card ids** are Konami's card database ids, YGOPRODeck's `konami_id`
  (4007 is Blue-Eyes White Dragon) [ROM, 2026-09-24; YGO].
  - The ROM names them in `Data_arc_pac/bin2.pac`, a Konami archive.
    `card_intid.bin` maps id − 3900 to a card index. `card_indx_e.bin` gives
    each index's name offset, and `card_name_e.bin` holds the English names.
    The `_k` files are Korean (EUC-KR), `_j` Japanese.
  - There are 2033 cards, tokens included, with ids 3900–7403.
  - Against YGOPRODeck, 1904 names match exactly. Another 67 differ only in
    capitals ("Elemental Hero" vs "Elemental HERO"), and 40 are older names
    of the same cards. The other 22 are missing there, mostly tokens.

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
  - The blocks come in identical pairs. Each save writes one pair with the
    next version, taking turns between the pairs. In the owner's save, blocks
    3 and 4 had the higher version (1000000628, against 1000000627 in blocks
    1 and 2). A fresh fork starting at 1000000629 in blocks 1 and 2 then
    ended its 4 game saves at 633 in blocks 1 and 2 and 632 in 3 and 4. Read
    the block with the highest version whose CRC matches.
  - The game's LZ10 never refers back just 1 byte.
- **Writing a save** [emulator, 2026-09-24]: the game loads game data stored
  the same way. That means the next version over the older pair, LZ10 with
  no 1-byte references, and the CRC32. `wcsave.with_game_data` does this,
  and `tournament.py --fresh` starts a fork with it (§4, "Seen while driving
  it").

## 3. Decompressed game data

- **Rating table:** 78 u16 LE values at offset 0x396, one per singles CPU in
  the in-game list order. That is the order of `src/data/duelists.ts`.
  [owner's files, 2026-09-24]
  - Checked against the app on 2026-09-24: all 36 CPUs with a recorded
    rating match exactly, and the other 42 sit at their initial value.
  - The total is 94800, the documented initial sum (game.md §3.1).
- **DP:** the u32 LE at offset 0x24 [SE; confirmed in-game by the owner,
  2026-09-24]. The owner's save holds 35116 there, the DP the game shows.
- **Duelist unlock flags:** 16 bytes at offset 0x198C, one bit per CPU in the
  same list order, LSB first within each byte. [owner's files, 2026-09-24]
  - Checked against the app's `unlocked` flags for all 78 CPUs on 2026-09-24:
    every flag matches, 52 unlocked.

## 4. RAM

RAM holds the decompressed game data as one block at 0x0211468C, so every
offset in §3 maps straight onto RAM. [owner's files in melonDS DS,
2026-09-24]
- **Rating table:** 0x02114A22. Its 156 bytes match the save's table
  exactly, and it is the only match in the 4 MiB of main RAM.
- **DP:** 0x021146B0, the address the Action Replay code uses [AR]. It held
  35116, the owner's DP.
- **Duelist unlock flags:** 0x02116018–0x02116027, the §3 offset mapped
  onto RAM (0x0211468C + 0x198C = 0x02116018). It matches the Action Replay
  code's address [AR], and §3's check confirms it.
- **Duel state** [emulator, 2026-09-24]:
  - **LP:** each side's is kept twice.
    - The on-screen counters are int16: the left duelist's at 0x022CA200 and
      the right duelist's at 0x022CA204. They can go negative on overkill.
    - The duel board (below) holds the other copy, at 0x022CE2D0 (left) and
      0x022CF27C (right). It stops at 0, and is most likely the real LP.
    - The Action Replay LP code writes both left ones.
    - They can differ. In one CPU duel, the right side's board LP read 7200
      all duel while its counter and the screen showed 6600, likely because
      damage landed while the counter was still counting up to 8000.
  - **Seats:** the player can sit on either side. On the owner's save the player always had
    the first quarterfinal, on the left. On a fresh fork the player had the
    third quarterfinal's second seat, on the right. In CPU-vs-CPU duels both
    sides are CPUs.
  - **Is-CPU flags:** 0x022CBD94 for the left side and 0x022CBD98 for the
    right, 1 for a CPU and 0 for the player. They read 0/1 or 1/0 in the
    player's duel and 1/1 in a CPU-vs-CPU duel.
    - As a duel starts, both flags and both LP go to 0 together. Then the
      flags are set, while the LP count up to 8000.
    - The flags keep their values until the next duel starts. So
      rock-paper-scissors before the player's duel still shows the last duel's
      flags. Both are 0 before the first duel.
  - **Phase:** 0x022D126C, 0 = Draw … 5 = End. **Turn:** 0x022D1264, counting
    from 0.
  - **Setting the player's LP to 0** loses the duel at the next check (the
    Standby Phase): "YOU LOSE", then a results screen that waits for OK.
    `tournament.py` writes 0 to both of the player's side's LP. It
    does so only when the flags say the player's duel is on, and only on the
    side they give the player, since in a CPU duel the same addresses are a
    CPU's LP.
- **Duel board** [emulator, 2026-09-24]: one 0xFAC-byte struct per side,
  at 0x022CE2D0 (left) and 0x022CF27C (right), starting with that side's LP.
  `tools/emulator/board.py` reads it.
  - Header, u32 each: +0x00 LP, +0x0C hand count, +0x10 deck count, +0x14
    graveyard count, +0x18 extra deck count, +0x1C banished count, +0x20 set
    once the side drew from an empty deck.
  - +0x2C is the win flag, set on the winner's side: 1 on LP, 2 by deck-out,
    3 with Exodia. Code 3 was seen once in 270 CPU duels: Marcel Bonaparte
    held all five pieces in hand. No other value has been seen.
  - Card lists of u32 card words, as many as the count: hand at +0x120, deck
    at +0x3A0 (top card first), extra deck at +0x620, graveyard at +0x710
    (newest last), banished at +0xA80.
  - Zones: 11 of 0x14 bytes from +0x30. Zones 0–4 are monsters, 5–9 spells
    and traps, 10 the field spell. Word 0 is the card word, bit 16 of word 1
    is Defense Position, and bit 0 of word 2 is face-up. A zone belongs to
    its card's controller. The right side's zones are drawn mirrored: zone
    *n* in screen column 4−*n*.
  - A card word holds the card id in bits 0–12, the owner in bit 13 (1 =
    right) and an instance number in bits 22–31. Mid-action a zone's card id
    can read 0 while the instance stays; the loaded deck gives it back.
  - The loaded decks: 0x022CBDA8 left, 0x022CBEB0 right. u32 main and extra
    counts at +0 and +8, then u16 card ids: the main deck's from +0x0C, the
    extra deck's from +0xCA. Instance *n* is main card *n*, then the extra
    deck in order; tokens get higher numbers.
  - The board stays as the duel ended until the next duel clears it,
    1260–1740 frames after the ratings change. So it can still be read when
    they change. In 7 duels, the board and the turn counter stayed exactly
    the same all that time.
  - Checked against screenshots at 4 frames, and at the end of 6 CPU duels
    against both duelists' decks in `src/data/decks.ts`.
- **When it appears:** at boot the game fills this area with fresh-game
  defaults (DP 1500, title screen showing NEW GAME). The block appears once
  the save is loaded, after pressing A on the title screen.

**When ratings change in RAM** (two CPU duels watched, 2026-09-24): the
table still holds the old ratings when a CPU duel's result shows. Both CPUs'
new ratings land 1–8 s later, during the transition back to the bracket:
before the bracket shows them and long before the game saves. Every change
was exactly zero-sum. The player's own duel never changed its CPU
opponent's rating.

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
- libretro.py's screenshots are RGBA bytes, whatever the core's pixel format.
  Reading them as BGR swaps red and blue, which turns the yellow rating
  triangle cyan.

### Seen while driving it

- **Paying a tournament's entry fee saves the game** at once, with the fee
  already taken.
- **The entrant draw didn't depend on input timing.** From the same emulator
  state, a Level 1 tournament drew the same 8 entrants even with 37 or 77
  extra frames before the inputs. What seeds the draw is unknown. Runs forked
  from one save may play the same tournaments, so check they diverge before
  treating them as independent data.
- **Pressing A during CPU duels changed nothing** in the one replay tried.
  The same bracket played with and without it gave the same first two
  duels, to the rating.
- **A fresh fork** (`tournament.py --fresh`): every CPU unlocked at its
  initial rating, and 9,999,999 DP, the Action Replay code's Max DP [AR].
  - The game loads it and takes entry fees from that DP.
  - The first time into the World Championship menu shows "A new Wardrobe has
    been added." and "A new Duel Disk has been added.", one OK each. Closing
    them saves nothing, so they come back on every boot until the game saves,
    as the first tournament's fee does. After that they're gone.
  - Tapping (128, 98) on the bottom screen hits their OK. On the plain menu
    that spot is empty, so the route always taps it a few times.
- **Duel results do vary.** Two replays from the same bracket, with
  different inputs in the player's duel, gave a different winner in a later
  CPU duel (game.md §3.1).

## 5. Sources

- SE (yugioh-sav-editor, WC2008 save profile): https://github.com/chaye7417/yugioh-sav-editor
- AR (DeadSkullzJr's Action Replay codes, mirrored for melonDS): https://github.com/Lyrx997/MelonDS-Desktop-Cheats
- YGO (YGOPRODeck card database API, with Konami ids): https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes
