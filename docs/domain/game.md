# WC2008 Game Mechanics

What is known about the parts of *Yu-Gi-Oh! World Championship 2008* (DS,
Konami, JP release 2007-11-29) that this app tracks: tournament mode, ratings,
and the systems around them. Gathered from community sources on 2026-09-23.
The CPU roster is in [roster.md](roster.md).

Confidence labels:
- **[confirmed]**: two or more independent sources agree.
- **[single]**: only one source says it.
- **[unclear]**: sources conflict, or the point is an inference.
- **unknown**: nothing found.

Source keys are listed in §8.

## 1. Game structure

- **Two main modes.** [confirmed: W1, K1, Y1]
  - **Duel World** (デュエルワールド): the story mode. Its six worlds are Grace,
    Sunlight, Civilization, Darkness, Order and Chaos.
  - **World Championship** (ワールドチャンピオンシップ, "WC mode"): Free Duel,
    Tournament, Shop, deck building, and Wi-Fi.
- **Unlocking WC opponents.** Most WC-mode CPU duelists unlock when you beat
  their matching Duel World duelist, usually 5 times. [confirmed: A1, W1, N1]
- **New in WC2008:** Tournament mode was added. [confirmed: W1, R1]
- **Free Duel sub-modes.** [confirmed: G2, A3]
  - CPU Duel (singles).
  - CPU Tag Duel, from the World of Darkness onward.
  - View CPU Duel and View CPU Tag Duel, CPU-vs-CPU spectating, unlocked at 80%
    card collection.
  - Recipe Duel, unlocked at 90%.

## 2. Tournament mode

### 2.1 Format
- **Size:** 8 entrants, **the player plus 7 CPUs**. [confirmed: G1, R1, 5CH]
- **Structure:** single elimination over 3 rounds: quarterfinal (4 duels),
  semifinal (2) and final (1). Winning the tournament takes 3 wins.
  [confirmed: G1, R1, 5CH]
- **Per round:** probably a single duel rather than best-of-3 [unclear, leaning
  single duel].
- **LP:** every duel starts at full LP; nothing carries over between rounds
  [owner, 2026-09-23].
- **CPU-vs-CPU bracket duels:** these are simulated and can be watched at
  Normal or Fast speed. [confirmed: R1, G1]
- **After the player is knocked out,** the tournament still plays through to
  a CPU champion [owner, 2026-09-23]. Losing the first duel therefore gives 6
  CPU-vs-CPU duels, against 4 when the player wins the tournament.
- **Surrender** is available only from turn 10 of a duel. The quick way to
  lose is to pass every turn [owner, 2026-09-23].
- **Opponents:** drawn at random, and the player cannot choose them
  [single: R1]. Whether only *unlocked* duelists are eligible is unclear. It
  is implied by the unlock requirement.

### 2.2 Levels and unlocks
| Tournament | Unlock condition | Confidence |
|---|---|---|
| Level 1 (some EN guides say "Easy") | 15 duelists from the LV1 pool unlocked | confirmed |
| Level 2 ("Medium") | Level 1 open, plus 15 LV2-pool duelists unlocked | confirmed |
| Level 3 ("Hard") | Level 2 open, plus 20 LV3-pool duelists unlocked | confirmed |
| Tag Tournament | 15 tag teams unlocked | confirmed |

Sources: A1, G2, G3, B1. atwiki's wording:

> レベル1：トーナメントLV1のデュエリストが15人出現
> レベル2：レベル1出現後、トーナメントLV2のデュエリストが15人出現
> レベル3：レベル2出現後、参加デュエリストが20人出現
> タッグ　：参加タッグが15組出現

- **Pool sizes:**
  - LV1: 24 duelists.
  - LV2: 24 duelists.
  - LV3: 30 duelists (6 monsters plus all 24 anime characters).

  Membership is fixed per duelist and is **independent of rating**.
  [confirmed] Full lists are in [roster.md](roster.md).
- **Pools are not strict: higher levels mix in lower-level duelists.**
  - The owner's save has Level 2 tournaments with LV1 duelists in them: Reaper
    on the Nightmare, Petit Dragon, Spirit of the Pharaoh and Dark Scorpion -
    Meanae.
  - This matches a real LV3 bracket with an LV2 duelist (5CH), and G1's list
    of LV1 duelists met in Level 2.
  - So a duelist's tournament level is its documented classification and
    unlock tier, **not** a limit on where it can appear. How entrants are
    actually selected is something to observe, not assume.
- **Tournament level ≠ Free Duel list page.** The Free Duel opponent screen
  groups opponents into many numbered pages or levels. That is unrelated to
  tournament levels 1–3, so never infer tournament level from it.
- **Tag tournament:** its bracket size and format are not documented. A 5CH
  question hints that tag tournaments may also have levels. [unclear]

### 2.3 Rewards
| Reward | Condition | Confidence |
|---|---|---|
| Pack 邪まなる強大な力 | Win Level 1 five times | confirmed (A5, G1, G2) |
| Pack 深遠の底にある魔 | Win Level 2 five times | confirmed (A5, G1, G2) |
| Pack 雲間から射す光 | Win Level 3 five times | confirmed (A5, G2) |
| Red Academy Disk | Win the Tag Tournament once | confirmed (G2, B1, GU) |
| Moonlight / Clerk Uniform (outfit) | Win Levels 1–3 and Tag | confirmed (G2, B1) |

## 3. Ratings

### 3.1 CPU ratings
- **Where it shows.** Every CPU has a rating (レート). It appears on the
  pre-duel opponent card as a number next to a small yellow triangle icon.
  [confirmed: S1 screenshot, B2] The triangle points down, shaped like the
  Millennium Puzzle, as every opponent card in roster.md §6 shows.
- **Documented starting values:**
  - Singles monsters: 600 to 1800 in steps of 150.
  - Anime characters: 1250.
  - Tag teams: 800 to 1600.
  - Story-mode worlds: 500 to 1500.
  - Downloadable (DL) Wi-Fi opponents: 850 to 1500.
  - Details are in [roster.md](roster.md).
- **Do they change? Public sources are silent.** Every community table lists
  one number per duelist, which looks like the value on a fresh save. No
  source says ratings move, and none says they stay fixed.
- **Confirmed by the owner's own play (2026-09-23):**
  - CPU ratings form a **persistent, evolving ecosystem**. They change after
    **every CPU-vs-CPU duel**, and the new value persists after the
    tournament.
  - **Only CPU-vs-CPU duels** change them. Duels involving the player leave
    the CPU's rating untouched.
  - CPU-vs-CPU bracket duels are simulated for real and **cannot be
    skipped**, only sped up, so every one is a rating event.
  - The ratings are readable on the in-game screens during a tournament, so
    they can be recorded live.
  - Tournament duels also count toward the game's own per-CPU W/L records.
    The app's W/L covers only the matches it recorded, so it can differ.
- **CPU-vs-CPU duels are zero-sum.** The winner takes exactly the points the
  loser loses. Every observed pair fits, and the owner has fixed this as a rule
  of the app (2026-09-23). Data that contradicts it is treated as a bug.
- **The whole ecosystem conserves rating since a fresh save.** At roster
  setup (2026-09-23) the owner recorded the current rating of 35 CPUs.
  - Their ratings had moved by between −354 and +620 since a fresh save.
  - Yet their current ratings add up to exactly their documented initial
    sum: **40200 = 40200**.
  - This is consistent with every duel since the save began being zero-sum.
  - Strictly, it shows no net points flowed between these 35 and the other
    17 unlocked CPUs. Most likely those 17 have simply not played; they could
    only have traded points among themselves.
  - Barring errors that happen to cancel out, the documented initial ratings
    of those 35 CPUs are right as well.

  | Winner (pre → post) | Loser (pre → post) | N | gap (winner − loser pre) |
  |---|---|---|---|
  | Blowback Dragon 1350 → 1433 | Cloudian - Poison Cloud 1392 → 1309 | 83 | −42 |
  | Manju of the Ten Thousand Hands 1561 → 1584 | Reaper on the Nightmare 792 → 769 | 23 | +769 |
  | Elemental Hero Lady Heat 1290 → 1370 | Great Shogun Shien 1296 → 1216 | 80 | −6 |
  | Blowback Dragon 1433 → 1526 | Manju 1584 → 1491 | 93 | −151 |

- **N depends on the pre-match ratings.** Beating a much weaker CPU moves few
  points; an upset moves many. The formula is unknown, and it should not be
  called Elo until the data shows it.
- **Candidate hypothesis, fitted to only these 4 pairs:** a logistic curve,
  `N = K / (1 + 10^(gap / S))`, reproduces all four exactly.
  - It fits with K ≈ 158–160 and S ≈ 1000, using integer rounding (round,
    floor or ceil, each for a slightly different K and S).
  - The standard Elo scale S = 400 does **not** fit: it predicts about 2
    instead of 23 for the +769 gap.
  - With 2 free parameters, 4 points are suggestive, not proof. More pairs,
    especially large negative gaps (big upsets), will confirm or break it.
- **Snapshots are valid data on their own.** A reading like "Spirit of the
  Pharaoh is 1141 now" is worth recording even if the matches that led there
  are unknown. For example, the owner saw Spirit of the Pharaoh (initial 1050)
  at 1216, then 1120, 1073 and 1141.
- **Initial rating is a baseline.** It is not a strength measure. Examples
  from the owner's save:
  - Elemental Hero Lady Heat: initial 750, seen above 1300.
  - Gravekeeper's Chief: initial 1050, seen above 1600.
  - Cloudian - Poison Cloud: initial 1500, fell a long way after repeated
    losses.
  - Blowback Dragon: initial 1350, rose above 1500 and has repeatedly reached
    finals.
- **Deck variance is large.** Bricked hands, ritual and tribute requirements,
  coin and dice effects, AI choices and matchups all matter. Manju's ritual
  deck is strong when it works but can brick. Cloudian is hard for a human
  but does poorly against CPUs. So long-run results matter, not single duels.

### 3.2 The player's rating
- The player has a rating too, shown with the same yellow triangle. [confirmed:
  B2]
- It is documented as rising only through Nintendo Wi-Fi **ranked** duels
  [single: B2]. One blogger shows it at 0 [single: S1]. Nintendo WFC has shut
  down, so offline play most likely never changes it.
- **Consequence for the app:** the player is a tournament entrant with no
  tracked rating. Rating statistics cover CPUs only.

### 3.3 Duel Points (DP)
- **What DP is:** the in-game currency. You start with 1500 DP, a booster pack
  costs 150 DP, and a structure deck costs 2000 DP. [confirmed]
- **Win bonus.** Each win pays a "デュエリスト" bonus of **opponent rating ÷
  5** [single: A6]. The page warns that its table is partly carried over from
  WC2007.
- **Other bonuses** on the same page: duel count ÷ 10, win streak − 1, tag
  +10, and various card-condition bonuses [single: A6].
- **Tournament wins:** whether they pay DP the same way is unknown.
- **A possible research angle:** if the rating ÷ 5 bonus uses the *current*
  rating, the DP from beating a CPU is an indirect reading of its rating.

## 4. Related systems

- **Stone-monument ("seal") challenges:** win after summoning a specific card.
  Clearing them unlocks most anime characters. [confirmed: AT90]
- **Beating a WC duelist 10 times** makes them available as a tag partner.
  [confirmed: Y1, A2]
- **Free Duel pack unlocks** depend on how many duelists you have beaten 5
  times. Tournament duels probably count toward this. [unclear: G1 wording]
- **View CPU Duel:** CPU-vs-CPU outside tournaments. Whether these duels
  also move ratings is still open (§6 Q2).

## 5. Terminology

| Concept | EN | JP |
|---|---|---|
| Story mode | Duel World | デュエルワールド |
| Main mode | World Championship / WC mode | ワールドチャンピオンシップ |
| Tournament | Tournament Level 1/2/3 (guides also say Easy/Medium/Hard), Tag Tournament | トーナメント レベル1・2・3 / タッグトーナメント |
| Rounds | Quarterfinal / Semifinal / Final (generic; in-game labels unconfirmed) | 1回戦 / 準決勝 / 決勝 (generic) |
| Rating | Rating (inverted yellow triangle icon) | レート / レーティング |
| Currency | DP, Duel Points | DP (デュエルポイント) |
| Win bonus | Victory bonus | 勝利ボーナス |
| Champion | Win the tournament | 優勝 |
| Downloadable opponent | Ghost / duelist image | デュエリストイメージ |
| Spectating | View CPU Duel | 観戦 |

The Korean release's labels are not researched yet.

## 6. Open questions to answer in-game

**Answered (owner, 2026-09-23):**
- Ratings change per duel.
- Only CPU-vs-CPU duels count.
- The change is zero-sum (fixed as a rule).
- N depends on the pre-match ratings (see the candidate curve in §3.1).
- Ratings are readable in-game during a tournament.
- CPU duels cannot be skipped.
- Higher levels mix in lower-level duelists.
- LP does not carry over between rounds; every duel starts fresh.
- The tournament continues to a CPU champion after the player is knocked out.

**Still open:**

1. **What is the exact formula for N?** Does the logistic candidate
   (K ≈ 160, S ≈ 1000) hold for more pairs, and what are its rounding and any
   floor or cap? Does anything besides the rating gap matter? The app's
   transfer table (MVP §7.3) is built to answer this.
2. **Do CPU-vs-CPU duels outside tournaments change ratings?** For example,
   View CPU Duel. If they do, ratings drift between tournaments. The app's
   continuity check flags this.
3. **Bracket:** is there a bracket screen, and what order are the quarterfinal
   pairings in?
4. **Entrants:** are the 7 CPUs always distinct? How are they drawn: which
   lower levels mix in, and how often? Are only unlocked duelists eligible?
   Can DL duelists appear?
5. **Format:** one duel per round or best-of-3?
6. **Labels:** what are the in-game names for levels, rounds and rating in the
   version you play (JP, EN or KR)?
7. **Initial values:** Heraklinos (1800?) and all anime characters at 1250?
   Dark Magician Girl (600) and Kozaky (1350) are confirmed.
8. **Your own rating:** is it 0, and does it ever change offline?

## 7. What this means for the app

- A tournament is exactly **8 entrants: the player plus 7 CPUs**, and **7
  matches**: 4 quarterfinals, 2 semifinals and 1 final.
- **The player is an entrant, not a rated duelist.** Matches can involve the
  player, but rating statistics and diagnostics use CPUs only.
- **A tournament's level and a duelist's classification are separate facts.**
  Never validate entrants against the classification. Record who actually
  appeared, and let the Research page show the mix.
- **Ratings change only in CPU-vs-CPU duels.** So a tournament's rating data
  is complete with:
  - each CPU's rating at entry
  - one CPU's rating after each CPU-vs-CPU match, with the opponent filled in
    by zero-sum and marked derived
- **Snapshots stand alone.** A rating reading with no known match is valid
  data.
- **Same name ≠ same entity.** DL "ghost" and tag versions reuse names (for
  example a DL Blowback Dragon) but have their own decks and ratings. If they
  are ever added, they get separate IDs.
- **Tag tournaments, DL opponents and Duel World** are out of scope for the
  MVP.

## 8. Sources

- W1 (ja.wikipedia): https://ja.wikipedia.org/wiki/遊☆戯☆王デュエルモンスターズ_WORLD_CHAMPIONSHIP_2008
- K1 (Konami JP product page): https://www.konami.com/games/jp/ja/products/yugioh_wcs2008_ds/
- Y1 (Yugipedia game page): https://yugipedia.com/wiki/Yu-Gi-Oh!_World_Championship_2008
- A1 (atwiki, 登場デュエリスト): https://w.atwiki.jp/1548908-08/pages/6.html
- A2 (atwiki, よくあるQ&A): https://w.atwiki.jp/1548908-08/pages/4.html
- A3 (atwiki, 情報裏技等): https://w.atwiki.jp/1548908-08/pages/16.html
- AT90 (atwiki, 登場デュエリスト人間): https://w.atwiki.jp/1548908-08/pages/90.html
- A5 (atwiki, パック): https://w.atwiki.jp/1548908-08/pages/10.html
- A6 (atwiki, 勝利ボーナス): https://w.atwiki.jp/1548908-08/pages/250.html
- N1 (namu.wiki): https://namu.wiki/w/유희왕%20월드%20챔피언십%202008
- G1 (GameFAQs, Paradisio v0.7): https://gamefaqs.gamespot.com/ds/943071-yu-gi-oh-world-championship-2008/faqs/51146
- G2 (GameFAQs, Ashurii): https://gamefaqs.gamespot.com/ds/943071-yu-gi-oh-world-championship-2008/faqs/52265
- G3 (GameFAQs, Chaet_legend): https://gamefaqs.gamespot.com/ds/943071-yu-gi-oh-world-championship-2008/faqs/54558
- GU (GameFAQs, Unlockables): https://gamefaqs.gamespot.com/ds/943071-yu-gi-oh-world-championship-2008/faqs/82172
- R1 (GameFAQs review 120950): https://gamefaqs.gamespot.com/ds/943071-yu-gi-oh-world-championship-2008/reviews/120950
- B1 (GameFAQs board, Unlocking FAQ): https://gamefaqs.gamespot.com/boards/943071-yu-gi-oh-world-championship-2008/40208469
- B2 (GameFAQs board, common questions): https://gamefaqs.gamespot.com/boards/943071-yu-gi-oh-world-championship-2008/40665054
- S1 (play diary with a rating screenshot): https://sin-koutrocom.jp/yugioh-wcs2008-diary6/
- 5CH (攻略スレ4): https://medaka.5ch.net/test/read.cgi/handygover/1221528604/
