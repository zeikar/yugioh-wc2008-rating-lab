# WC2008 CPU Roster

The CPU opponents of *Yu-Gi-Oh! World Championship 2008* (DS), gathered from
community sources on 2026-09-23. This is reference material for
`src/data/duelists.ts`. **Verify in-game before trusting any value.** For how
tournaments and ratings work, see [game.md](game.md).

Confidence labels:
- **[confirmed]**: two or more independent sources agree.
- **[single]**: only one source says it.
- **[unclear]**: sources conflict, or the point is an inference.
- **unknown**: nothing found.

Source keys (full URLs in §7):

| Key | Source |
|---|---|
| YP-D | Yugipedia "Duelists (WC08-VG)" |
| YP-C | Yugipedia per-character pages |
| AT6 | atwiki 「登場デュエリスト」 (monster duelists) |
| AT90 | atwiki 「登場デュエリスト人間」 (anime characters) |
| JAWP | ja.wikipedia article on the game |
| GF-M | GameFAQs CPU Opponent Deck List (Munckeyz) |
| GF-A | GameFAQs Walkthrough (Ashurii) |
| GF-C | GameFAQs Guide (Chaet_legend) |
| GF-P | GameFAQs Guide (Paradisio) |
| 5CH | 5ch 攻略スレ4 |

## At a glance

- **Singles roster:** 78 CPUs. 54 are monster "Duel Spirits" and 24 are anime
  characters (15 from GX, 9 from the original series). [confirmed]
- **Tournament pools:**
  - LV1: 24 monsters.
  - LV2: 24 monsters.
  - LV3: 6 monsters plus all 24 anime characters, 30 in total.

  [confirmed] See the "Tournament LV" column below.
- **Pool vs. rating:** the pool level is a fixed attribute of each duelist and
  has nothing to do with rating. LV1 includes duelists rated 1800, and LV2
  includes duelists rated 750. [confirmed]
- **Initial ratings:**
  - Monsters run from 600 to 1800 in steps of 150, with exactly 6 duelists at
    each step. [confirmed]
  - All anime characters start at 1250. [confirmed]
- **Hidden stats:** each CPU also has five of them (Attack, Defense, Skill,
  Luck, Vitality). Their sum comes to about `initial rating / 5`.
  - The stat values come from YP-C [single].
  - The ≈ rating/5 pattern is an inference [unclear].
- **Available from the start:** only 3 singles CPUs (Stray Lambs, Jerry Beans
  Man, Winged Kuriboh). Everything else unlocks through Duel World (story
  mode), stone-monument "seal" challenges, or play counters. [confirmed]

### Values checked in-game

| Duelist | Sources said | Value |
|---|---|---|
| Dark Magician Girl | 600 (YP-D, GF-M) vs 750 (AT6) | **600, confirmed in-game** by the owner (2026-09-23) |
| Kozaky | 1350 (YP-D, AT6, GF-M) vs 1200 (its own YP-C page) | **1350, confirmed in-game** by the owner (2026-09-23) |
| Gladiator Beast Heraklinos | blank (AT6) vs 1800 (YP-D, GF-M) | **1800, confirmed by the owner's save file** (2026-09-24) |
| Anime characters | all 1250 | **1250, confirmed by the owner's save file** (2026-09-24) |

The owner's save file ([internals.md](internals.md)) backs every other
documented initial rating too:
- The 42 CPUs with no recorded rating, Heraklinos and the 25 anime
  characters among them, still sit at exactly their documented initial
  rating. If a documented value were wrong, the CPU would have had to move
  from its true start to exactly that value, so these are confirmed.
- The 36 CPUs whose rating has moved add up to exactly their documented
  initial sum, as all 78 do together (94800). A wrong initial value would
  have broken that sum, unless another wrong value happened to offset it.

Two more notes:
- **The "Tournament LV" column is a classification, not a limit.** Higher
  levels mix in lower-level duelists.
  - The owner's Level 2 runs have included LV1 duelists.
  - 5CH #23 shows an LV3 bracket with Luster Dragon #2, an LV2 duelist.

  See [game.md](game.md) §2.2. This column is also unrelated to the page
  numbers of the Free Duel opponent list.
- **Names:** English and Japanese names are below. The Korean release's names
  are not researched yet.

## 1. Free Single Duel roster (all 78 CPUs, in in-game list order)

Column notes:
- Order, JA names, Tournament LV, unlock conditions and ratings come from AT6/AT90. EN names, EN decks and ratings come from YP-D. Stats and JA deck names come from YP-C.
- Deck theme / signature card: JAWP says every monster duelist always runs the card it is named after as its ace (「それぞれの登場モンスターは必ず自分と同名のカードを切り札としてデッキに入れている」) [single]. Anime-character themes are listed in §2.
- Unlock-condition prefixes name the Duel World world: Grace (恩恵), Sunlight (太陽), Civilization (文明), Darkness (漆黒), Order (秩序), Chaos (混沌).
- "5x" means beat that Duel World opponent 5 times.
- A "seal challenge" (封印開放) is a stone-monument challenge. You must win a duel after summoning a specific monster.

| # | English name | Japanese name | Category | Tournament LV (atwiki) | Initial rating | Stats Atk/Def/Skill/Luck/Vit (Yugipedia) | WC-mode deck (EN / JA) | Unlock condition (atwiki, translated) |
|---|---|---|---|---|---|---|---|---|
| 1 | Stray Lambs | 迷える仔羊 | Monster (Duel Spirit) | 1 | 600 | 48/12/12/24/24 | Like Two Heads? / 二頭身はお好き！？ | Available from start |
| 2 | Jerry Beans Man | ジェリービーンズマン | Monster (Duel Spirit) | 1 | 600 | 32/12/36/12/32 | D.D. Homerun / 除外ホームラン | Available from start |
| 3 | Winged Kuriboh | ハネクリボー | Monster (Duel Spirit) | 1 | 600 | 12/12/30/30/36 | Hello, Hero! / ハローヒーロー | Available from start |
| 4 | Reaper on the Nightmare | ナイトメアを駆る死霊 | Monster (Duel Spirit) | 1 | 600 | 24/12/24/36/24 | Perishing Darkfest / 死滅暗黒祭 | Grace: beat Nightmare Penguin 5x |
| 5 | The Unhappy Maiden | 薄幸の美少女 | Monster (Duel Spirit) | 1 | 1200 | 36/36/72/36/60 | Stop Fighting! / ケンカは止めて | Civilization: give The Unhappy Maiden recovery cards worth 4000 LP |
| 6 | Elemental Mistress Doriado | 精霊術師 ドリアード | Monster (Duel Spirit) | 1 | 1500 | 60/48/90/78/30 | Beautiful Tactics / ビューティー戦法 | Order: beat Freya, Spirit of Victory 5x |
| 7 | St. Joan | 聖女ジャンヌ | Monster (Duel Spirit) | 1 | 1350 | 41/95/41/41/54 | Heavenly Blessing / 天よりの祝福 | Order: beat Guardian Angel Joan 5x |
| 8 | Spirit of the Pharaoh | スピリッツ・オブ・ファラオ | Monster (Duel Spirit) | 1 | 1050 | 21/53/53/21/63 | A Pharaoh's Spirit / ファラオの魂 | Sunlight: beat Spirit of the Pharaoh (story duel) |
| 9 | Hino-Kagu-Tsuchi | 火之迦具土 | Monster (Duel Spirit) | 1 | 1050 | 74/21/74/21/21 | Burning Warning / バーニングワーニング | Sunlight: beat Dark Dust Spirit 5x |
| 10 | Otohime | 竜宮之姫 | Monster (Duel Spirit) | 1 | 900 | 63/18/45/27/27 | Otohime World / OTO-HIME | Sunlight: beat Otohime |
| 11 | Destiny Hero - Disk Commander | Ｄ－ＨＥＲＯ ディスクガイ | Monster (Duel Spirit) | 1 | 1800 | 90/36/90/36/108 | Earthbound Justice / 地上に落ちた正義 | Chaos: beat Destiny Hero - Plasma 5x |
| 12 | Dark Scorpion - Meanae the Thorn | 黒蠍－棘のミーネ | Monster (Duel Spirit) | 1 | 1050 | 42/42/63/32/32 | You Ready? / 心の準備ＯＫ？ | Sunlight: beat Don Zaloog 5x |
| 13 | King of the Skull Servants | ワイトキング | Monster (Duel Spirit) | 1 | 600 | 18/18/36/12/36 | Rotten Spirits / 腐りきった魂 | Grace: beat Skull Servant 5x |
| 14 | Watapon | ワタポン | Monster (Duel Spirit) | 1 | 1350 | 71/44/54/71/44 | Cute but Powerful / カワイイ姿にご用心 | Order: beat Marshmallon 5x |
| 15 | Petit Dragon | プチリュウ | Monster (Duel Spirit) | 1 | 1650 | 33/33/99/33/132 | Everyday Deck / まるまるノーマル | Order: beat Mokey Mokey 5x |
| 16 | Curse of Vampire | カース・オブ・ヴァンパイア | Monster (Duel Spirit) | 1 | 750 | 45/15/45/15/30 | The Curse / カースofカース | Grace: beat Curse of Vampire |
| 17 | Kaiser Sea Horse | カイザー・シーホース | Monster (Duel Spirit) | 1 | 750 | 45/15/60/15/15 | Natural Power / 与えられしパワー | Sunlight: beat Sea Serpent Warrior of Darkness 5x |
| 18 | Gravekeeper's Chief | 墓守の長 | Monster (Duel Spirit) | 1 | 1050 | 32/32/63/32/53 | Gravekeeper's Deck / 墓守山盛りデッキ | Sunlight: beat Gravekeeper's Commandant 5x |
| 19 | Aquarian Alessa | 水面のアレサ | Monster (Duel Spirit) | 1 | 900 | 54/27/36/27/36 | Dripping Water / 水よ、したたれ | Sunlight: beat Maiden of the Aqua 5x |
| 20 | Il Blud | 地獄の門番イル・ブラッド | Monster (Duel Spirit) | 1 | 1200 | 36/36/72/24/72 | Zombie Crazy / ゾンビにゾッコン | Civilization: beat Blazewing Butterfly 5x |
| 21 | Dark Magician Girl | ブラック・マジシャン・ガール | Monster (Duel Spirit) | 1 | 750 (atwiki) / 600 (Yugipedia list) | 36/12/32/12/32 | Magic School / 決闘魔法学園 | Grace: beat Ebon Magician Curran 5x |
| 22 | Elemental Hero Lady Heat | Ｅ・ＨＥＲＯ レディ・オブ・ファイア | Monster (Duel Spirit) | 1 | 750 | 30/23/30/23/45 | Enchanting Rhythm / 誘惑のリズム | Grace: beat Elemental Hero Knospe 5x |
| 23 | Marie the Fallen One | 堕天使マリー | Monster (Duel Spirit) | 1 | 1500 | 90/30/75/75/30 | Magical Temptation / 魔よりの誘惑 | Order: beat Absorbing Kid from the Sky 5x |
| 24 | Chrysalis Dolphin | Ｃ・ドルフィーナ | Monster (Duel Spirit) | 1 | 900 | 36/45/45/27/27 | Contact Impact / コンタクトインパクト | Sunlight: beat Abyss Soldier 5x |
| 25 | Manju of the Ten Thousand Hands | マンジュ・ゴッド | Monster (Duel Spirit) | 2 | 1650 | 83/50/66/66/66 | Choose an Action / 選択し行動せよ | Order: beat Senju of the Thousand Hands 5x |
| 26 | Airknight Parshath | 天空騎士パーシアス | Monster (Duel Spirit) | 2 | 1500 | 45/90/60/60/45 | Flying Knight / 天かけるナイト | Order: beat Voltanis the Adjudicator (one-time duel) |
| 27 | Gear Golem the Moving Fortress | 機動砦のギア・ゴーレム | Monster (Duel Spirit) | 2 | 1200 | 72/72/24/36/36 | Second Gear / セカンドギア | Civilization: beat Stronghold the Moving Fortress 5x |
| 28 | Silpheed | シルフィード | Monster (Duel Spirit) | 2 | 750 | 30/30/53/15/23 | One-Step Wind / ? | Grace: beat Sonic Shooter 5x |
| 29 | Woodborg Inpachi | 人造木人１８ | Monster (Duel Spirit) | 2 | 1350 | 41/41/54/54/81 | Express Your Love / 愛のマイムマイム | Civilization: beat Woodborg Inpachi |
| 30 | Ojama Yellow | おじゃま・イエロー | Monster (Duel Spirit) | 2 | 1350 | 71/81/71/27/27 | Yellow Mischief / 黄色い悪戯 | Civilization: beat Blowback Dragon |
| 31 | Luster Dragon #2 | エメラルド・ドラゴン | Monster (Duel Spirit) | 2 | 1200 | 48/24/48/60/60 | Dragonic Attack / ドラゴニックアタック | Civilization: beat Luster Dragon 5x |
| 32 | Gemini Elf | ヂェミナイ・エルフ | Monster (Duel Spirit) | 2 | 1650 | 83/50/83/33/83 | Get-a-long Sister / なかよしシスターズ | Order: beat Dancing Fairy 5x |
| 33 | Molten Zombie | 灼熱ゾンビ | Monster (Duel Spirit) | 2 | 1050 | 84/21/42/32/32 | Fan the Flames / ファイヤーレイヤー | Civilization: beat Fox Fire 5x |
| 34 | Sand Moth | サンドモス | Monster (Duel Spirit) | 2 | 900 | 45/18/54/45/18 | My Kingdom / 俺のキングダム | Sunlight: beat Sand Moth |
| 35 | White Magician Pikeru | 白魔導士ピケル | Monster (Duel Spirit) | 2 | 750 | 8/53/23/38/30 | Duelist Idol / 目指せアイドル | Grace: give White Magician Pikeru 5 kinds of cards she loves (or several cute cards) |
| 36 | Water Dragon | ウォーター・ドラゴン | Monster (Duel Spirit) | 2 | 750 | 15/53/30/30/23 | Undersea Shadows / 深海より来る影 | Grace: beat Kairyu-Shin 5x |
| 37 | Neo Space Pathfinder | ネオスペース・コンダクター | Monster (Duel Spirit) | 2 | 1800 | 54/54/72/72/108 | Elemental Power / エレメンタルパワー | Chaos: beat Elemental Hero Neos Alius 5x |
| 38 | Volcanic Doomfire | ヴォルカニック・デビル | Monster (Duel Spirit) | 2 | 1200 | 48/24/96/36/36 | Volcanic Eruption / 火山大噴火 | Civilization: beat Volcanic Slicer 5x |
| 39 | Cloudian - Poison Cloud | 雲魔物－ポイズン・クラウド | Monster (Duel Spirit) | 2 | 1500 | 60/45/90/60/45 | Freedom for All / ? | Order: beat Cloudian - Poison Cloud |
| 40 | Voltanis the Adjudicator | 裁きを下す者－ボルテニス | Monster (Duel Spirit) | 2 | 1650 | 66/99/99/17/50 | Arial Judgment / 天上の裁き | Order: beat Voltanis the Adjudicator (one-time duel) |
| 41 | Light Effigy | ホーリーフレーム | Monster (Duel Spirit) | 2 | 1500 | 75/60/45/45/75 | Flickering Flash / 煌めく閃き | Order: beat Royal Knight 5x |
| 42 | Blowback Dragon | ブローバック・ドラゴン | Monster (Duel Spirit) | 2 | 1350 | 95/27/27/95/27 | Gambling Addiction / ギャンブル中毒 | Civilization: beat Blowback Dragon |
| 43 | Kozaky | コザッキー | Monster (Duel Spirit) | 2 | 1350 | 55/55/81/41/40 (page rating 1200) | Goodbye Kozaky / さよならコザッキー | Civilization: beat Giga Gagagigo |
| 44 | Great Shogun Shien | 大将軍 紫炎 | Monster (Duel Spirit) | 2 | 1200 | 24/72/60/36/48 | A Samurai's Life / 六武衆一代記 | Civilization: beat Spirit of the Six Samurai 5x |
| 45 | Sabersaurus | セイバーザウルス | Monster (Duel Spirit) | 2 | 900 | 45/36/27/27/45 | Cretaceous Deck / 白亜紀ワッショイ | Sunlight: beat Kabazauls 5x |
| 46 | D.D. Warrior Lady | 異次元の女戦士 | Monster (Duel Spirit) | 2 | 900 | 54/18/54/18/36 | Fear of D.D. / 恐怖！？異次元空間 | Sunlight: beat Warrior Lady of the Wasteland 5x |
| 47 | Sacred Phoenix of Nephthys | ネフティスの鳳凰神 | Monster (Duel Spirit) | 2 | 1650 | 53/53/99/99/33 | Eternal Phoenix / 鳳凰は死なない | Chaos: beat Horus the Black Flame Dragon LV8 5x |
| 48 | Injection Fairy Lily | お注射天使リリー | Monster (Duel Spirit) | 2 | 1500 | 15/120/60/45/60 | Maiden Honor / 美少女の意地 | Order: beat Thunder Nyan Nyan 5x |
| 49 | Vortex Kong | ボルテック・コング | Monster (Duel Spirit) | 3 | 1050 | 74/21/21/42/53 | Power of Instinct / 野性の本能 | Civilization: beat Great Angus 5x |
| 50 | Evil Hero Infernal Gainer | Ｅ－ＨＥＲＯ ヘル・ゲイナー | Monster (Duel Spirit) | 3 | 1800 | 108/54/108/54/36 | A Dark Goodbye / イービルグッバイ | Chaos: beat Evil Hero Malicious Edge 5x |
| 51 | Ancient Gear Gadjiltron Dragon | 古代の機械巨竜 | Monster (Duel Spirit) | 3 | 1800 | 90/54/90/54/72 | Ancient Mythology / 古代神話奇譚 | Chaos: beat Green Gadget 5x |
| 52 | Cyberdark Dragon | 鎧黒竜－サイバー・ダーク・ドラゴン | Monster (Duel Spirit) | 3 | 1650 | 86/33/119/33/66 | Armed Dragons / 鎧竜最終形 | Chaos: beat Cyber End Dragon 5x |
| 53 | Demise, King of Armageddon | 終焉の王デミス | Monster (Duel Spirit) | 3 | 1800 | 144/72/54/36/54 | Demise Ritual / 儀式の終焉 | Beat 55 different Free Single Duel opponents 5x each |
| 54 | Gladiator Beast Heraklinos | 剣闘獣ヘラクレイノス | Monster (Duel Spirit) | 3 | (blank) (atwiki) / 1800 (Yugipedia list) | 108/36/144/36/36 | Fighting Beast / 決闘剣闘獣 | Beat 60 different Free Single Duel opponents 6x each |
| 55 | Jaden Yuki | 遊城十代 | Anime character | 3 | 1250 | 50/15/25/75/90 | Dark Heroes / Ｅの暗闇 | Chaos: clear Elemental Hero Chaos Neos seal (stone monument) challenge |
| 56 | Chazz Princeton | 万丈目準 | Anime character | 3 | 1250 | 75/65/65/15/40 | Deep Down Grit / 瞳の奥に宿る闘志 | Civilization: clear VWXYZ-Dragon Catapult Cannon seal challenge |
| 57 | Alexis Rhodes | 天上院明日香 | Anime character | 3 | 1250 | 40/50/65/40/65 | Fancy Tomorrow / 夢見る明日 | Sunlight: clear all Shell Guardian - Savan restricted duels |
| 58 | Bastion Misawa | 三沢大地 | Anime character | 3 | 1250 | 38/38/63/38/75 | Air Pressure / 気圧を制する者 | Grace: win with every Structure Deck in the Coliseum |
| 59 | Atticus Rhodes | 天上院吹雪 | Anime character | 3 | 1250 | 63/38/38/50/63 | Heaven Above / 見上げるは天 | Sunlight: clear Ocean Dragon Lord - Neo-Daedalus seal challenge |
| 60 | Syrus Truesdale | 丸藤翔 | Anime character | 3 | 1250 | 25/63/63/25/75 | Roid Counterattack / ロイドの逆襲 | Grace: beat every deck of Green Guardian - Embust |
| 61 | Tyranno Hassleberry | ティラノ剣山 | Anime character | 3 | 1250 | 75/38/25/38/75 | Dino Evolution / 恐竜の繁栄と進化 | Grace: clear Master of Oz seal challenge |
| 62 | Aster Phoenix | エド・フェニックス | Anime character | 3 | 1250 | 50/40/75/25/65 | Destiny Beatdown / デステニーデス | Darkness: beat all decks of Underworld Guardian - Moley & Dark World Guardian - Gigori |
| 63 | Dark Zane | ヘルカイザー亮 | Anime character | 3 | 1250 | 100/25/75/25/25 | Underworld Deck / 裏サイバー流 | Order: win Sky Guardian - Sefolile 5-duel gauntlet |
| 64 | Jesse Anderson (also spelled Andersen) | ヨハン・アンデルセン | Anime character | 3 | 1250 | 50/25/63/50/63 | Eternal Crystal / 永遠の宝玉の輝き | Order: clear Rainbow Dragon seal challenge |
| 65 | Axel Brodie | オースチン・オブライエン | Anime character | 3 | 1250 | 63/63/25/50/50 | Lava Explosion / 噴出す溶岩流 | Darkness: beat Mythical Beast Cerberus & Darkblaze Dragon |
| 66 | Adrian Gecko | アモン・ガラム | Anime character | 3 | 1250 | 50/25/50/75/50 | Cover the Sun / 太陽を覆うもの | Order: clear Exodius seal challenge |
| 67 | Marcel Bonaparte | 加納マルタン | Anime character | 3 | 1250 | 25/50/100/50/25 | Lost Parts / 失われたパーツ | Sunlight: clear Exxod, Master of The Guard seal challenge |
| 68 | Professor Thelonius Viper | プロフェッサー・コブラ | Anime character | 3 | 1250 | 50/38/75/50/38 | Parasite of Light / 光に寄生する狂気 | Darkness: clear Vennominaga seal challenge |
| 69 | Yubel | ユベル(DU) | Anime character | 3 | 1250 | 100/13/100/25/13 | Light and Dark / 光と闇の狭間 | Chaos: clear Armityle the Chaos Phantom seal challenge |
| 70 | Yami Yugi | 闇遊戯 | Anime character | 3 | 1250 | 50/25/40/50/90 | 1,000 Yr. Memories / ? | Clear all stone monument (seal) challenges |
| 71 | Seto Kaiba | 海馬瀬人 | Anime character | 3 | 1250 | 90/25/50/40/50 | Ruinous Beast / 滅びのバースト | Order: beat Kaibaman |
| 72 | Joey Wheeler | 城之内克也 | Anime character | 3 | 1250 | 40/40/15/90/75 | Display of Courage / 示される勇気 | Clear 6 stone monument (seal) challenges |
| 73 | Maximillion Pegasus | ペガサス・Ｊ・クロフォード | Anime character | 3 | 1250 | 38/38/75/25/75 | Future Vision / 未来を見通す千里眼 | Sunlight: clear all Guardian Sphinx puzzle duels |
| 74 | Yami Marik | 闇マリク | Anime character | 3 | 1250 | 75/40/75/40/25 | Something Hidden / 深淵に潜みし別人格 | Play time over 200 hours |
| 75 | Yami Bakura | 闇獏良 | Anime character | 3 | 1250 | 25/50/88/50/38 | Forbidden Word / 禁じられた言葉 | Activate trap cards over 500 times |
| 76 | Mai Valentine | 孔雀舞 | Anime character | 3 | 1250 | 50/38/75/38/50 | Bold Heroine / 女は度胸 | Activate spell cards over 750 times |
| 77 | Bandit Keith | バンデット・キース | Anime character | 3 | 1250 | 75/25/38/63/50 | Everlasting Battery / 永久バッテリ | Summon/Special Summon monsters over 1000 times |
| 78 | Ishizu Ishtar | イシズ・イシュタール | Anime character | 3 | 1250 | 63/38/75/38/38 | The Keepers / 守護者の集団 | Play time over 100 hours |

Rating conflicts in the table:
- **#21 Dark Magician Girl.** AT6 says 750. YP-D and GF-M both say 600, and the YP-C stats sum to 124, about 620. **600, confirmed in-game** by the owner.
- **#43 Kozaky.** YP-D, AT6 and GF-M say 1350. The Kozaky YP-C page's stat table says 1200, but its stats sum to 272 (about 1360). **1350, confirmed in-game** by the owner.
- **#54 Gladiator Beast Heraklinos.** AT6 leaves the rating blank. YP-D and GF-M say 1800 [confirmed by 2 sources]. JAWP: to unlock it you must beat many duelists 6 times each; the first printing of the strategy guide wrongly said 5.
- **Voltanis & Airknight Parshath.** JAWP: if you *lose* the one-time Voltanis duel in the World of Order, these two never appear in WC mode.

Counts by rating (from YP-D; GF-M groups them the same way):
- 600: 6
- 750: 6
- 900: 6
- 1050: 6
- 1200: 6
- 1350: 6
- 1500: 6
- 1650: 6
- 1800: 6
- 1250: 24 anime characters

Counts per tournament LV (AT6), with their initial ratings:
- **LV1 (24):** 600×6 (Stray Lambs, Jerry Beans Man, Winged Kuriboh, Reaper on the Nightmare, King of the Skull Servants, Dark Magician Girl; counted at the YP-D value of 600), 750×3, 900×3, 1050×4, 1200×2, 1350×2, 1500×2, 1650×1, 1800×1.
- **LV2 (24):** 750×3, 900×3, 1050×1, 1200×4, 1350×4, 1500×4, 1650×4, 1800×1.
- **LV3:** Vortex Kong 1050, Infernal Gainer 1800, Gadjiltron 1800, Cyberdark 1650, Demise 1800, Heraklinos 1800, plus the 24 anime characters at 1250.

---

## 2. Anime character deck themes (JAWP, [single])

**GX characters**
- Jaden Yuki (遊城十代): fusion deck built around Elemental Heroes.
- Chazz Princeton (万丈目準): Armed Dragon as ace, plus the Ojama Trio.
- Alexis Rhodes (天上院明日香): ritual deck centred on Ruin, Queen of Oblivion.
- Bastion Misawa (三沢大地): Wind monsters (Simorgh, Raiza). Ace: White Magician Pikeru.
- Atticus Rhodes (天上院吹雪): Red-Eyes B. Dragon.
- Syrus Truesdale (丸藤翔): Roids, with Super Vehicroid Jumbo Drill as ace.
- Tyranno Hassleberry (ティラノ剣山): Dinosaurs.
- Aster Phoenix (エド): Destiny Heroes.
- Dark Zane (ヘルカイザー亮): machine fusion with Cyber Dragon + Cyberdark.
- Jesse Anderson (ヨハン): Crystal Beasts, with Rainbow Dragon as ace.
- Axel Brodie (オブライエン): Volcanic.
- Adrian Gecko (アモン): Cloudian.
- Marcel Bonaparte (加納マルタン): Exodia assembly.
- Professor Viper (コブラ): Venom / Reptiles.
- Yubel (ユベル): Sacred Beasts, with Armityle and Phantom of Chaos as aces.

**Original series characters**
- Yami Yugi: Dark Magician spellcasters.
- Seto Kaiba: Blue-Eyes, Blood Vorse.
- Joey Wheeler: Warriors + Red-Eyes + Jinzo.
- Pegasus: Toons.
- Yami Marik: Fiends, with Lava Golem.
- Yami Bakura: Destiny Board win.
- Mai Valentine: Harpie Lady / Wind.
- Bandit Keith: coin/dice gamble cards (Gatling Dragon, Snipe Hunter).
- Ishizu Ishtar: Necrovalley + Gravekeepers.

---

## 3. Free Tag Duel roster (15 monster pairs + 9 anime pairs)

Every tag pair shares a single rating. Sources: AT6 (monster pairs) and AT90 (anime pairs), each with the unlock condition; ratings are cross-checked against YP-D [confirmed].

| # | Pair (EN / JA) | Rating | Unlock (AT6/AT90) |
|---|---|---|---|
| 1 | Marshmallon & Spirit Reaper / マシュマロン＆魂を削る死霊 | 800 | From start |
| 2 | Mataza the Zapper & Armed Samurai - Ben Kei / 不意打ち又佐＆重装武者－ベン・ケイ | 1600 | From start |
| 3 | Amazoness Tiger & Amazoness Chain Master | 800 | From start |
| 4 | Mobius the Frost Monarch & Gogiga Gagagigo | 1000 | Darkness: beat that pair |
| 5 | Vampire Lord & Vampire Lady | 1000 | Darkness: beat that pair |
| 6 | Harpie Lady 2 & Harpie Lady 1 | 1000 | Darkness: beat Harpie Queen & Harpie Girl 5x |
| 7 | Blast Sphere & Adhesive Explosive | 1200 | Darkness: beat Satellite Cannon & Metal Shooter 5x |
| 8 | Alien Shocktrooper & Alien Infiltrator | 1200 | Darkness: beat that pair |
| 9 | Alien Mars & Alien Psychic | 1200 | Darkness: beat Alien Hypno & Lich Lord 5x |
| 10 | Different Dimension Dragon & Decoy Dragon | 1400 | Darkness: beat Cerberus & Darkblaze Dragon 5x |
| 11 | Perfect Machine King & Machine King | 1400 | Darkness: beat Vanity's Ruler & Vanity's Fiend 5x |
| 12 | Sasuke Samurai #2 & Sasuke Samurai | 1400 | Darkness: beat Lady Ninja Yae & Goe Goe 5x |
| 13 | Brron & Reign-Beaux (Dark World) | 1600 | Darkness: beat that pair |
| 14 | Submarineroid & Fenrir | 1600 | Beat 10 tag teams 5x each |
| 15 | Gorz & Lava Golem | 800 | Beat 20 tag teams 5x each |
| A1 | Jesse & Jaden | 1250 | 150 total tag duels |
| A2 | Yubel & Marcel | 1250 | DP over 10000 |
| A3 | Chazz & Alexis | 1250 | 100 total tag duels |
| A4 | Dark Zane & Chancellor Sheppard | 1250 | One monster with ATK over 20000 |
| A5 | Jasmine & Mindy (枕田ジュンコ＆浜口ももえ) | 1250 | 50 total tag duels |
| A6 | Tania & Bastion | 1250 | Special Summon Water Dragon |
| A7 | Joey & Yugi Muto | 1250 | Succeed with "Unity / YU-JYO" (友情 YU-JYO) |
| A8 | Kaiba & Yami Yugi | 1250 | 200 total tag duels |
| A9 | Yami Bakura & Yami Marik | 1250 | Win via Destiny Board effect |

AT90 note: tag duels do not appear at all until the player reaches the World of Darkness in Duel World.

---

## 4. Downloadable ghost CPUs (Wi-Fi, service ended 2008-10)

| Month | Duelist / deck | Rating (YP-D) | Rating (JAWP / AT) |
|---|---|---|---|
| 2007-11 | Jaden Yuki / E-Gate | 1150 | 1150 |
| 2007-12 | White Magician Pikeru / CureBurn | 1200 | 1200 |
| 2008-01 | Mobius the Frost Monarch / F.G.E. | **1600** | **1300** (JAWP and AT6 agree), so [unclear] |
| 2008-02 | Dark Zane / Fortress | 1100 | 1100 |
| 2008-03 | Yami Bakura / RevivalTime | 1200 | 1200 |
| 2008-04 | Blowback Dragon / HighLevel | 1450 | 1450 |
| 2008-05 | Kozaky / Draw | 850 | 850 |
| 2008-06 | Ojama Green / HighBurn | 1400 | 1400 |
| 2008-07 | Tania / MightyWangfu | 1250 | 1250 |
| 2008-08 | Bastion / WeakDrain | 1350 | 1350 |
| 2008-09 | Adrian Gecko / Cloudian | 1300 | 1300 |
| 2008-10 | Marshmallon / T.G.E. | 1500 | 1500 |
| 2008-10 | HJY (WC2008 champion) / Destiny | 1200 | 1200 |
| 2008-10 | Angel (runner-up) / HugoAdame.dek | 1100 | 1100 |
| 2008-10 | enyce (3rd) / UG Ctr | 1000 | 1000 |

---

## 5. Appendix: Duel World (story mode) opponent ratings

YP-D gives a fixed rating for each world [single]. These are story-mode opponents, not tournament CPUs.

| World | Rating |
|---|---|
| Grace | 500 (Amazoness Paladin's structure-deck coliseum: 900) |
| Sunlight | 700 |
| Civilization | 900 |
| Darkness (tag) | 1100 |
| Order | 1300 |
| Chaos | 1500 |

---


## 6. Portraits and WC-mode decklists (used by the app)

The duelist pages show each CPU's in-game opponent card and the list of its
WC-mode deck (§1). Both come from each CPU's YP-C page, fetched on
2026-09-23. In the code they live in `src/assets/portraits/` and
`src/data/decks.ts`.

- **Portraits:** the 256×192 WC2008 opponent card, as the DS shows it, for
  all 78 CPUs.
  - Bastion Misawa's singles card isn't published. His page shows only the
    downloadable ghost's card (deck "WeakDrain", with its own rating and
    stats), so the app uses that one and says so under it. The art is the
    same.
  - Tyranno Hassleberry's image is a larger photo of the screen, scaled down
    to 256×192.
  - The rating printed on a card is whatever that save showed when the
    screenshot was taken, so it is not data. Kozaky's card says 1200, for
    example, while its initial rating is 1350, confirmed in-game.
- **Decklists:** the app shows YP-C's list for the WC-mode deck, for all 78.
  - GF-M agrees card for card on 71 of them [confirmed]. Some cards go by a
    different English name there, e.g. Hand Destruction for Hand Collapse,
    Vampire's Curse for Curse of Vampire, Zoma the Spirit for Skull Zoma.
  - The other 7 differ [unclear]; an in-game check would settle them:

    | Duelist | YP-C (shown in the app) | GF-M |
    |---|---|---|
    | Winged Kuriboh | Elemental Hero Neos Alius ×1 | ×2 |
    | Reaper on the Nightmare | Dark Paladin ×3 in the Extra Deck | Flame Swordsman ×3 instead, plus 1 Beastking of the Swamps |
    | Jaden Yuki | Dimension Fusion ×1 | none, leaving 39 main-deck cards |
    | Chazz Princeton | Raigeki ×1 (41 cards) | none (40) |
    | Bastion Misawa | Spiritual Wind Art - Miyabi ×3 | ×2, plus Mystical Space Typhoon ×1 |
    | Yami Yugi | Giant Soldier of Stone ×3, Magician's Circle ×1 | ×2 and ×2 |
    | Seto Kaiba | Polymerization ×2, The Light - Hex-Sealed Fusion ×2 (42 cards) | The Dark - Hex-Sealed Fusion ×2, no Polymerization (40) |

  - Deck names follow YP-C's spelling ("One-step Wind", "Freedom For All"),
    which matches the opponent cards. GF-M uses the same names, except
    "Gravekeeper Deck".
  - Main decks run from 40 to 44 cards as YP-C lists them.
  - Kozaky's list has no Kozaky card, only Kozaky's Self-Destruct Button,
    in both YP-C and GF-M. That contradicts JAWP's claim (§1) that every
    monster duelist runs its namesake.
- **Styles and summaries are the app's own reading of each list**, not a
  source's [unclear]. There are twelve styles: Beatdown, Burn, Control,
  Stall, Ritual, Fusion, Swarm, Graveyard, Banish, Lifegain, Gamble and Alt
  win. Each deck gets one to three of them, main style first.

---

## 7. Sources

- YP-D: https://yugipedia.com/wiki/Duelists_(WC08-VG)
- YP-C: Yugipedia per-character pages, e.g. https://yugipedia.com/wiki/Spirit_of_the_Pharaoh_(character)
- Yugipedia game page: https://yugipedia.com/wiki/Yu-Gi-Oh!_World_Championship_2008
- AT6: https://w.atwiki.jp/1548908-08/pages/6.html (Wayback: http://web.archive.org/web/20250726130146/https://w.atwiki.jp/1548908-08/pages/6.html)
- AT90: https://w.atwiki.jp/1548908-08/pages/90.html
- JAWP: https://ja.wikipedia.org/wiki/遊☆戯☆王デュエルモンスターズ_WORLD_CHAMPIONSHIP_2008
- GF-M: https://gamefaqs.gamespot.com/ds/943071-yu-gi-oh-world-championship-2008/faqs/74570
- GF-A: https://gamefaqs.gamespot.com/ds/943071-yu-gi-oh-world-championship-2008/faqs/52265
- GF-C: https://gamefaqs.gamespot.com/ds/943071-yu-gi-oh-world-championship-2008/faqs/54558
- GF-P: https://gamefaqs.gamespot.com/ds/943071-yu-gi-oh-world-championship-2008/faqs/51146
- 5CH: https://medaka.5ch.net/test/read.cgi/handygover/1221528604/
