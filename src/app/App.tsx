// Shadowrealm Chronicles — Dark Fantasy Browser RPG
import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
type Screen = "title" | "create" | "world" | "combat" | "inventory" | "equipment" | "skills" | "crafting" | "shop" | "quests" | "dungeon" | "coop" | "achievements";
type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";
type ItemType = "Weapon" | "Offhand" | "Helmet" | "Chest" | "Gloves" | "Boots" | "Amulet" | "Ring" | "Potion" | "Material" | "Rune";
type Slot = "Weapon" | "Offhand" | "Helmet" | "Chest" | "Gloves" | "Boots" | "Amulet" | "Ring1" | "Ring2";
type HeroClass = "Warrior" | "Mage" | "Rogue" | "Necromancer" | "Paladin" | "Ranger";
type SFX = "Burning" | "Frozen" | "Poisoned" | "Stunned" | "Bleeding" | "Blessed" | "Enraged" | "Marked";

interface StatBlock { str: number; int: number; agi: number; def: number; lck: number; }
interface IStats { str?: number; int?: number; agi?: number; def?: number; lck?: number; hp?: number; mp?: number; }

interface Item {
  id: string; name: string; type: ItemType; rarity: Rarity;
  icon: string; desc: string; stats?: IStats; value: number;
  levelReq?: number; classReq?: HeroClass[]; effect?: string;
}
interface InvItem extends Item { qty: number; }

interface Skill {
  id: string; name: string; icon: string; desc: string;
  mpCost: number; cd: number; curCd: number;
  dmgPct?: number; healAmt?: number;
  fx?: SFX; fxChance?: number;
  sType: "atk" | "heal" | "buff" | "summon";
  learned: boolean; slvl: number; maxLvl: number; reqId?: string;
}

interface Enemy {
  id: string; name: string; icon: string;
  maxHp: number; atk: number; def: number; spd: number;
  xp: number; gold: number;
  loot: { id: string; pct: number }[];
  tier: "n" | "e" | "b" | "l";
  desc: string;
}

interface ActiveEnemy extends Enemy {
  curHp: number; sfx: Partial<Record<SFX, number>>;
}

interface Quest {
  id: string; name: string; desc: string;
  objs: { txt: string; cur: number; req: number; killId?: string; collectId?: string }[];
  xp: number; gold: number; iRewards: string[];
  status: "avail" | "active" | "done"; minLvl: number;
}

interface Area {
  id: string; name: string; desc: string; icon: string;
  lvlRange: [number, number]; enemyIds: string[];
  hasDungeon: boolean; hasShop: boolean; found: boolean;
}

interface Recipe {
  id: string; name: string; outId: string; outQty: number;
  ingredients: { id: string; qty: number }[]; minLvl: number;
}

interface CoopMember {
  id: string; name: string; cls: HeroClass; lvl: number;
  hp: number; maxHp: number; ready: boolean; isBot: boolean;
}

interface GState {
  player: {
    name: string; cls: HeroClass; lvl: number; xp: number; xpNext: number;
    hp: number; maxHp: number; mp: number; maxMp: number;
    base: StatBlock; freePoints: number; gold: number;
    inv: InvItem[]; equip: Partial<Record<Slot, string>>;
    skills: Skill[]; sfx: Partial<Record<SFX, number>>;
    achieved: string[]; activeQ: string[]; doneQ: string[];
    kills: Record<string, number>; crafts: number;
    wins: number; flees: number; floorsCleared: number;
  };
  screen: Screen;
  areaId: string;
  combat: {
    enemy: ActiveEnemy | null; log: string[];
    playerTurn: boolean; over: boolean;
    result: "win" | "lose" | "flee" | null;
    loot: InvItem[]; xpGain: number; goldGain: number;
  };
  dungeon: { areaId: string; floor: number; maxFloor: number; };
  coop: {
    code: string; party: CoopMember[];
    chat: { who: string; msg: string; time: number }[];
    isLeader: boolean;
  };
  quests: Quest[];
  notifs: { id: number; msg: string; type: "ok" | "warn" | "bad" | "info" }[];
  shop: InvItem[];
  _notifId: number;
}

// ─────────────────────────────────────────
// GAME DATA
// ─────────────────────────────────────────

const ITEMS: Record<string, Item> = {
  // Weapons
  iron_sword:      { id:"iron_sword",      name:"Iron Sword",         type:"Weapon",   rarity:"Common",    icon:"⚔️",  desc:"A sturdy iron sword. Reliable if dull.",           stats:{str:5},           value:50  },
  silver_dagger:   { id:"silver_dagger",   name:"Silver Dagger",      type:"Weapon",   rarity:"Common",    icon:"🗡️",  desc:"Swift silver blade favored by assassins.",          stats:{agi:3,str:3},     value:60, classReq:["Rogue"] },
  apprentice_staff:{ id:"apprentice_staff",name:"Apprentice Staff",   type:"Weapon",   rarity:"Common",    icon:"🪄",  desc:"First staff given to arcane initiates.",            stats:{int:6,mp:15},     value:55, classReq:["Mage","Necromancer"] },
  hunters_bow:     { id:"hunters_bow",     name:"Hunter's Bow",       type:"Weapon",   rarity:"Common",    icon:"🏹",  desc:"A well-crafted bow for tracking prey.",             stats:{agi:5,str:2},     value:55, classReq:["Ranger"] },
  holy_mace:       { id:"holy_mace",       name:"Holy Mace",          type:"Weapon",   rarity:"Common",    icon:"🔨",  desc:"Blessed by the church. Punishes the undead.",       stats:{str:4,int:2},     value:55, classReq:["Paladin"] },
  bone_wand:       { id:"bone_wand",       name:"Bone Wand",          type:"Weapon",   rarity:"Common",    icon:"🦴",  desc:"Crafted from the femur of a fallen warrior.",       stats:{int:5,str:1},     value:50, classReq:["Necromancer"] },
  flame_sword:     { id:"flame_sword",     name:"Flamebrand",         type:"Weapon",   rarity:"Uncommon",  icon:"🔥",  desc:"A blade wreathed in eternal flame.",                stats:{str:8,int:3},     value:200 },
  shadow_blade:    { id:"shadow_blade",    name:"Shadow Blade",       type:"Weapon",   rarity:"Rare",      icon:"🌑",  desc:"Strikes before it can be seen.",                   stats:{agi:10,str:7},    value:800, classReq:["Rogue"] },
  void_staff:      { id:"void_staff",      name:"Staff of the Void",  type:"Weapon",   rarity:"Rare",      icon:"🔮",  desc:"Channels the raw energy between worlds.",           stats:{int:15,mp:40},    value:900, classReq:["Mage"] },
  deaths_scythe:   { id:"deaths_scythe",   name:"Death's Scythe",     type:"Weapon",   rarity:"Epic",      icon:"⚰️",  desc:"The reaper's own instrument of harvest.",           stats:{int:12,str:10,hp:30}, value:3000, classReq:["Necromancer"] },
  archangels_sword:{ id:"archangels_sword",name:"Archangel's Blade",  type:"Weapon",   rarity:"Epic",      icon:"✨",  desc:"A divine weapon that radiates holy light.",         stats:{str:14,int:8,hp:40}, value:3500, classReq:["Paladin"] },
  dragons_fang:    { id:"dragons_fang",    name:"Dragon's Fang",      type:"Weapon",   rarity:"Epic",      icon:"🐉",  desc:"A dragon tooth sharpened to a blade.",             stats:{str:18,agi:6},    value:4000 },
  soul_reaper:     { id:"soul_reaper",     name:"Soul Reaper",        type:"Weapon",   rarity:"Legendary", icon:"💀",  desc:"Each kill feeds its insatiable hunger for souls.",  stats:{str:22,int:15,hp:50}, value:12000 },
  excalibur:       { id:"excalibur",       name:"Excalibur",          type:"Weapon",   rarity:"Legendary", icon:"⚜️",  desc:"The legendary sword of the true king.",             stats:{str:25,int:10,def:5}, value:15000 },
  staff_of_eternity:{id:"staff_of_eternity",name:"Staff of Eternity",type:"Weapon",   rarity:"Mythic",    icon:"🌟",  desc:"Older than memory. Has witnessed the end of worlds.",stats:{int:40,mp:100,hp:60}, value:50000, classReq:["Mage"] },
  // Helmets
  iron_helm:       { id:"iron_helm",       name:"Iron Helm",          type:"Helmet",   rarity:"Common",    icon:"⛑️",  desc:"Basic protection for the skull.",                  stats:{def:3},           value:40 },
  leather_hood:    { id:"leather_hood",    name:"Leather Hood",       type:"Helmet",   rarity:"Common",    icon:"🎩",  desc:"Light hood favored by scouts.",                    stats:{def:2,agi:2},     value:35 },
  wizard_hat:      { id:"wizard_hat",      name:"Wizard's Hat",       type:"Helmet",   rarity:"Common",    icon:"🧙",  desc:"Conical hat amplifying arcane power.",              stats:{int:4,mp:10},     value:45, classReq:["Mage"] },
  shadow_cowl:     { id:"shadow_cowl",     name:"Shadow Cowl",        type:"Helmet",   rarity:"Uncommon",  icon:"🌒",  desc:"Woven from shadow threads. Renders wearer half-visible.", stats:{agi:5,def:3}, value:220, classReq:["Rogue"] },
  crusader_helm:   { id:"crusader_helm",   name:"Crusader Helm",      type:"Helmet",   rarity:"Uncommon",  icon:"🛡️",  desc:"Heavy helm of the holy crusaders.",                stats:{def:6,hp:15},    value:180, classReq:["Warrior","Paladin"] },
  bone_crown:      { id:"bone_crown",      name:"Bone Crown",         type:"Helmet",   rarity:"Rare",      icon:"👑",  desc:"Crown of the undead lich kings.",                  stats:{int:8,mp:25,def:4}, value:750, classReq:["Necromancer"] },
  // Chest
  iron_breastplate:{ id:"iron_breastplate",name:"Iron Breastplate",   type:"Chest",    rarity:"Common",    icon:"🛡️",  desc:"Standard issue iron armor.",                       stats:{def:6},           value:80 },
  leather_armor:   { id:"leather_armor",   name:"Leather Armor",      type:"Chest",    rarity:"Common",    icon:"🧥",  desc:"Light armor allowing freedom of movement.",        stats:{def:4,agi:2},     value:70 },
  arcane_robe:     { id:"arcane_robe",     name:"Arcane Robe",        type:"Chest",    rarity:"Common",    icon:"👘",  desc:"Woven with threads of enchanted silk.",            stats:{int:5,mp:20},     value:75, classReq:["Mage","Necromancer"] },
  shadow_vest:     { id:"shadow_vest",     name:"Shadow Vest",        type:"Chest",    rarity:"Uncommon",  icon:"🦇",  desc:"Lightweight vest woven from moonless night.",      stats:{agi:7,def:4},     value:350, classReq:["Rogue"] },
  holy_armor:      { id:"holy_armor",      name:"Holy Armor",         type:"Chest",    rarity:"Rare",      icon:"🌟",  desc:"Forged in divine light, deflects unholy attacks.", stats:{def:10,hp:30,int:4}, value:1200, classReq:["Paladin"] },
  lich_robe:       { id:"lich_robe",       name:"Lich's Robe",        type:"Chest",    rarity:"Epic",      icon:"☠️",  desc:"Robe of a lich lord, steeped in necromantic power.", stats:{int:15,mp:60,hp:25}, value:4500, classReq:["Necromancer"] },
  dragon_armor:    { id:"dragon_armor",    name:"Dragonscale Armor",  type:"Chest",    rarity:"Epic",      icon:"🐲",  desc:"Armor forged from the scales of an elder dragon.", stats:{def:18,hp:60,str:6}, value:5000 },
  // Gloves
  iron_gauntlets:  { id:"iron_gauntlets",  name:"Iron Gauntlets",     type:"Gloves",   rarity:"Common",    icon:"🥊",  desc:"Heavy gauntlets for brawlers.",                    stats:{def:2,str:2},     value:35 },
  assassin_gloves: { id:"assassin_gloves", name:"Assassin's Gloves",  type:"Gloves",   rarity:"Uncommon",  icon:"🖐️",  desc:"Thin gloves that improve blade control.",          stats:{agi:4,lck:3},     value:200, classReq:["Rogue"] },
  mage_handwraps:  { id:"mage_handwraps",  name:"Arcane Handwraps",   type:"Gloves",   rarity:"Uncommon",  icon:"🤲",  desc:"Wrapped in arcane script, channel spell energy.",  stats:{int:5,mp:15},     value:210, classReq:["Mage"] },
  knight_gauntlets:{ id:"knight_gauntlets",name:"Knight's Gauntlets", type:"Gloves",   rarity:"Rare",      icon:"⚔️",  desc:"Ornate gauntlets of a seasoned knight.",           stats:{str:6,def:4,hp:10}, value:650, classReq:["Warrior","Paladin"] },
  // Boots
  iron_boots:      { id:"iron_boots",      name:"Iron Boots",         type:"Boots",    rarity:"Common",    icon:"👢",  desc:"Heavy but protective iron boots.",                 stats:{def:3},           value:30 },
  swiftfoot_boots: { id:"swiftfoot_boots", name:"Swiftfoot Boots",    type:"Boots",    rarity:"Uncommon",  icon:"👟",  desc:"Enchanted with wind magic. Increases movement.",   stats:{agi:6,def:2},     value:250 },
  mystic_treads:   { id:"mystic_treads",   name:"Mystic Treads",      type:"Boots",    rarity:"Rare",      icon:"🌀",  desc:"Boots that leave no footprints.",                  stats:{agi:5,int:4,mp:10}, value:700, classReq:["Mage","Rogue"] },
  deathwalker_boots:{id:"deathwalker_boots",name:"Deathwalker Boots", type:"Boots",    rarity:"Epic",      icon:"💀",  desc:"Walk between the land of living and dead.",       stats:{int:8,agi:6,hp:20}, value:3200, classReq:["Necromancer"] },
  // Accessories
  ring_str:        { id:"ring_str",        name:"Ring of Might",      type:"Ring",     rarity:"Common",    icon:"💍",  desc:"A simple ring enchanted with strength.",           stats:{str:4},           value:100 },
  ring_int:        { id:"ring_int",        name:"Arcane Ring",        type:"Ring",     rarity:"Common",    icon:"💎",  desc:"A ring humming with arcane energy.",               stats:{int:4,mp:10},     value:110 },
  ring_agi:        { id:"ring_agi",        name:"Ring of Swift",      type:"Ring",     rarity:"Common",    icon:"🌀",  desc:"A ring that quickens the wearer.",                 stats:{agi:4},           value:100 },
  serpent_ring:    { id:"serpent_ring",    name:"Serpent Ring",       type:"Ring",     rarity:"Uncommon",  icon:"🐍",  desc:"Carved in the shape of a serpent.",                stats:{agi:5,lck:5},     value:300 },
  dragons_eye:     { id:"dragons_eye",     name:"Dragon's Eye",       type:"Amulet",   rarity:"Rare",      icon:"👁️",  desc:"An amulet containing the eye of a slain dragon.", stats:{int:8,str:5,hp:25}, value:1500 },
  void_ring:       { id:"void_ring",       name:"Void Crystal Ring",  type:"Ring",     rarity:"Epic",      icon:"🔮",  desc:"A ring containing a crystal that warps reality.", stats:{int:12,mp:35},    value:4200, classReq:["Mage"] },
  bloodmoon_amulet:{ id:"bloodmoon_amulet",name:"Blood Moon Amulet",  type:"Amulet",   rarity:"Epic",      icon:"🌑",  desc:"Draws power from the blood moon.",                stats:{str:10,int:8,hp:35}, value:4800 },
  magi_ring:       { id:"magi_ring",       name:"Ring of the Magi",   type:"Ring",     rarity:"Legendary", icon:"⭐",  desc:"Worn by the ancient mage-kings.",                  stats:{int:18,mp:50,str:8}, value:12000 },
  amulet_health:   { id:"amulet_health",   name:"Amulet of Vitality", type:"Amulet",   rarity:"Uncommon",  icon:"❤️",  desc:"Pulses with life energy.",                         stats:{hp:40,def:3},     value:350 },
  // Potions
  minor_hp:  { id:"minor_hp",  name:"Minor HP Potion",    type:"Potion", rarity:"Common",   icon:"🧪", desc:"Restores 50 HP.",         value:25, effect:"heal_50"       },
  hp_pot:    { id:"hp_pot",    name:"Health Potion",      type:"Potion", rarity:"Common",   icon:"❤️", desc:"Restores 150 HP.",        value:60, effect:"heal_150"      },
  big_hp:    { id:"big_hp",    name:"Greater HP Potion",  type:"Potion", rarity:"Uncommon", icon:"💖", desc:"Restores 350 HP.",        value:150, effect:"heal_350"     },
  minor_mp:  { id:"minor_mp",  name:"Minor MP Potion",    type:"Potion", rarity:"Common",   icon:"🔵", desc:"Restores 30 MP.",         value:30, effect:"mana_30"       },
  mp_pot:    { id:"mp_pot",    name:"Mana Potion",        type:"Potion", rarity:"Common",   icon:"💙", desc:"Restores 80 MP.",         value:70, effect:"mana_80"       },
  str_elixir:{ id:"str_elixir",name:"Elixir of Strength", type:"Potion", rarity:"Uncommon", icon:"💪", desc:"+10 STR for this battle.", value:120, effect:"buff_str"    },
  def_tonic: { id:"def_tonic", name:"Defense Tonic",      type:"Potion", rarity:"Uncommon", icon:"🛡️", desc:"+10 DEF for this battle.", value:120, effect:"buff_def"    },
  swift_elix:{ id:"swift_elix",name:"Elixir of Swiftness",type:"Potion", rarity:"Uncommon", icon:"⚡", desc:"+10 AGI for this battle.", value:120, effect:"buff_agi"    },
  elixir_gods:{id:"elixir_gods",name:"Elixir of the Gods",type:"Potion", rarity:"Legendary",icon:"✨", desc:"Full HP and MP restore.",  value:5000, effect:"full_restore"},
  // Materials
  iron_ore:     { id:"iron_ore",     name:"Iron Ore",         type:"Material", rarity:"Common",   icon:"⛏️", desc:"Raw iron ore for smithing.",              value:5   },
  silver_ore:   { id:"silver_ore",   name:"Silver Ore",       type:"Material", rarity:"Uncommon", icon:"🪙", desc:"Rare silver ore with magical conductivity.", value:20 },
  gold_ore:     { id:"gold_ore",     name:"Gold Ore",         type:"Material", rarity:"Uncommon", icon:"💰", desc:"Pure gold ore for high-quality crafting.",  value:30  },
  dragon_scale: { id:"dragon_scale", name:"Dragon Scale",     type:"Material", rarity:"Rare",     icon:"🐲", desc:"Scale from an elder dragon. Incredibly tough.", value:200 },
  shadow_ess:   { id:"shadow_ess",   name:"Shadow Essence",   type:"Material", rarity:"Rare",     icon:"🌑", desc:"Crystallized shadow energy.",              value:150 },
  void_crystal: { id:"void_crystal", name:"Void Crystal",     type:"Material", rarity:"Epic",     icon:"🔮", desc:"A shard of crystallized void energy.",      value:500 },
  phoenix_feath:{ id:"phoenix_feath",name:"Phoenix Feather",  type:"Material", rarity:"Epic",     icon:"🔥", desc:"A feather from the legendary firebird.",    value:600 },
  demon_heart:  { id:"demon_heart",  name:"Demon Heart",      type:"Material", rarity:"Rare",     icon:"💔", desc:"Still-beating heart of a slain demon.",     value:300 },
  angel_tear:   { id:"angel_tear",   name:"Angel's Tear",     type:"Material", rarity:"Epic",     icon:"💧", desc:"Crystallized tear from an angel.",          value:400 },
  rune_fragment:{ id:"rune_fragment",name:"Rune Fragment",     type:"Material", rarity:"Uncommon", icon:"📜", desc:"Fragment of an ancient magical rune.",      value:40  },
  moonstone:    { id:"moonstone",    name:"Moonstone",         type:"Material", rarity:"Uncommon", icon:"🌙", desc:"A gem that glows with moonlight.",           value:35  },
  sunstone:     { id:"sunstone",     name:"Sunstone",          type:"Material", rarity:"Uncommon", icon:"☀️", desc:"A gem that holds the warmth of the sun.",    value:35  },
  dark_crystal: { id:"dark_crystal", name:"Dark Crystal",      type:"Material", rarity:"Rare",     icon:"💎", desc:"A crystal pulsing with dark energy.",        value:175 },
  blessed_water:{ id:"blessed_water",name:"Blessed Water",     type:"Material", rarity:"Common",   icon:"💦", desc:"Water blessed by a high priest.",           value:15  },
  hellfire_emb: { id:"hellfire_emb", name:"Hellfire Ember",    type:"Material", rarity:"Uncommon", icon:"🔥", desc:"A shard of hellfire that never cools.",      value:50  },
  // Runes
  rune_fire: { id:"rune_fire", name:"Rune of Fire",      type:"Rune", rarity:"Uncommon", icon:"🔥", desc:"Infuses attacks with fire damage.",    stats:{str:3,int:2},    value:180 },
  rune_ice:  { id:"rune_ice",  name:"Rune of Ice",       type:"Rune", rarity:"Uncommon", icon:"❄️", desc:"Adds a chance to freeze enemies.",     stats:{int:4,agi:2},    value:180 },
  rune_bolt: { id:"rune_bolt", name:"Rune of Lightning", type:"Rune", rarity:"Rare",     icon:"⚡", desc:"Charges attacks with lightning.",      stats:{int:5,agi:5},    value:600 },
  rune_earth:{ id:"rune_earth",name:"Rune of Earth",     type:"Rune", rarity:"Uncommon", icon:"🌍", desc:"Strengthens with earth power.",        stats:{def:5,hp:20},    value:200 },
  rune_shade:{ id:"rune_shade",name:"Rune of Shadow",    type:"Rune", rarity:"Rare",     icon:"🌑", desc:"Improves stealth and cunning.",         stats:{agi:8,lck:5},    value:700 },
  rune_light:{ id:"rune_light",name:"Rune of Light",     type:"Rune", rarity:"Rare",     icon:"✨", desc:"Infuses with divine light.",            stats:{int:6,def:4,hp:15}, value:650 },
};

const ENEMIES: Record<string, Enemy> = {
  goblin:       { id:"goblin",       name:"Goblin",             icon:"👺", maxHp:30,  atk:8,  def:2,  spd:12, xp:15,   gold:8,   loot:[{id:"iron_ore",pct:.4},{id:"minor_hp",pct:.2}],                            tier:"n", desc:"Small, cunning creatures who love shiny things." },
  skeleton:     { id:"skeleton",     name:"Skeleton Warrior",   icon:"💀", maxHp:45,  atk:12, def:5,  spd:8,  xp:25,   gold:12,  loot:[{id:"rune_fragment",pct:.3},{id:"iron_ore",pct:.5}],                       tier:"n", desc:"Animated bones of fallen warriors." },
  forest_wolf:  { id:"forest_wolf",  name:"Forest Wolf",        icon:"🐺", maxHp:55,  atk:15, def:3,  spd:18, xp:30,   gold:10,  loot:[{id:"minor_hp",pct:.3}],                                                  tier:"n", desc:"Fierce wolves corrupted by dark magic." },
  dark_elf:     { id:"dark_elf",     name:"Dark Elf Archer",    icon:"🧝", maxHp:60,  atk:18, def:6,  spd:16, xp:40,   gold:20,  loot:[{id:"silver_ore",pct:.2},{id:"swiftfoot_boots",pct:.05}],                  tier:"n", desc:"Exiled dark elves who dwell in the deep forest." },
  undead_mage:  { id:"undead_mage",  name:"Undead Mage",        icon:"🧟", maxHp:50,  atk:22, def:4,  spd:7,  xp:50,   gold:25,  loot:[{id:"rune_fragment",pct:.5},{id:"moonstone",pct:.3},{id:"apprentice_staff",pct:.05}], tier:"n", desc:"Mages who refused to die." },
  giant_spider: { id:"giant_spider", name:"Giant Spider",       icon:"🕷️", maxHp:70,  atk:16, def:8,  spd:14, xp:45,   gold:15,  loot:[{id:"dark_crystal",pct:.2}],                                              tier:"n", desc:"Massive spiders that spin webs of shadow." },
  stone_golem:  { id:"stone_golem",  name:"Stone Golem",        icon:"🪨", maxHp:150, atk:25, def:20, spd:4,  xp:80,   gold:40,  loot:[{id:"iron_ore",pct:.8},{id:"gold_ore",pct:.2},{id:"rune_earth",pct:.06}],  tier:"e", desc:"Ancient magical constructs of living stone." },
  vampire_bat:  { id:"vampire_bat",  name:"Vampire Bat",        icon:"🦇", maxHp:40,  atk:13, def:3,  spd:20, xp:30,   gold:12,  loot:[{id:"dark_crystal",pct:.15}],                                             tier:"n", desc:"Bats infused with vampiric energy." },
  werewolf:     { id:"werewolf",     name:"Werewolf",           icon:"🐗", maxHp:120, atk:30, def:10, spd:15, xp:90,   gold:45,  loot:[{id:"moonstone",pct:.4},{id:"silver_ore",pct:.3}],                        tier:"e", desc:"Humans cursed to transform under moonlight." },
  dark_knight:  { id:"dark_knight",  name:"Dark Knight",        icon:"🏴", maxHp:180, atk:35, def:18, spd:9,  xp:120,  gold:80,  loot:[{id:"shadow_ess",pct:.3},{id:"iron_breastplate",pct:.1},{id:"shadow_blade",pct:.03}], tier:"e", desc:"Knights who sold their souls for power." },
  lich:         { id:"lich",         name:"Lich",               icon:"☠️", maxHp:200, atk:45, def:15, spd:10, xp:200,  gold:150, loot:[{id:"void_crystal",pct:.25},{id:"bone_crown",pct:.1},{id:"rune_shade",pct:.1}], tier:"b", desc:"Ancient undead sorcerers of immense power." },
  dragon_wyrm:  { id:"dragon_wyrm",  name:"Dragon Wyrmling",    icon:"🐉", maxHp:250, atk:50, def:22, spd:12, xp:300,  gold:200, loot:[{id:"dragon_scale",pct:.6},{id:"dragons_fang",pct:.05},{id:"dragons_eye",pct:.08}], tier:"b", desc:"Young but still terrifying fire-breathers." },
  demon_scout:  { id:"demon_scout",  name:"Demon Scout",        icon:"👿", maxHp:90,  atk:28, def:12, spd:17, xp:70,   gold:35,  loot:[{id:"demon_heart",pct:.1},{id:"hellfire_emb",pct:.4}],                    tier:"n", desc:"Scouts from the infernal planes." },
  shadow_stalk: { id:"shadow_stalk", name:"Shadow Stalker",     icon:"🌑", maxHp:110, atk:32, def:8,  spd:22, xp:85,   gold:50,  loot:[{id:"shadow_ess",pct:.4},{id:"rune_shade",pct:.05}],                     tier:"e", desc:"Creatures born from pure shadow that hunt the living." },
  ancient_troll:{ id:"ancient_troll",name:"Ancient Troll",      icon:"👹", maxHp:300, atk:40, def:25, spd:6,  xp:180,  gold:100, loot:[{id:"iron_ore",pct:.9},{id:"gold_ore",pct:.4},{id:"rune_earth",pct:.1}],  tier:"b", desc:"Ancient trolls with skin like stone. Regenerates." },
  void_wraith:  { id:"void_wraith",  name:"Void Wraith",        icon:"👻", maxHp:160, atk:38, def:5,  spd:18, xp:150,  gold:90,  loot:[{id:"void_crystal",pct:.2},{id:"rune_bolt",pct:.1}],                     tier:"e", desc:"Entities from the void between worlds." },
  blood_mage:   { id:"blood_mage",   name:"Blood Mage",         icon:"🩸", maxHp:130, atk:42, def:8,  spd:12, xp:130,  gold:70,  loot:[{id:"demon_heart",pct:.2},{id:"dark_crystal",pct:.3},{id:"void_staff",pct:.03}], tier:"e", desc:"Mages who fuel their power with their own life essence." },
  bone_dragon:  { id:"bone_dragon",  name:"Bone Dragon",        icon:"🦴", maxHp:600, atk:70, def:30, spd:14, xp:800,  gold:500, loot:[{id:"dragon_scale",pct:.8},{id:"void_crystal",pct:.4},{id:"deaths_scythe",pct:.05},{id:"rune_shade",pct:.2}], tier:"l", desc:"Remains of an ancient dragon animated by necromancy." },
  shadow_lord:  { id:"shadow_lord",  name:"Shadow Lord Malachar",icon:"👁️",maxHp:1000,atk:90, def:40, spd:20, xp:2000, gold:1000,loot:[{id:"soul_reaper",pct:.1},{id:"void_crystal",pct:.8},{id:"bloodmoon_amulet",pct:.2}], tier:"l", desc:"The ancient lord of shadow and darkness. The source of all evil." },
};

const CLASS_SKILLS: Record<HeroClass, Skill[]> = {
  Warrior: [
    { id:"slash",    name:"Power Slash",    icon:"⚔️", desc:"Powerful downward slash.",          mpCost:0,  cd:0, curCd:0, dmgPct:130,          sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"s_bash",   name:"Shield Bash",    icon:"🛡️", desc:"Stun chance on hit.",               mpCost:15, cd:2, curCd:0, dmgPct:80,  fx:"Stunned",  fxChance:.4, sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"whirl",    name:"Whirlwind",      icon:"🌀", desc:"Hits for high damage.",              mpCost:25, cd:3, curCd:0, dmgPct:160,          sType:"atk",  learned:false, slvl:0, maxLvl:5, reqId:"slash" },
    { id:"berserk",  name:"Berserker Rage", icon:"😡", desc:"Enrage self, +60% dmg 3 turns.",    mpCost:30, cd:4, curCd:0,              fx:"Enraged",  fxChance:1,  sType:"buff", learned:false, slvl:0, maxLvl:3, reqId:"s_bash" },
    { id:"bcry",     name:"Battle Cry",     icon:"📣", desc:"Restore 30 HP.",                    mpCost:20, cd:3, curCd:0, healAmt:30,          sType:"heal", learned:false, slvl:0, maxLvl:5 },
    { id:"devast",   name:"Devastator",     icon:"💥", desc:"Devastating blow: 280% damage.",    mpCost:50, cd:5, curCd:0, dmgPct:280,          sType:"atk",  learned:false, slvl:0, maxLvl:3, reqId:"whirl" },
  ],
  Mage: [
    { id:"fireball", name:"Fireball",       icon:"🔥", desc:"Ball of flame. Chance to burn.",    mpCost:15, cd:0, curCd:0, dmgPct:150, fx:"Burning",  fxChance:.3, sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"ice_shard",name:"Ice Shard",      icon:"❄️", desc:"Frozen shard, chance to freeze.",   mpCost:15, cd:1, curCd:0, dmgPct:120, fx:"Frozen",   fxChance:.4, sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"lightning",name:"Lightning Bolt", icon:"⚡", desc:"Chain lightning, massive damage.",  mpCost:25, cd:2, curCd:0, dmgPct:180,           sType:"atk",  learned:false, slvl:0, maxLvl:5, reqId:"fireball" },
    { id:"arcane",   name:"Arcane Blast",   icon:"💫", desc:"Pure arcane. Ignores 50% defense.", mpCost:30, cd:2, curCd:0, dmgPct:200,           sType:"atk",  learned:false, slvl:0, maxLvl:5, reqId:"ice_shard" },
    { id:"meteor",   name:"Meteor Strike",  icon:"☄️", desc:"Call down a meteor for 350% dmg.",  mpCost:60, cd:5, curCd:0, dmgPct:350,           sType:"atk",  learned:false, slvl:0, maxLvl:3, reqId:"lightning" },
    { id:"timestop", name:"Time Stop",      icon:"⏱️", desc:"Skip enemy turn (stun 2 rounds).", mpCost:45, cd:6, curCd:0,             fx:"Stunned",  fxChance:1,  sType:"buff", learned:false, slvl:0, maxLvl:2, reqId:"arcane" },
  ],
  Rogue: [
    { id:"backstab", name:"Backstab",       icon:"🗡️", desc:"Strike from shadow, 180% damage.", mpCost:10, cd:0, curCd:0, dmgPct:180,           sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"poison_d", name:"Poison Dagger",  icon:"🐍", desc:"Apply poison DoT.",                 mpCost:15, cd:2, curCd:0, dmgPct:80,  fx:"Poisoned", fxChance:.7, sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"smoke",    name:"Smoke Bomb",     icon:"💨", desc:"Vanish, bless self next turn.",     mpCost:20, cd:4, curCd:0,             fx:"Blessed",  fxChance:1,  sType:"buff", learned:false, slvl:0, maxLvl:3, reqId:"backstab" },
    { id:"fan_blade",name:"Fan of Blades",  icon:"🌪️", desc:"Throw 3 daggers, triple hit.",    mpCost:25, cd:3, curCd:0, dmgPct:90,            sType:"atk",  learned:false, slvl:0, maxLvl:5, reqId:"poison_d" },
    { id:"shad_str", name:"Shadow Strike",  icon:"🌑", desc:"From shadow realm: 220% damage.",  mpCost:35, cd:3, curCd:0, dmgPct:220,           sType:"atk",  learned:false, slvl:0, maxLvl:5, reqId:"smoke" },
    { id:"assassin", name:"Assassinate",    icon:"💀", desc:"Execute <30% HP for instant kill.", mpCost:45, cd:5, curCd:0, dmgPct:400,           sType:"atk",  learned:false, slvl:0, maxLvl:3, reqId:"shad_str" },
  ],
  Necromancer: [
    { id:"soul_dr",  name:"Soul Drain",     icon:"💀", desc:"Drain life from enemy to heal.",   mpCost:20, cd:1, curCd:0, dmgPct:100, healAmt:30,  sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"bone_sp",  name:"Bone Spear",     icon:"🦴", desc:"Hurl a sharpened bone javelin.",   mpCost:15, cd:0, curCd:0, dmgPct:140,              sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"raise_u",  name:"Raise Undead",   icon:"🧟", desc:"Raise a fallen enemy as ally.",    mpCost:40, cd:4, curCd:0,                          sType:"summon",learned:false, slvl:0, maxLvl:3, reqId:"soul_dr" },
    { id:"death_c",  name:"Death Coil",     icon:"🐍", desc:"Coil of death energy, DoT.",       mpCost:25, cd:3, curCd:0, dmgPct:80,  fx:"Poisoned", fxChance:1,  sType:"atk",  learned:false, slvl:0, maxLvl:5, reqId:"bone_sp" },
    { id:"corpse_x", name:"Corpse Explosion",icon:"💥",desc:"Detonate corpse: 300% damage.",    mpCost:50, cd:4, curCd:0, dmgPct:300,              sType:"atk",  learned:false, slvl:0, maxLvl:3, reqId:"raise_u" },
    { id:"lich_f",   name:"Lich Form",      icon:"☠️", desc:"Transform: +100% INT, -30% DEF.",  mpCost:60, cd:7, curCd:0,             fx:"Enraged",  fxChance:1,  sType:"buff", learned:false, slvl:0, maxLvl:1, reqId:"corpse_x" },
  ],
  Paladin: [
    { id:"holy_str", name:"Holy Strike",    icon:"✨", desc:"Strike blessed by divine power.",  mpCost:10, cd:0, curCd:0, dmgPct:120,              sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"lay_hand", name:"Lay on Hands",   icon:"🙏", desc:"Channel divinity to restore 100HP.", mpCost:30, cd:3, curCd:0, healAmt:100,           sType:"heal", learned:true,  slvl:1, maxLvl:5 },
    { id:"div_shld", name:"Divine Shield",  icon:"🛡️", desc:"Surround self in holy light, bless.", mpCost:25, cd:4, curCd:0, fx:"Blessed", fxChance:1, sType:"buff", learned:false, slvl:0, maxLvl:3, reqId:"holy_str" },
    { id:"smite",    name:"Smite",          icon:"⚡", desc:"Lightning smite: double vs undead.", mpCost:30, cd:2, curCd:0, dmgPct:160,            sType:"atk",  learned:false, slvl:0, maxLvl:5, reqId:"div_shld" },
    { id:"consecr",  name:"Consecration",   icon:"🌟", desc:"Holy ground: 100 AoE damage.",     mpCost:40, cd:4, curCd:0, dmgPct:100,              sType:"atk",  learned:false, slvl:0, maxLvl:3, reqId:"lay_hand" },
    { id:"holy_nova",name:"Holy Nova",      icon:"💫", desc:"Nova: 200 dmg + 60 heal.",          mpCost:55, cd:5, curCd:0, dmgPct:200, healAmt:60,  sType:"atk",  learned:false, slvl:0, maxLvl:3, reqId:"smite" },
  ],
  Ranger: [
    { id:"arrow_s",  name:"Arrow Shot",     icon:"🏹", desc:"Quick, accurate arrow shot.",       mpCost:0,  cd:0, curCd:0, dmgPct:120,             sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"poison_a", name:"Poison Arrow",   icon:"☠️", desc:"Arrow tipped with deadly poison.",  mpCost:15, cd:2, curCd:0, dmgPct:90,  fx:"Poisoned", fxChance:.8, sType:"atk",  learned:true,  slvl:1, maxLvl:5 },
    { id:"eagle_e",  name:"Eagle Eye",      icon:"👁️", desc:"+50% crit chance, mark target.",   mpCost:20, cd:3, curCd:0,             fx:"Marked",   fxChance:1,  sType:"buff", learned:false, slvl:0, maxLvl:3, reqId:"arrow_s" },
    { id:"multi_s",  name:"Multishot",      icon:"💨", desc:"Fire 3 arrows simultaneously.",     mpCost:25, cd:3, curCd:0, dmgPct:100,              sType:"atk",  learned:false, slvl:0, maxLvl:5, reqId:"poison_a" },
    { id:"rain_arr", name:"Rain of Arrows", icon:"🌧️", desc:"Volley of arrows: 200% damage.",   mpCost:45, cd:4, curCd:0, dmgPct:200,              sType:"atk",  learned:false, slvl:0, maxLvl:3, reqId:"multi_s" },
    { id:"hunt_mk",  name:"Hunter's Mark",  icon:"🎯", desc:"Mark enemy: +30% damage taken.",   mpCost:20, cd:4, curCd:0,             fx:"Marked",   fxChance:1,  sType:"buff", learned:false, slvl:0, maxLvl:5, reqId:"eagle_e" },
  ],
};

const AREAS: Area[] = [
  { id:"thornvale",  name:"Thornvale Village",    desc:"The last bastion of civilization, besieged by darkness.",                      icon:"🏘️", lvlRange:[1,3],   enemyIds:["goblin"],                                      hasDungeon:false, hasShop:true,  found:true  },
  { id:"darkwood",   name:"Darkwood Forest",      desc:"An ancient forest twisted by dark magic. Wolves and dark elves lurk here.",    icon:"🌲", lvlRange:[3,8],   enemyIds:["forest_wolf","dark_elf","giant_spider","vampire_bat"], hasDungeon:true,  hasShop:false, found:true  },
  { id:"crypts",     name:"Crypts of Aras",       desc:"Ancient catacombs filled with the undead. A civilization's grave.",            icon:"⚰️", lvlRange:[6,12],  enemyIds:["skeleton","undead_mage","vampire_bat","lich"],  hasDungeon:true,  hasShop:false, found:false },
  { id:"shadowpeak", name:"Shadowpeak Mountains", desc:"Towering dark mountains home to dark knights, trolls, and dragons.",          icon:"⛰️", lvlRange:[9,15],  enemyIds:["dark_knight","werewolf","stone_golem","dragon_wyrm","ancient_troll"], hasDungeon:true, hasShop:false, found:false },
  { id:"void_sanc",  name:"Void Sanctum",         desc:"A rift in reality where demons pour through. Only the powerful dare enter.",  icon:"🌀", lvlRange:[13,18], enemyIds:["demon_scout","shadow_stalk","void_wraith","blood_mage"], hasDungeon:true, hasShop:false, found:false },
  { id:"throne",     name:"Throne of Darkness",   desc:"The Shadow Lord's fortress. The source of all evil in this realm.",           icon:"🏰", lvlRange:[18,25], enemyIds:["bone_dragon","shadow_lord"],                   hasDungeon:true,  hasShop:false, found:false },
];

const QUESTS: Quest[] = [
  { id:"q1",  name:"The First Trial",       desc:"Prove your worth by slaying goblins in Thornvale.",         objs:[{txt:"Slay Goblins",cur:0,req:5,killId:"goblin"}],                                              xp:100,  gold:50,   iRewards:["minor_hp","minor_hp"],      status:"avail", minLvl:1  },
  { id:"q2",  name:"Stolen Artifacts",      desc:"Retrieve ancient rune fragments from the undead.",           objs:[{txt:"Collect Rune Fragments",cur:0,req:3,collectId:"rune_fragment"}],                          xp:200,  gold:100,  iRewards:["rune_fire"],                status:"avail", minLvl:2  },
  { id:"q3",  name:"The Dark Forest",       desc:"Explore the haunted forest and survive.",                    objs:[{txt:"Slay Forest Wolves",cur:0,req:3,killId:"forest_wolf"},{txt:"Slay Dark Elves",cur:0,req:3,killId:"dark_elf"}], xp:350, gold:150, iRewards:["shadow_ess"], status:"avail", minLvl:3 },
  { id:"q4",  name:"Alchemist's Request",   desc:"Gather reagents for the village alchemist.",                 objs:[{txt:"Gather Blessed Water",cur:0,req:3,collectId:"blessed_water"},{txt:"Gather Moonstone",cur:0,req:2,collectId:"moonstone"}], xp:200, gold:200, iRewards:["hp_pot","hp_pot","hp_pot"], status:"avail", minLvl:2 },
  { id:"q5",  name:"Vampire Plague",        desc:"The vampire bats spread a cursed plague across the land.",  objs:[{txt:"Slay Vampire Bats",cur:0,req:10,killId:"vampire_bat"}],                                   xp:450,  gold:220,  iRewards:["moonstone","sunstone"],     status:"avail", minLvl:4  },
  { id:"q6",  name:"Ancient Terror",        desc:"Ancient trolls have blockaded the mountain passes.",         objs:[{txt:"Slay Ancient Troll",cur:0,req:1,killId:"ancient_troll"}],                                 xp:700,  gold:400,  iRewards:["rune_earth","gold_ore"],    status:"avail", minLvl:9  },
  { id:"q7",  name:"Dragon's Threat",       desc:"A dragon terrorizes the eastern villages.",                  objs:[{txt:"Slay Dragon Wyrmling",cur:0,req:1,killId:"dragon_wyrm"}],                                 xp:800,  gold:500,  iRewards:["dragon_scale","dragons_eye"], status:"avail", minLvl:8 },
  { id:"q8",  name:"The Void Rift",         desc:"Close the void rift before demons pour through.",           objs:[{txt:"Slay Demon Scouts",cur:0,req:5,killId:"demon_scout"},{txt:"Slay Void Wraiths",cur:0,req:3,killId:"void_wraith"}], xp:1000, gold:600, iRewards:["void_crystal","rune_bolt"], status:"avail", minLvl:12 },
  { id:"q9",  name:"Lich's Curse",          desc:"Break the lich's curse on the Crypts of Aras.",             objs:[{txt:"Defeat the Lich",cur:0,req:1,killId:"lich"}],                                             xp:1200, gold:800,  iRewards:["bone_crown","void_crystal"],status:"avail", minLvl:15 },
  { id:"q10", name:"Final Darkness",        desc:"End the Shadow Lord's reign of terror forever.",             objs:[{txt:"Defeat Shadow Lord Malachar",cur:0,req:1,killId:"shadow_lord"}],                          xp:10000,gold:5000, iRewards:["staff_of_eternity","magi_ring"], status:"avail", minLvl:20 },
];

const RECIPES: Recipe[] = [
  { id:"r1",  name:"Iron Sword",         outId:"iron_sword",      outQty:1, ingredients:[{id:"iron_ore",qty:3}],                                             minLvl:1  },
  { id:"r2",  name:"Flamebrand",         outId:"flame_sword",     outQty:1, ingredients:[{id:"iron_ore",qty:5},{id:"hellfire_emb",qty:2}],                   minLvl:5  },
  { id:"r3",  name:"Shadow Blade",       outId:"shadow_blade",    outQty:1, ingredients:[{id:"shadow_ess",qty:4},{id:"silver_ore",qty:3}],                   minLvl:8  },
  { id:"r4",  name:"Void Staff",         outId:"void_staff",      outQty:1, ingredients:[{id:"void_crystal",qty:2},{id:"rune_fragment",qty:5}],              minLvl:10 },
  { id:"r5",  name:"Iron Breastplate",   outId:"iron_breastplate",outQty:1, ingredients:[{id:"iron_ore",qty:6}],                                             minLvl:1  },
  { id:"r6",  name:"Holy Armor",         outId:"holy_armor",      outQty:1, ingredients:[{id:"angel_tear",qty:2},{id:"blessed_water",qty:3},{id:"gold_ore",qty:2}], minLvl:12 },
  { id:"r7",  name:"Dragon Armor",       outId:"dragon_armor",    outQty:1, ingredients:[{id:"dragon_scale",qty:5},{id:"gold_ore",qty:3}],                   minLvl:15 },
  { id:"r8",  name:"Minor HP Potion x3", outId:"minor_hp",        outQty:3, ingredients:[{id:"blessed_water",qty:1},{id:"moonstone",qty:1}],                 minLvl:1  },
  { id:"r9",  name:"Health Potion x2",   outId:"hp_pot",          outQty:2, ingredients:[{id:"blessed_water",qty:2},{id:"moonstone",qty:1},{id:"hellfire_emb",qty:1}], minLvl:3 },
  { id:"r10", name:"Greater HP Potion",  outId:"big_hp",          outQty:1, ingredients:[{id:"blessed_water",qty:3},{id:"moonstone",qty:2},{id:"phoenix_feath",qty:1}], minLvl:8 },
  { id:"r11", name:"Void Crystal",       outId:"void_crystal",    outQty:1, ingredients:[{id:"rune_fragment",qty:5},{id:"dark_crystal",qty:2}],              minLvl:7  },
  { id:"r12", name:"Fire Rune",          outId:"rune_fire",       outQty:1, ingredients:[{id:"rune_fragment",qty:2},{id:"hellfire_emb",qty:2}],              minLvl:3  },
  { id:"r13", name:"Ice Rune",           outId:"rune_ice",        outQty:1, ingredients:[{id:"rune_fragment",qty:2},{id:"moonstone",qty:2}],                 minLvl:3  },
  { id:"r14", name:"Lightning Rune",     outId:"rune_bolt",       outQty:1, ingredients:[{id:"rune_fragment",qty:3},{id:"sunstone",qty:2}],                  minLvl:6  },
  { id:"r15", name:"Ring of Might",      outId:"ring_str",        outQty:1, ingredients:[{id:"gold_ore",qty:2},{id:"iron_ore",qty:2}],                       minLvl:2  },
  { id:"r16", name:"Amulet of Vitality", outId:"amulet_health",   outQty:1, ingredients:[{id:"gold_ore",qty:2},{id:"moonstone",qty:2},{id:"blessed_water",qty:1}], minLvl:4 },
  { id:"r17", name:"Bone Crown",         outId:"bone_crown",      outQty:1, ingredients:[{id:"rune_fragment",qty:4},{id:"dark_crystal",qty:3}],              minLvl:10 },
  { id:"r18", name:"Strength Elixir",    outId:"str_elixir",      outQty:1, ingredients:[{id:"hellfire_emb",qty:2},{id:"sunstone",qty:1}],                   minLvl:4  },
  { id:"r19", name:"Defense Tonic",      outId:"def_tonic",       outQty:1, ingredients:[{id:"iron_ore",qty:2},{id:"moonstone",qty:1}],                      minLvl:4  },
  { id:"r20", name:"Dragon's Eye",       outId:"dragons_eye",     outQty:1, ingredients:[{id:"dragon_scale",qty:2},{id:"gold_ore",qty:3},{id:"sunstone",qty:1}], minLvl:12 },
];

const ACHIEVEMENTS = [
  { id:"a_first_blood", name:"First Blood",      icon:"⚔️", desc:"Win your first battle.",           check:(s:GState)=>s.player.wins>=1 },
  { id:"a_goblin10",    name:"Goblin Slayer",     icon:"👺", desc:"Kill 10 goblins.",                 check:(s:GState)=>(s.player.kills["goblin"]||0)>=10 },
  { id:"a_lvl5",        name:"Seasoned Warrior",  icon:"⭐", desc:"Reach level 5.",                   check:(s:GState)=>s.player.lvl>=5 },
  { id:"a_lvl10",       name:"Veteran",           icon:"🌟", desc:"Reach level 10.",                  check:(s:GState)=>s.player.lvl>=10 },
  { id:"a_lvl20",       name:"Legend",            icon:"👑", desc:"Reach level 20.",                  check:(s:GState)=>s.player.lvl>=20 },
  { id:"a_rich",        name:"Rich Adventurer",   icon:"💰", desc:"Accumulate 1000 gold.",            check:(s:GState)=>s.player.gold>=1000 },
  { id:"a_crafter",     name:"Master Crafter",    icon:"🔨", desc:"Craft 10 items.",                  check:(s:GState)=>s.player.crafts>=10 },
  { id:"a_dragon",      name:"Dragon Slayer",     icon:"🐉", desc:"Slay a Dragon Wyrmling.",          check:(s:GState)=>(s.player.kills["dragon_wyrm"]||0)>=1 },
  { id:"a_flee",        name:"Coward's Wisdom",   icon:"🏃", desc:"Flee from 3 battles.",             check:(s:GState)=>s.player.flees>=3 },
  { id:"a_dungeon",     name:"Dungeon Crawler",   icon:"🗺️", desc:"Clear 5 dungeon floors.",          check:(s:GState)=>s.player.floorsCleared>=5 },
  { id:"a_shadow_lord", name:"World Savior",       icon:"🌍", desc:"Defeat Shadow Lord Malachar.",    check:(s:GState)=>(s.player.kills["shadow_lord"]||0)>=1 },
  { id:"a_collector",   name:"Item Collector",    icon:"🎒", desc:"Collect 30 unique items.",         check:(s:GState)=>s.player.inv.length>=30 },
];

const SHOP_STOCK_IDS = ["minor_hp","hp_pot","big_hp","minor_mp","mp_pot","str_elixir","def_tonic","swift_elix","iron_sword","iron_breastplate","iron_helm","iron_boots","iron_gauntlets","ring_str","ring_int","ring_agi","blessed_water","moonstone","sunstone","rune_fragment","hellfire_emb","iron_ore","silver_ore"];

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

const RARITY_COLORS: Record<Rarity, string> = {
  Common: "text-gray-400", Uncommon: "text-green-400", Rare: "text-blue-400",
  Epic: "text-purple-400", Legendary: "text-orange-400", Mythic: "text-red-400",
};
const RARITY_BG: Record<Rarity, string> = {
  Common: "bg-gray-800/60", Uncommon: "bg-green-950/60", Rare: "bg-blue-950/60",
  Epic: "bg-purple-950/60", Legendary: "bg-orange-950/60", Mythic: "bg-red-950/60",
};
const RARITY_BORDER: Record<Rarity, string> = {
  Common: "border-gray-700", Uncommon: "border-green-800", Rare: "border-blue-800",
  Epic: "border-purple-700", Legendary: "border-orange-700", Mythic: "border-red-700",
};
const CLASS_ICONS: Record<HeroClass, string> = {
  Warrior: "⚔️", Mage: "🔮", Rogue: "🗡️", Necromancer: "💀", Paladin: "✝️", Ranger: "🏹",
};
const CLASS_DESC: Record<HeroClass, string> = {
  Warrior: "Ironclad warrior who masters physical combat and can withstand tremendous punishment.",
  Mage: "Arcane scholar who wields the fundamental forces of the universe as weapons.",
  Rogue: "Shadow operative who strikes from darkness with lethal precision and cunning.",
  Necromancer: "Master of death who bends the boundary between life and undeath.",
  Paladin: "Holy champion who channels divine power to smite evil and heal allies.",
  Ranger: "Wilderness hunter who tracks prey with unmatched precision from afar.",
};
const CLASS_BASE: Record<HeroClass, StatBlock & { hp: number; mp: number }> = {
  Warrior:     { str:12, int:4,  agi:6,  def:8,  lck:5,  hp:120, mp:40  },
  Mage:        { str:4,  int:14, agi:7,  def:3,  lck:6,  hp:60,  mp:120 },
  Rogue:       { str:8,  int:6,  agi:14, def:5,  lck:10, hp:80,  mp:60  },
  Necromancer: { str:5,  int:12, agi:6,  def:4,  lck:7,  hp:70,  mp:100 },
  Paladin:     { str:10, int:8,  agi:5,  def:10, lck:6,  hp:110, mp:70  },
  Ranger:      { str:7,  int:6,  agi:13, def:5,  lck:9,  hp:90,  mp:60  },
};

const SFX_ICONS: Partial<Record<SFX, string>> = {
  Burning:"🔥", Frozen:"❄️", Poisoned:"☠️", Stunned:"💫", Bleeding:"🩸", Blessed:"✨", Enraged:"😡", Marked:"🎯",
};

function getEquipStats(equip: Partial<Record<Slot, string>>): IStats {
  const total: IStats = {};
  Object.values(equip).forEach(id => {
    if (!id) return;
    const item = ITEMS[id];
    if (!item?.stats) return;
    (Object.keys(item.stats) as (keyof IStats)[]).forEach(k => {
      total[k] = (total[k] ?? 0) + (item.stats![k] ?? 0);
    });
  });
  return total;
}

function getEffStats(p: GState["player"]): StatBlock & { maxHp: number; maxMp: number } {
  const eq = getEquipStats(p.equip);
  return {
    str: p.base.str + (eq.str ?? 0),
    int: p.base.int + (eq.int ?? 0),
    agi: p.base.agi + (eq.agi ?? 0),
    def: p.base.def + (eq.def ?? 0),
    lck: p.base.lck + (eq.lck ?? 0),
    maxHp: p.maxHp + (eq.hp ?? 0),
    maxMp: p.maxMp + (eq.mp ?? 0),
  };
}

function calcDmg(stat: number, dmgPct: number, enemyDef: number, ignoreDef = false): number {
  const base = stat * 1.5 * (dmgPct / 100);
  const reduced = ignoreDef ? base : Math.max(1, base - enemyDef * 0.4);
  return Math.max(1, Math.round(reduced));
}

function rollLoot(enemy: Enemy): InvItem[] {
  const out: InvItem[] = [];
  enemy.loot.forEach(l => {
    if (Math.random() < l.pct) {
      const item = ITEMS[l.id];
      if (item) out.push({ ...item, qty: 1 });
    }
  });
  return out;
}

function xpForLevel(lvl: number): number {
  return Math.floor(100 * Math.pow(1.4, lvl - 1));
}

function addToInv(inv: InvItem[], item: InvItem): InvItem[] {
  const existing = inv.findIndex(i => i.id === item.id);
  if (existing >= 0 && item.type !== "Weapon" && item.type !== "Chest" && item.type !== "Helmet" && item.type !== "Gloves" && item.type !== "Boots") {
    const updated = [...inv];
    updated[existing] = { ...updated[existing], qty: updated[existing].qty + item.qty };
    return updated;
  }
  return [...inv, { ...item, qty: item.qty }];
}

function removeFromInv(inv: InvItem[], id: string, qty = 1): InvItem[] {
  return inv.map(i => i.id === id ? { ...i, qty: i.qty - qty } : i).filter(i => i.qty > 0);
}

function generateShopStock(): InvItem[] {
  return SHOP_STOCK_IDS.map(id => ({
    ...ITEMS[id], qty: Math.floor(Math.random() * 5) + 3,
  }));
}

// ─────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────

function makeInitialState(): GState {
  return {
    player: {
      name: "", cls: "Warrior", lvl: 1, xp: 0, xpNext: xpForLevel(1),
      hp: 120, maxHp: 120, mp: 40, maxMp: 40,
      base: { str:12, int:4, agi:6, def:8, lck:5 },
      freePoints: 0, gold: 100,
      inv: [
        { ...ITEMS["minor_hp"], qty: 3 },
        { ...ITEMS["iron_ore"], qty: 5 },
        { ...ITEMS["blessed_water"], qty: 2 },
      ],
      equip: {},
      skills: CLASS_SKILLS["Warrior"].map(s => ({ ...s })),
      sfx: {},
      achieved: [], activeQ: [], doneQ: [],
      kills: {}, crafts: 0, wins: 0, flees: 0, floorsCleared: 0,
    },
    screen: "title",
    areaId: "thornvale",
    combat: { enemy:null, log:[], playerTurn:true, over:false, result:null, loot:[], xpGain:0, goldGain:0 },
    dungeon: { areaId:"darkwood", floor:1, maxFloor:5 },
    coop: {
      code: "", isLeader: true,
      party: [
        { id:"bot1", name:"Aldric", cls:"Warrior", lvl:1, hp:120, maxHp:120, ready:true, isBot:true },
        { id:"bot2", name:"Sylvara", cls:"Mage",   lvl:1, hp:60,  maxHp:60,  ready:false, isBot:true },
      ],
      chat: [
        { who:"Aldric", msg:"Ready to descend into the darkness?", time:Date.now()-60000 },
        { who:"System", msg:"Party created. Waiting for members...", time:Date.now()-30000 },
      ],
    },
    quests: QUESTS.map(q => ({ ...q, objs: q.objs.map(o => ({ ...o })) })),
    notifs: [],
    shop: generateShopStock(),
    _notifId: 0,
  };
}

function applyClassToState(state: GState, cls: HeroClass, name: string): GState {
  const base = CLASS_BASE[cls];
  return {
    ...state,
    player: {
      ...state.player,
      name, cls,
      hp: base.hp, maxHp: base.hp,
      mp: base.mp, maxMp: base.mp,
      base: { str: base.str, int: base.int, agi: base.agi, def: base.def, lck: base.lck },
      skills: CLASS_SKILLS[cls].map(s => ({ ...s })),
      inv: [
        { ...ITEMS["minor_hp"], qty: 3 },
        { ...ITEMS["iron_ore"], qty: 5 },
        { ...ITEMS["blessed_water"], qty: 2 },
        { ...ITEMS[cls === "Warrior" ? "iron_sword" : cls === "Mage" ? "apprentice_staff" : cls === "Rogue" ? "silver_dagger" : cls === "Necromancer" ? "bone_wand" : cls === "Paladin" ? "holy_mace" : "hunters_bow"], qty: 1 },
      ],
    },
  };
}

// ─────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────

function HPBar({ cur, max, color = "bg-red-600" }: { cur: number; max: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  return (
    <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden border border-zinc-800">
      <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatRow({ label, value, color = "text-amber-200" }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-amber-600/80 text-xs font-mono uppercase tracking-wide">{label}</span>
      <span className={`font-mono font-semibold text-sm ${color}`}>{value}</span>
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", className = "" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "primary" | "danger" | "ghost" | "gold" | "dark"; className?: string;
}) {
  const base = "px-3 py-2 text-sm font-semibold tracking-wide transition-all duration-150 border disabled:opacity-40 disabled:cursor-not-allowed active:scale-95";
  const variants = {
    primary: "bg-red-900/80 hover:bg-red-800 border-red-700 text-amber-100",
    danger:  "bg-red-950/80 hover:bg-red-900 border-red-800 text-red-300",
    ghost:   "bg-transparent hover:bg-amber-900/20 border-amber-900/40 text-amber-300",
    gold:    "bg-amber-900/60 hover:bg-amber-800/80 border-amber-700 text-amber-100",
    dark:    "bg-zinc-900/80 hover:bg-zinc-800 border-zinc-700 text-amber-200",
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      style={{ fontFamily: "'Cinzel', serif", borderRadius: "2px" }}
    >
      {children}
    </button>
  );
}

function Panel({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <div className={`bg-card border border-border ${className}`} style={{ borderRadius: "3px" }}>
      {title && (
        <div className="border-b border-border px-4 py-2">
          <h3 className="text-amber-400 text-sm font-semibold tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

function Badge({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 font-mono ${RARITY_COLORS[rarity]} ${RARITY_BG[rarity]} border ${RARITY_BORDER[rarity]}`} style={{ borderRadius: "2px" }}>
      {rarity}
    </span>
  );
}

function TierBadge({ tier }: { tier: Enemy["tier"] }) {
  const map = { n: ["text-gray-400","Normal"], e: ["text-yellow-400","Elite"], b: ["text-orange-400","Boss"], l: ["text-red-400","Legendary"] };
  const [c, t] = map[tier];
  return <span className={`text-xs font-mono font-bold ${c}`}>{t}</span>;
}

function SFXBadge({ fx }: { fx: SFX }) {
  return (
    <span className="text-xs px-1 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-amber-200 font-mono">
      {SFX_ICONS[fx]}{fx}
    </span>
  );
}

// ─────────────────────────────────────────
// TITLE SCREEN
// ─────────────────────────────────────────

function TitleScreen({ onStart, onLoad }: { onStart: () => void; onLoad: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 100);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="size-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 60%, #1a0508 0%, #060304 70%)" }}>
      {/* Background particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="absolute w-1 h-1 rounded-full bg-amber-600/20 animate-pulse"
          style={{ left: `${(i * 37 + 10) % 100}%`, top: `${(i * 53 + 5) % 100}%`, animationDelay: `${i * 0.3}s` }} />
      ))}

      <div className="text-center z-10 space-y-6 px-8">
        <div className="space-y-2">
          <div className="text-amber-600/60 text-sm tracking-[0.4em] uppercase font-mono mb-4">A Dark Fantasy RPG</div>
          <h1 className="text-6xl md:text-8xl font-black text-amber-400 tracking-wider leading-none"
            style={{ fontFamily: "'Cinzel Decorative', serif", textShadow: "0 0 40px rgba(201,162,39,0.4), 0 0 80px rgba(139,26,26,0.3)" }}>
            SHADOW
          </h1>
          <h1 className="text-6xl md:text-8xl font-black text-red-800 tracking-wider leading-none"
            style={{ fontFamily: "'Cinzel Decorative', serif", textShadow: "0 0 40px rgba(139,26,26,0.6)" }}>
            REALM
          </h1>
          <div className="text-amber-700/80 text-xl tracking-[0.6em] uppercase font-light mt-2"
            style={{ fontFamily: "'Cinzel', serif" }}>
            Chronicles
          </div>
        </div>

        <div className="w-48 h-px bg-gradient-to-r from-transparent via-amber-600/60 to-transparent mx-auto" />

        <p className="text-amber-200/60 text-sm max-w-md mx-auto leading-relaxed" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.1rem" }}>
          A darkness consumes the realm. Ancient evils stir in the depths.
          Only a true hero can venture into the shadow and emerge victorious.
        </p>

        <div className="flex flex-col gap-3 items-center mt-8">
          <Btn onClick={onStart} variant="gold" className="w-64 py-3 text-base">
            ⚔️ Begin Your Journey
          </Btn>
          <Btn onClick={onLoad} variant="ghost" className="w-64 py-3">
            📜 Continue Adventure
          </Btn>
        </div>

        <div className="text-amber-800/40 text-xs font-mono mt-8 space-x-4">
          <span>6 CHARACTER CLASSES</span>
          <span>·</span>
          <span>60+ ITEMS</span>
          <span>·</span>
          <span>CO-OP PARTY</span>
          <span>·</span>
          <span>6 AREAS</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// CHARACTER CREATION
// ─────────────────────────────────────────

function CharCreateScreen({ onCreate }: { onCreate: (cls: HeroClass, name: string) => void }) {
  const [cls, setCls] = useState<HeroClass>("Warrior");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const classes: HeroClass[] = ["Warrior", "Mage", "Rogue", "Necromancer", "Paladin", "Ranger"];
  const base = CLASS_BASE[cls];

  function handleCreate() {
    if (!name.trim()) { setNameError("Enter a name for your hero."); return; }
    if (name.length < 2) { setNameError("Name must be at least 2 characters."); return; }
    onCreate(cls, name.trim());
  }

  return (
    <div className="size-full flex flex-col bg-background overflow-auto">
      <div className="text-center py-6 border-b border-border">
        <h2 className="text-3xl text-amber-400 tracking-widest" style={{ fontFamily: "'Cinzel Decorative', serif" }}>Choose Your Destiny</h2>
        <p className="text-amber-700/80 text-sm mt-1" style={{ fontFamily: "'Crimson Text', serif" }}>Select a class and forge your legend</p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 max-w-5xl mx-auto w-full p-4 gap-4">
        {/* Class selector */}
        <div className="space-y-2">
          <h3 className="text-amber-500 text-xs tracking-widest uppercase font-mono mb-3">Character Class</h3>
          <div className="grid grid-cols-2 gap-2">
            {classes.map(c => (
              <button key={c} onClick={() => setCls(c)}
                className={`p-3 border text-left transition-all ${cls === c ? "border-amber-500 bg-amber-900/20" : "border-border hover:border-amber-800/60 bg-card/50"}`}
                style={{ borderRadius: "3px" }}>
                <div className="text-2xl mb-1">{CLASS_ICONS[c]}</div>
                <div className="text-amber-200 text-sm font-semibold" style={{ fontFamily: "'Cinzel', serif" }}>{c}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Class details + stats */}
        <div className="space-y-3">
          <Panel title={`${CLASS_ICONS[cls]} ${cls}`}>
            <div className="p-4 space-y-3">
              <p className="text-amber-200/80 text-sm leading-relaxed" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1rem" }}>
                {CLASS_DESC[cls]}
              </p>
              <div className="border-t border-border pt-3 space-y-1">
                <StatRow label="Strength"     value={base.str} color={base.str >= 10 ? "text-red-400" : "text-amber-200"} />
                <StatRow label="Intelligence" value={base.int} color={base.int >= 10 ? "text-blue-400" : "text-amber-200"} />
                <StatRow label="Agility"      value={base.agi} color={base.agi >= 10 ? "text-green-400" : "text-amber-200"} />
                <StatRow label="Defense"      value={base.def} color={base.def >= 10 ? "text-yellow-400" : "text-amber-200"} />
                <StatRow label="Luck"         value={base.lck} />
                <div className="flex justify-between text-xs font-mono mt-2 pt-2 border-t border-border/50">
                  <span className="text-red-400">❤️ {base.hp} HP</span>
                  <span className="text-blue-400">💧 {base.mp} MP</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Starting skills */}
          <Panel title="Starting Abilities">
            <div className="p-3 space-y-2">
              {CLASS_SKILLS[cls].filter(s => s.learned).map(s => (
                <div key={s.id} className="flex items-start gap-2">
                  <span className="text-xl">{s.icon}</span>
                  <div>
                    <div className="text-amber-300 text-xs font-semibold">{s.name}</div>
                    <div className="text-amber-700/80 text-xs">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Name input */}
      <div className="max-w-5xl mx-auto w-full px-4 pb-6 space-y-3">
        <div>
          <label className="text-amber-500/80 text-xs tracking-widest uppercase font-mono block mb-1.5">Hero Name</label>
          <input
            value={name} onChange={e => { setName(e.target.value); setNameError(""); }}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="Enter your hero's name..."
            className="w-full bg-card border border-border px-4 py-3 text-amber-100 placeholder-amber-800/60 focus:outline-none focus:border-amber-600 text-sm"
            style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.1rem", borderRadius: "2px" }}
          />
          {nameError && <div className="text-red-400 text-xs mt-1 font-mono">{nameError}</div>}
        </div>
        <Btn onClick={handleCreate} variant="gold" className="w-full py-3 text-base">
          ⚔️ Enter the Shadowrealm
        </Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// HUD (persistent top bar)
// ─────────────────────────────────────────

function HUD({ state, onScreen }: { state: GState; onScreen: (s: Screen) => void }) {
  const p = state.player;
  const eff = getEffStats(p);
  const xpPct = (p.xp / p.xpNext) * 100;

  return (
    <div className="bg-card border-b border-border px-2 py-2 flex items-center gap-2 flex-wrap text-xs" style={{ minHeight: "52px" }}>
      {/* Name + class */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <span className="text-xl">{CLASS_ICONS[p.cls]}</span>
        <div>
          <div className="text-amber-300 font-semibold text-sm leading-none" style={{ fontFamily: "'Cinzel', serif" }}>{p.name}</div>
          <div className="text-amber-700/80 font-mono">Lv.{p.lvl} {p.cls}</div>
        </div>
      </div>

      {/* HP */}
      <div className="flex-1 min-w-[100px] max-w-[160px]">
        <div className="flex justify-between text-xs font-mono mb-0.5">
          <span className="text-red-400">❤️ HP</span>
          <span className="text-red-300">{p.hp}/{eff.maxHp}</span>
        </div>
        <HPBar cur={p.hp} max={eff.maxHp} color="bg-red-700" />
      </div>

      {/* MP */}
      <div className="flex-1 min-w-[100px] max-w-[160px]">
        <div className="flex justify-between text-xs font-mono mb-0.5">
          <span className="text-blue-400">💧 MP</span>
          <span className="text-blue-300">{p.mp}/{eff.maxMp}</span>
        </div>
        <HPBar cur={p.mp} max={eff.maxMp} color="bg-blue-700" />
      </div>

      {/* XP */}
      <div className="flex-1 min-w-[100px] max-w-[140px]">
        <div className="flex justify-between text-xs font-mono mb-0.5">
          <span className="text-purple-400">✨ XP</span>
          <span className="text-purple-300">{p.xp}/{p.xpNext}</span>
        </div>
        <HPBar cur={p.xp} max={p.xpNext} color="bg-purple-700" />
      </div>

      {/* Gold */}
      <div className="flex items-center gap-1 font-mono font-semibold text-amber-400 min-w-[70px]">
        <span>💰</span>
        <span>{p.gold.toLocaleString()}</span>
      </div>

      {/* Status effects */}
      <div className="flex gap-1 flex-wrap">
        {(Object.entries(p.sfx) as [SFX, number][]).filter(([, d]) => d > 0).map(([fx, dur]) => (
          <span key={fx} className="text-xs bg-zinc-900 border border-zinc-700 px-1 rounded font-mono text-amber-200">
            {SFX_ICONS[fx]}{dur}t
          </span>
        ))}
      </div>

      {/* Stat points indicator */}
      {p.freePoints > 0 && (
        <button onClick={() => onScreen("equipment")} className="text-xs bg-amber-900/40 border border-amber-600 px-2 py-1 text-amber-300 animate-pulse font-mono" style={{ borderRadius: "2px" }}>
          ⬆️ {p.freePoints} pts
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// BOTTOM NAV
// ─────────────────────────────────────────

function BottomNav({ screen, onScreen }: { screen: Screen; onScreen: (s: Screen) => void }) {
  const tabs: { id: Screen; icon: string; label: string }[] = [
    { id:"world",        icon:"🗺️", label:"World"    },
    { id:"combat",       icon:"⚔️", label:"Fight"    },
    { id:"inventory",    icon:"🎒", label:"Items"    },
    { id:"equipment",    icon:"🛡️", label:"Char"     },
    { id:"skills",       icon:"✨", label:"Skills"   },
    { id:"crafting",     icon:"🔨", label:"Craft"    },
    { id:"shop",         icon:"🏪", label:"Shop"     },
    { id:"quests",       icon:"📜", label:"Quests"   },
    { id:"dungeon",      icon:"🏰", label:"Dungeon"  },
    { id:"coop",         icon:"👥", label:"Co-op"    },
    { id:"achievements", icon:"🏆", label:"Awards"   },
  ];

  return (
    <div className="border-t border-border bg-card flex overflow-x-auto" style={{ minHeight: "52px" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onScreen(t.id)}
          className={`flex flex-col items-center justify-center flex-shrink-0 px-3 py-1.5 min-w-[60px] transition-colors border-r border-border/40 ${screen === t.id ? "bg-amber-900/30 text-amber-400" : "text-amber-700 hover:text-amber-400 hover:bg-amber-900/10"}`}>
          <span className="text-base leading-none">{t.icon}</span>
          <span className="text-[9px] mt-0.5 font-mono uppercase tracking-wide">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// WORLD MAP SCREEN
// ─────────────────────────────────────────

function WorldScreen({ state, onExplore, onEnterShop }: { state: GState; onExplore: (areaId: string) => void; onEnterShop: () => void }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl text-amber-400 tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>World Map</h2>
          <p className="text-amber-700/60 text-sm mt-1 font-mono">Choose your destination</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AREAS.map(area => {
            const locked = !area.found && area.lvlRange[0] > 1;
            const playerLvl = state.player.lvl;
            const recommended = playerLvl >= area.lvlRange[0] && playerLvl <= area.lvlRange[1];
            const tooLow = playerLvl < area.lvlRange[0];

            return (
              <div key={area.id}
                onMouseEnter={() => setHovered(area.id)}
                onMouseLeave={() => setHovered(null)}
                className={`p-4 border transition-all cursor-pointer ${locked ? "opacity-50 cursor-not-allowed border-zinc-800 bg-zinc-950" : hovered === area.id ? "border-amber-600/60 bg-amber-900/10" : "border-border bg-card"}`}
                style={{ borderRadius: "3px" }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{area.icon}</span>
                    <div>
                      <div className="text-amber-300 font-semibold text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                        {locked ? "???" : area.name}
                      </div>
                      <div className={`text-xs font-mono mt-0.5 ${tooLow ? "text-red-500" : recommended ? "text-green-400" : "text-amber-600"}`}>
                        Lv. {area.lvlRange[0]}–{area.lvlRange[1]}
                        {tooLow && " ⚠️ Dangerous"}
                        {recommended && " ✓ Recommended"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {area.hasDungeon && !locked && <span className="text-xs bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 text-amber-600 font-mono">Dungeon</span>}
                    {area.hasShop && !locked && <span className="text-xs bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 text-green-600 font-mono">Shop</span>}
                  </div>
                </div>

                {!locked && (
                  <>
                    <p className="text-amber-200/60 text-xs leading-relaxed mb-3" style={{ fontFamily: "'Crimson Text', serif", fontSize: "0.95rem" }}>
                      {area.desc}
                    </p>
                    <div className="flex gap-2">
                      <Btn onClick={() => onExplore(area.id)} variant="primary" className="flex-1 text-xs py-1.5">
                        ⚔️ Explore
                      </Btn>
                      {area.hasShop && (
                        <Btn onClick={onEnterShop} variant="dark" className="flex-1 text-xs py-1.5">
                          🏪 Shop
                        </Btn>
                      )}
                    </div>
                  </>
                )}

                {locked && (
                  <div className="text-zinc-600 text-xs font-mono mt-2">🔒 Reach level {area.lvlRange[0]} to unlock</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// COMBAT SCREEN
// ─────────────────────────────────────────

function CombatScreen({ state, onAction, onFlee, onLootClose }: {
  state: GState;
  onAction: (action: "basic" | "skill" | "item", skillId?: string, itemId?: string) => void;
  onFlee: () => void;
  onLootClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"skills" | "items">("skills");
  const logRef = useRef<HTMLDivElement>(null);
  const { combat, player } = state;
  const enemy = combat.enemy;
  const eff = getEffStats(player);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [combat.log]);

  if (!enemy && !combat.over) {
    return (
      <div className="flex-1 flex items-center justify-center text-amber-600 font-mono">
        No enemy encountered. Explore an area to find enemies.
      </div>
    );
  }

  // Loot screen
  if (combat.over && combat.result === "win") {
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-3xl text-amber-400" style={{ fontFamily: "'Cinzel Decorative', serif" }}>Victory!</h2>
            <p className="text-amber-200/80 mt-2 font-mono text-sm">
              +{combat.xpGain} XP · +{combat.goldGain} Gold
            </p>
          </div>

          {combat.loot.length > 0 && (
            <Panel title="Loot Obtained" className="mb-4">
              <div className="p-3 space-y-2">
                {combat.loot.map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 p-2 border ${RARITY_BORDER[item.rarity]} ${RARITY_BG[item.rarity]}`} style={{ borderRadius: "2px" }}>
                    <span className="text-xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${RARITY_COLORS[item.rarity]}`} style={{ fontFamily: "'Cinzel', serif" }}>{item.name}</div>
                      <Badge rarity={item.rarity} />
                    </div>
                    <span className="text-amber-600 font-mono text-sm">x{item.qty}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Btn onClick={onLootClose} variant="gold" className="w-full py-3">
            Continue Adventure →
          </Btn>
        </div>
      </div>
    );
  }

  if (combat.over && combat.result === "lose") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">💀</div>
        <h2 className="text-4xl text-red-500 mb-3" style={{ fontFamily: "'Cinzel Decorative', serif" }}>Defeated</h2>
        <p className="text-amber-200/60 mb-6 font-mono">The darkness has consumed you... but you awaken in the village.</p>
        <Btn onClick={onLootClose} variant="danger" className="px-8 py-3">
          Return to Safety
        </Btn>
      </div>
    );
  }

  if (combat.over && combat.result === "flee") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">🏃</div>
        <h2 className="text-3xl text-amber-400 mb-3" style={{ fontFamily: "'Cinzel', serif" }}>You Fled!</h2>
        <p className="text-amber-200/60 mb-6 font-mono">You lived to fight another day.</p>
        <Btn onClick={onLootClose} variant="ghost" className="px-8 py-3">Return to World</Btn>
      </div>
    );
  }

  if (!enemy) return null;

  const learnedSkills = player.skills.filter(s => s.learned);
  const usableItems = player.inv.filter(i => i.type === "Potion");

  return (
    <div className="flex-1 overflow-auto flex flex-col gap-3 p-3">
      {/* Enemy panel */}
      <Panel>
        <div className="p-4 flex items-center gap-4">
          <div className="text-center">
            <div className="text-5xl mb-1" style={{ filter: "drop-shadow(0 0 8px rgba(139,26,26,0.6))" }}>{enemy.icon}</div>
            <TierBadge tier={enemy.tier} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-amber-300 font-semibold text-lg" style={{ fontFamily: "'Cinzel', serif" }}>{enemy.name}</h3>
              <span className="text-red-400 font-mono font-bold">{enemy.curHp}/{enemy.maxHp}</span>
            </div>
            <HPBar cur={enemy.curHp} max={enemy.maxHp} color={enemy.curHp / enemy.maxHp < 0.3 ? "bg-red-800 animate-pulse" : "bg-red-700"} />
            <div className="flex gap-1 mt-2 flex-wrap">
              {(Object.entries(enemy.sfx) as [SFX, number][]).filter(([, d]) => d > 0).map(([fx, dur]) => (
                <SFXBadge key={fx} fx={fx} />
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* Battle log */}
      <Panel title="Battle Log" className="flex-1">
        <div ref={logRef} className="p-3 h-28 overflow-y-auto space-y-1">
          {combat.log.slice(-20).map((line, i) => (
            <div key={i} className={`text-xs font-mono leading-relaxed ${line.startsWith("You") || line.startsWith("Your") ? "text-amber-300" : line.includes("defeated") ? "text-green-400 font-bold" : line.includes("⚠️") || line.includes("loses") ? "text-red-400" : "text-amber-600/80"}`}>
              {line}
            </div>
          ))}
          {combat.playerTurn && !combat.over && (
            <div className="text-amber-500 text-xs font-mono animate-pulse">▶ Your turn...</div>
          )}
          {!combat.playerTurn && !combat.over && (
            <div className="text-red-500/70 text-xs font-mono animate-pulse">Enemy is acting...</div>
          )}
        </div>
      </Panel>

      {/* Actions */}
      <div className="space-y-2">
        {/* Tab switcher */}
        <div className="flex gap-2">
          {(["skills", "items"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wide border transition-colors ${activeTab === tab ? "bg-amber-900/40 border-amber-600 text-amber-300" : "border-border bg-card text-amber-700 hover:border-amber-800"}`}
              style={{ borderRadius: "2px" }}>
              {tab === "skills" ? `✨ Skills (${learnedSkills.length})` : `🧪 Items (${usableItems.length})`}
            </button>
          ))}
        </div>

        {activeTab === "skills" && (
          <div className="grid grid-cols-2 gap-2">
            {/* Basic attack */}
            <Btn onClick={() => onAction("basic")} disabled={!combat.playerTurn || combat.over} variant="primary" className="flex flex-col items-start gap-0.5 p-3">
              <span className="text-base">⚔️ Basic Attack</span>
              <span className="text-xs text-amber-700/80 font-normal">No MP cost</span>
            </Btn>

            {learnedSkills.map(skill => (
              <button key={skill.id}
                disabled={!combat.playerTurn || combat.over || player.mp < skill.mpCost || skill.curCd > 0}
                onClick={() => onAction("skill", skill.id)}
                className={`p-3 border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${!combat.playerTurn || combat.over || player.mp < skill.mpCost || skill.curCd > 0 ? "border-zinc-800 bg-zinc-950/80" : "border-amber-900/60 bg-amber-950/40 hover:border-amber-600/60 hover:bg-amber-900/20"}`}
                style={{ borderRadius: "2px" }}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm">{skill.icon} {skill.name}</span>
                  {skill.curCd > 0 && <span className="text-xs text-red-500 font-mono">CD:{skill.curCd}</span>}
                </div>
                <div className="text-xs text-amber-700/70 font-mono">
                  {skill.mpCost > 0 ? `💧${skill.mpCost} MP` : "Free"}
                  {skill.dmgPct && ` · ${skill.dmgPct}% dmg`}
                  {skill.healAmt && ` · +${skill.healAmt} HP`}
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === "items" && (
          <div className="grid grid-cols-2 gap-2">
            {usableItems.length === 0 && (
              <div className="col-span-2 text-amber-700/60 text-xs font-mono text-center py-4">No usable items in inventory</div>
            )}
            {usableItems.map(item => (
              <Btn key={item.id} onClick={() => onAction("item", undefined, item.id)}
                disabled={!combat.playerTurn || combat.over} variant="dark" className="flex items-center gap-2 p-2">
                <span className="text-lg">{item.icon}</span>
                <div className="text-left">
                  <div className="text-xs font-semibold">{item.name}</div>
                  <div className="text-xs text-amber-700/70 font-mono">x{item.qty}</div>
                </div>
              </Btn>
            ))}
          </div>
        )}

        {/* Flee button */}
        <Btn onClick={onFlee} disabled={!combat.playerTurn || combat.over} variant="ghost" className="w-full text-xs py-2">
          🏃 Flee from Battle
        </Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// INVENTORY SCREEN
// ─────────────────────────────────────────

function InventoryScreen({ state, onUse, onEquip, onDrop, onSell }: {
  state: GState;
  onUse: (id: string) => void;
  onEquip: (id: string) => void;
  onDrop: (id: string) => void;
  onSell: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [sort, setSort] = useState<string>("type");
  const filterTypes = ["All", "Weapon", "Offhand", "Helmet", "Chest", "Gloves", "Boots", "Amulet", "Ring", "Potion", "Material", "Rune"];

  const filtered = state.player.inv.filter(i => filter === "All" || i.type === filter)
    .sort((a, b) => sort === "type" ? a.type.localeCompare(b.type) : sort === "rarity" ? Object.keys(RARITY_COLORS).indexOf(b.rarity) - Object.keys(RARITY_COLORS).indexOf(a.rarity) : a.name.localeCompare(b.name));
  const sel = selected ? state.player.inv.find(i => i.id === selected) : null;
  const isEquippable = sel && ["Weapon", "Offhand", "Helmet", "Chest", "Gloves", "Boots", "Amulet", "Ring"].includes(sel.type);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: item grid */}
      <div className="flex flex-col w-full md:w-[55%] border-r border-border">
        {/* Filters */}
        <div className="p-2 border-b border-border space-y-2">
          <div className="flex gap-2 items-center">
            <span className="text-amber-600 text-xs font-mono uppercase">Sort:</span>
            {["type","rarity","name"].map(s => (
              <button key={s} onClick={() => setSort(s)}
                className={`text-xs font-mono px-2 py-1 border ${sort===s?"border-amber-600 text-amber-300 bg-amber-900/30":"border-border text-amber-700"}`}
                style={{ borderRadius: "2px" }}>{s}</button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {filterTypes.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs font-mono px-2 py-0.5 border ${filter===f?"border-amber-600 text-amber-300 bg-amber-900/30":"border-border text-amber-700"}`}
                style={{ borderRadius: "2px" }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-auto p-2">
          <div className="text-amber-700/60 text-xs font-mono mb-2">{filtered.length} items</div>
          <div className="space-y-1">
            {filtered.map(item => (
              <button key={item.id} onClick={() => setSelected(selected === item.id ? null : item.id)}
                className={`w-full flex items-center gap-3 p-2 border text-left transition-all ${selected === item.id ? `${RARITY_BORDER[item.rarity]} ${RARITY_BG[item.rarity]}` : "border-border hover:border-amber-800/60 bg-card/30"}`}
                style={{ borderRadius: "2px" }}>
                <span className="text-xl w-8 text-center flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${RARITY_COLORS[item.rarity]}`} style={{ fontFamily: "'Cinzel', serif" }}>{item.name}</div>
                  <div className="flex gap-2 items-center mt-0.5">
                    <Badge rarity={item.rarity} />
                    <span className="text-amber-700/60 text-xs font-mono">{item.type}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {item.qty > 1 && <div className="text-amber-400 font-mono text-sm font-bold">x{item.qty}</div>}
                  <div className="text-amber-700/60 font-mono text-xs">{item.value}g</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-amber-700/40 text-xs font-mono text-center py-8">No items found</div>
            )}
          </div>
        </div>
      </div>

      {/* Right: item detail */}
      <div className="hidden md:flex flex-col w-[45%] p-3 overflow-auto">
        {sel ? (
          <div className="space-y-3">
            <div className={`p-4 border ${RARITY_BORDER[sel.rarity]} ${RARITY_BG[sel.rarity]}`} style={{ borderRadius: "3px" }}>
              <div className="text-center mb-3">
                <div className="text-5xl mb-2">{sel.icon}</div>
                <div className={`text-lg font-bold ${RARITY_COLORS[sel.rarity]}`} style={{ fontFamily: "'Cinzel', serif" }}>{sel.name}</div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Badge rarity={sel.rarity} />
                  <span className="text-amber-700/60 text-xs font-mono">{sel.type}</span>
                </div>
              </div>
              <p className="text-amber-200/70 text-sm text-center italic" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1rem" }}>{sel.desc}</p>
            </div>

            {sel.stats && Object.keys(sel.stats).length > 0 && (
              <Panel title="Item Stats">
                <div className="p-3 space-y-1">
                  {(Object.entries(sel.stats) as [string, number][]).map(([k, v]) => (
                    <StatRow key={k} label={k.toUpperCase()} value={v > 0 ? `+${v}` : v} color={v > 0 ? "text-green-400" : "text-red-400"} />
                  ))}
                </div>
              </Panel>
            )}

            {sel.classReq && (
              <div className="text-amber-600/80 text-xs font-mono">
                Requires: {sel.classReq.join(", ")}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {sel.type === "Potion" && (
                <Btn onClick={() => { onUse(sel.id); setSelected(null); }} variant="gold">🧪 Use</Btn>
              )}
              {isEquippable && (
                <Btn onClick={() => { onEquip(sel.id); setSelected(null); }} variant="primary">⚔️ Equip</Btn>
              )}
              <Btn onClick={() => { onSell(sel.id); setSelected(null); }} variant="ghost">💰 Sell ({Math.floor(sel.value * 0.5)}g)</Btn>
              <Btn onClick={() => { onDrop(sel.id); setSelected(null); }} variant="danger">🗑️ Drop</Btn>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-amber-700/40 text-sm font-mono flex-col gap-2">
            <span className="text-3xl">🎒</span>
            <span>Select an item to inspect</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// EQUIPMENT / CHARACTER SCREEN
// ─────────────────────────────────────────

function EquipmentScreen({ state, onUnequip, onAllocate }: {
  state: GState;
  onUnequip: (slot: Slot) => void;
  onAllocate: (stat: keyof StatBlock) => void;
}) {
  const p = state.player;
  const eff = getEffStats(p);
  const slots: Slot[] = ["Weapon","Offhand","Helmet","Chest","Gloves","Boots","Amulet","Ring1","Ring2"];
  const slotIcons: Record<Slot, string> = {
    Weapon:"⚔️", Offhand:"🛡️", Helmet:"⛑️", Chest:"🧥", Gloves:"🥊", Boots:"👢", Amulet:"📿", Ring1:"💍", Ring2:"💍",
  };

  return (
    <div className="flex-1 overflow-auto p-3">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Equipment slots */}
        <Panel title={`${CLASS_ICONS[p.cls]} ${p.name} — Lv.${p.lvl} ${p.cls}`}>
          <div className="p-3 space-y-1.5">
            {slots.map(slot => {
              const equippedId = p.equip[slot];
              const item = equippedId ? ITEMS[equippedId] : null;
              return (
                <div key={slot} className={`flex items-center gap-3 p-2 border ${item ? RARITY_BORDER[item.rarity] : "border-zinc-800"} ${item ? "bg-zinc-900/30" : "bg-zinc-950/40"}`} style={{ borderRadius: "2px" }}>
                  <span className="text-lg w-7 text-center">{slotIcons[slot]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-amber-600/50 text-xs font-mono uppercase">{slot}</div>
                    {item ? (
                      <div className={`text-sm font-semibold truncate ${RARITY_COLORS[item.rarity]}`}>{item.icon} {item.name}</div>
                    ) : (
                      <div className="text-zinc-700 text-sm italic">— Empty —</div>
                    )}
                  </div>
                  {item && (
                    <Btn onClick={() => onUnequip(slot)} variant="ghost" className="text-xs py-0.5 px-2">Remove</Btn>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Stats */}
        <div className="space-y-3">
          <Panel title="Character Stats">
            <div className="p-3 space-y-1">
              <StatRow label="Level"        value={p.lvl}         color="text-amber-400" />
              <StatRow label="Experience"   value={`${p.xp}/${p.xpNext}`} color="text-purple-400" />
              <StatRow label="HP"           value={`${p.hp}/${eff.maxHp}`} color="text-red-400" />
              <StatRow label="MP"           value={`${p.mp}/${eff.maxMp}`} color="text-blue-400" />
              <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
                {(["str","int","agi","def","lck"] as (keyof StatBlock)[]).map(stat => {
                  const eq = getEquipStats(p.equip);
                  const bonus = eq[stat as keyof IStats] ?? 0;
                  return (
                    <div key={stat} className="flex items-center justify-between">
                      <span className="text-amber-600/80 text-xs font-mono uppercase">{stat}</span>
                      <div className="flex items-center gap-2">
                        {bonus > 0 && <span className="text-green-500 text-xs font-mono">+{bonus}</span>}
                        <span className="text-amber-200 font-mono font-semibold text-sm">{p.base[stat] + bonus}</span>
                        {p.freePoints > 0 && (
                          <Btn onClick={() => onAllocate(stat)} variant="gold" className="text-xs py-0 px-1.5">+</Btn>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {p.freePoints > 0 && (
                <div className="mt-2 p-2 bg-amber-900/20 border border-amber-700/40 text-amber-300 text-xs font-mono text-center animate-pulse" style={{ borderRadius: "2px" }}>
                  ⬆️ {p.freePoints} stat points available!
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Combat Stats">
            <div className="p-3 space-y-1">
              <StatRow label="Phys. Dmg"  value={`~${Math.round(eff.str * 1.8)}`} />
              <StatRow label="Magic Dmg"  value={`~${Math.round(eff.int * 1.8)}`} />
              <StatRow label="Crit Chance" value={`${Math.min(50, Math.round(eff.lck * 1.5))}%`} />
              <StatRow label="Damage Red." value={`${Math.round(eff.def * 0.4)}%`} />
              <StatRow label="Speed"      value={eff.agi} />
            </div>
          </Panel>

          <Panel title="Progress">
            <div className="p-3 space-y-1">
              <StatRow label="Battles Won" value={p.wins} />
              <StatRow label="Items Crafted" value={p.crafts} />
              <StatRow label="Dungeons Floors" value={p.floorsCleared} />
              <StatRow label="Gold" value={`${p.gold.toLocaleString()}g`} color="text-amber-400" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// SKILLS SCREEN
// ─────────────────────────────────────────

function SkillsScreen({ state, onLearn, onUpgrade }: {
  state: GState;
  onLearn: (skillId: string) => void;
  onUpgrade: (skillId: string) => void;
}) {
  const p = state.player;
  const [sel, setSel] = useState<string | null>(null);
  const skillPoints = Math.max(0, p.lvl - p.skills.filter(s => s.learned).reduce((a, s) => a + s.slvl, 0));
  const selSkill = sel ? p.skills.find(s => s.id === sel) : null;

  function canLearn(skill: Skill): boolean {
    if (skill.learned) return false;
    if (skillPoints <= 0) return false;
    if (skill.reqId) {
      const req = p.skills.find(s => s.id === skill.reqId);
      if (!req?.learned) return false;
    }
    return true;
  }

  function canUpgrade(skill: Skill): boolean {
    if (!skill.learned) return false;
    if (skill.slvl >= skill.maxLvl) return false;
    if (skillPoints <= 0) return false;
    return true;
  }

  return (
    <div className="flex-1 overflow-auto p-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl text-amber-400" style={{ fontFamily: "'Cinzel', serif" }}>{CLASS_ICONS[p.cls]} {p.cls} Skills</h2>
          <div className="text-amber-300 font-mono text-sm bg-amber-900/30 border border-amber-700/50 px-3 py-1.5" style={{ borderRadius: "2px" }}>
            ✨ {skillPoints} Skill Point{skillPoints !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {p.skills.map(skill => {
            const isLearnable = canLearn(skill);
            const isUpgradable = canUpgrade(skill);
            const isSelected = sel === skill.id;

            return (
              <div key={skill.id}>
                <button onClick={() => setSel(isSelected ? null : skill.id)}
                  className={`w-full p-3 border text-left transition-all ${skill.learned ? isSelected ? "border-amber-500 bg-amber-900/20" : "border-amber-900/50 bg-card/50 hover:border-amber-800/60" : skill.reqId && !p.skills.find(s=>s.id===skill.reqId)?.learned ? "border-zinc-900 bg-zinc-950/60 opacity-40" : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"}`}
                  style={{ borderRadius: "3px" }}>
                  <div className="flex items-center gap-3">
                    <div className={`text-3xl ${!skill.learned && "grayscale opacity-50"}`}>{skill.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${skill.learned ? "text-amber-300" : "text-zinc-500"}`} style={{ fontFamily: "'Cinzel', serif" }}>
                          {skill.name}
                        </span>
                        {skill.learned && (
                          <span className="text-xs font-mono text-amber-600">Lv.{skill.slvl}/{skill.maxLvl}</span>
                        )}
                        {!skill.learned && skill.reqId && !p.skills.find(s=>s.id===skill.reqId)?.learned && (
                          <span className="text-xs font-mono text-zinc-600">🔒 Requires {skill.reqId}</span>
                        )}
                      </div>
                      <div className="text-xs text-amber-700/70 mt-0.5">{skill.desc}</div>
                      <div className="flex gap-3 mt-1 text-xs font-mono">
                        {skill.mpCost > 0 && <span className="text-blue-500">💧{skill.mpCost} MP</span>}
                        {skill.cd > 0 && <span className="text-amber-600">🕐 {skill.cd}t CD</span>}
                        {skill.dmgPct && <span className="text-red-400">⚔️{skill.dmgPct}%</span>}
                        {skill.healAmt && <span className="text-green-400">+{skill.healAmt} HP</span>}
                        {skill.fx && <span className="text-purple-400">{SFX_ICONS[skill.fx]}{skill.fx}</span>}
                      </div>
                    </div>
                    {skill.learned && (
                      <div className="flex-shrink-0">
                        <div className="flex gap-0.5">
                          {Array.from({ length: skill.maxLvl }).map((_, i) => (
                            <div key={i} className={`w-2 h-5 ${i < skill.slvl ? "bg-amber-500" : "bg-zinc-800"}`} style={{ borderRadius: "1px" }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </button>

                {isSelected && (
                  <div className="flex gap-2 mt-1 px-3 pb-2">
                    {!skill.learned && isLearnable && (
                      <Btn onClick={() => onLearn(skill.id)} variant="gold" className="flex-1 text-xs">
                        ✨ Learn (1 point)
                      </Btn>
                    )}
                    {skill.learned && isUpgradable && (
                      <Btn onClick={() => onUpgrade(skill.id)} variant="gold" className="flex-1 text-xs">
                        ⬆️ Upgrade Lv.{skill.slvl}→{skill.slvl+1} (1 point)
                      </Btn>
                    )}
                    {skill.learned && !isUpgradable && skill.slvl >= skill.maxLvl && (
                      <span className="text-amber-600/60 text-xs font-mono flex-1 text-center py-2">Max Level Reached</span>
                    )}
                    {!skill.learned && !isLearnable && !skill.reqId && (
                      <span className="text-amber-700/60 text-xs font-mono flex-1 text-center py-2">
                        {skillPoints <= 0 ? "No skill points available" : "Requirements not met"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// CRAFTING SCREEN
// ─────────────────────────────────────────

function CraftingScreen({ state, onCraft }: { state: GState; onCraft: (recipeId: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const p = state.player;

  function hasIngredients(recipe: Recipe): boolean {
    return recipe.ingredients.every(ing => {
      const found = p.inv.find(i => i.id === ing.id);
      return found && found.qty >= ing.qty;
    });
  }

  const available = RECIPES.filter(r => r.minLvl <= p.lvl);

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex flex-col w-full md:w-1/2 border-r border-border overflow-auto">
        <div className="p-3 border-b border-border">
          <h2 className="text-amber-400 text-sm tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>CRAFTING BENCH</h2>
          <p className="text-amber-700/60 text-xs font-mono mt-1">Level {p.lvl} — {available.length} recipes available</p>
        </div>
        <div className="p-2 space-y-1 overflow-auto">
          {RECIPES.map(recipe => {
            const locked = recipe.minLvl > p.lvl;
            const can = !locked && hasIngredients(recipe);
            const outItem = ITEMS[recipe.outId];
            if (!outItem) return null;

            return (
              <button key={recipe.id} onClick={() => setSel(sel === recipe.id ? null : recipe.id)}
                disabled={locked}
                className={`w-full flex items-center gap-3 p-2 border text-left transition-all disabled:opacity-40 ${sel === recipe.id ? "border-amber-500 bg-amber-900/20" : can ? "border-green-900/60 hover:border-green-700/60 bg-card/40" : locked ? "border-zinc-900" : "border-red-950/40 hover:border-red-900/40 bg-card/20"}`}
                style={{ borderRadius: "2px" }}>
                <span className="text-xl">{outItem.icon}</span>
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${RARITY_COLORS[outItem.rarity]}`} style={{ fontFamily: "'Cinzel', serif" }}>
                    {recipe.name}
                  </div>
                  <div className="text-xs font-mono text-amber-700/60 mt-0.5">
                    Lv.{recipe.minLvl} req · x{recipe.outQty} output
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {can ? <span className="text-green-400 text-xs font-mono">✓ Ready</span>
                       : locked ? <span className="text-zinc-600 text-xs font-mono">🔒 Lv.{recipe.minLvl}</span>
                       : <span className="text-red-500/70 text-xs font-mono">✗ Missing</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden md:flex flex-col w-1/2 p-3 overflow-auto">
        {sel ? (() => {
          const recipe = RECIPES.find(r => r.id === sel);
          const outItem = recipe && ITEMS[recipe.outId];
          if (!recipe || !outItem) return null;
          const can = hasIngredients(recipe);

          return (
            <div className="space-y-3">
              <div className={`p-4 border ${RARITY_BORDER[outItem.rarity]} ${RARITY_BG[outItem.rarity]} text-center`} style={{ borderRadius: "3px" }}>
                <div className="text-5xl mb-2">{outItem.icon}</div>
                <div className={`text-lg font-bold ${RARITY_COLORS[outItem.rarity]}`} style={{ fontFamily: "'Cinzel', serif" }}>{outItem.name}</div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Badge rarity={outItem.rarity} />
                  <span className="text-amber-600 font-mono text-xs">x{recipe.outQty}</span>
                </div>
                <p className="text-amber-200/60 text-sm mt-2 italic" style={{ fontFamily: "'Crimson Text', serif" }}>{outItem.desc}</p>
              </div>

              <Panel title="Required Ingredients">
                <div className="p-3 space-y-2">
                  {recipe.ingredients.map(ing => {
                    const ingItem = ITEMS[ing.id];
                    const owned = p.inv.find(i => i.id === ing.id);
                    const have = owned?.qty ?? 0;
                    const ok = have >= ing.qty;
                    return (
                      <div key={ing.id} className={`flex items-center gap-3 p-2 border ${ok ? "border-green-900/50 bg-green-950/30" : "border-red-900/50 bg-red-950/20"}`} style={{ borderRadius: "2px" }}>
                        <span className="text-lg">{ingItem?.icon ?? "❓"}</span>
                        <div className="flex-1">
                          <div className="text-amber-200 text-xs font-semibold">{ingItem?.name ?? ing.id}</div>
                        </div>
                        <span className={`font-mono text-sm font-bold ${ok ? "text-green-400" : "text-red-400"}`}>
                          {have}/{ing.qty}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {outItem.stats && Object.keys(outItem.stats).length > 0 && (
                <Panel title="Output Stats">
                  <div className="p-3 space-y-1">
                    {(Object.entries(outItem.stats) as [string, number][]).map(([k, v]) => (
                      <StatRow key={k} label={k.toUpperCase()} value={v > 0 ? `+${v}` : v} color="text-green-400" />
                    ))}
                  </div>
                </Panel>
              )}

              <Btn onClick={() => onCraft(recipe.id)} disabled={!can} variant="gold" className="w-full py-3 text-base">
                🔨 Craft {recipe.name}
              </Btn>
            </div>
          );
        })() : (
          <div className="flex-1 flex flex-col items-center justify-center text-amber-700/40 gap-2">
            <span className="text-4xl">🔨</span>
            <span className="font-mono text-sm">Select a recipe to craft</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// SHOP SCREEN
// ─────────────────────────────────────────

function ShopScreen({ state, onBuy, onSell, onRefresh }: {
  state: GState;
  onBuy: (itemId: string) => void;
  onSell: (itemId: string) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const p = state.player;
  const sellableItems = p.inv.filter(i => i.type !== "Material" || true);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-amber-400 text-sm tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>🏪 VENDOR — MERCHANT ALDUS</h2>
          <p className="text-amber-700/60 text-xs font-mono mt-0.5">"Fine wares for fine adventurers." — Your gold: {p.gold}g</p>
        </div>
        <Btn onClick={onRefresh} variant="ghost" className="text-xs">🔄 Refresh Stock</Btn>
      </div>

      <div className="flex border-b border-border">
        {(["buy","sell"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-mono uppercase tracking-wide border-b-2 transition-colors ${tab===t ? "border-amber-500 text-amber-300" : "border-transparent text-amber-700 hover:text-amber-500"}`}>
            {t === "buy" ? "🛒 Buy" : "💰 Sell"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-1.5">
        {tab === "buy" ? (
          state.shop.map(item => {
            const canAfford = p.gold >= item.value;
            return (
              <div key={item.id} className={`flex items-center gap-3 p-3 border ${canAfford ? "border-border hover:border-amber-800/60" : "border-zinc-900 opacity-60"} bg-card/30`} style={{ borderRadius: "2px" }}>
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${RARITY_COLORS[item.rarity]}`} style={{ fontFamily: "'Cinzel', serif" }}>{item.name}</div>
                  <div className="flex gap-2 items-center mt-0.5">
                    <Badge rarity={item.rarity} />
                    <span className="text-amber-700/60 text-xs font-mono">{item.type}</span>
                  </div>
                  {item.stats && (
                    <div className="text-xs text-green-500 font-mono mt-0.5">
                      {Object.entries(item.stats).map(([k, v]) => `+${v} ${k}`).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <span className={`font-mono font-bold text-sm ${canAfford ? "text-amber-400" : "text-red-500"}`}>{item.value}g</span>
                  <Btn onClick={() => onBuy(item.id)} disabled={!canAfford} variant="gold" className="text-xs py-0.5 px-2">Buy</Btn>
                </div>
              </div>
            );
          })
        ) : (
          sellableItems.map(item => {
            const sellPrice = Math.floor(item.value * 0.5);
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 border border-border bg-card/30 hover:border-amber-800/40" style={{ borderRadius: "2px" }}>
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${RARITY_COLORS[item.rarity]}`} style={{ fontFamily: "'Cinzel', serif" }}>{item.name}</div>
                  <div className="flex gap-2 items-center mt-0.5">
                    <Badge rarity={item.rarity} />
                    <span className="text-amber-700/60 text-xs font-mono">x{item.qty}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-amber-500 font-mono text-sm font-bold">{sellPrice}g</span>
                  <Btn onClick={() => onSell(item.id)} variant="ghost" className="text-xs py-0.5 px-2">Sell 1</Btn>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// QUESTS SCREEN
// ─────────────────────────────────────────

function QuestScreen({ state, onActivate }: { state: GState; onActivate: (qid: string) => void }) {
  const [filter, setFilter] = useState<"all" | "active" | "done" | "avail">("all");
  const [sel, setSel] = useState<string | null>(null);
  const p = state.player;

  const shown = state.quests.filter(q => {
    if (filter === "active") return q.status === "active";
    if (filter === "done") return q.status === "done";
    if (filter === "avail") return q.status === "avail" && q.minLvl <= p.lvl;
    return true;
  }).filter(q => q.status === "done" || q.minLvl <= p.lvl + 3);

  const selQ = sel ? state.quests.find(q => q.id === sel) : null;

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex flex-col w-full md:w-1/2 border-r border-border overflow-hidden">
        <div className="p-2 border-b border-border flex gap-1 flex-wrap">
          {(["all","active","avail","done"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-mono px-2 py-1 border ${filter===f ? "border-amber-600 text-amber-300 bg-amber-900/30" : "border-border text-amber-700"}`}
              style={{ borderRadius: "2px" }}>
              {f === "all" ? "All" : f === "active" ? "Active" : f === "avail" ? "Available" : "Completed"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {shown.map(q => {
            const isActive = q.status === "active";
            const isDone = q.status === "done";
            const pct = q.objs.length > 0 ? Math.round(q.objs.reduce((a,o) => a + Math.min(1, o.cur/o.req), 0) / q.objs.length * 100) : 0;
            return (
              <button key={q.id} onClick={() => setSel(sel===q.id?null:q.id)}
                className={`w-full text-left p-3 border transition-all ${isDone ? "border-green-900/50 bg-green-950/20 opacity-70" : isActive ? "border-amber-600/60 bg-amber-900/15" : "border-border bg-card/30 hover:border-amber-800/40"}`}
                style={{ borderRadius: "2px" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-300 text-sm font-semibold" style={{ fontFamily: "'Cinzel', serif" }}>{q.name}</span>
                  <span className={`text-xs font-mono ${isDone ? "text-green-400" : isActive ? "text-amber-400" : "text-amber-700"}`}>
                    {isDone ? "✓ Done" : isActive ? "⚡ Active" : `Lv.${q.minLvl}`}
                  </span>
                </div>
                <p className="text-amber-200/60 text-xs" style={{ fontFamily: "'Crimson Text', serif" }}>{q.desc}</p>
                {isActive && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs font-mono mb-0.5">
                      <span className="text-amber-600">Progress</span>
                      <span className="text-amber-400">{pct}%</span>
                    </div>
                    <HPBar cur={pct} max={100} color="bg-amber-700" />
                  </div>
                )}
              </button>
            );
          })}
          {shown.length === 0 && (
            <div className="text-amber-700/40 text-xs font-mono text-center py-8">No quests found</div>
          )}
        </div>
      </div>

      <div className="hidden md:flex flex-col w-1/2 p-3 overflow-auto">
        {selQ ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-amber-400 text-lg font-bold" style={{ fontFamily: "'Cinzel', serif" }}>{selQ.name}</h3>
              <div className="flex gap-2 mt-1">
                <span className={`text-xs font-mono ${selQ.status==="done" ? "text-green-400" : selQ.status==="active" ? "text-amber-400" : "text-amber-700"}`}>
                  {selQ.status === "done" ? "✓ Completed" : selQ.status === "active" ? "⚡ Active" : "Available"}
                </span>
                <span className="text-amber-700 text-xs font-mono">· Lv.{selQ.minLvl}+</span>
              </div>
            </div>
            <p className="text-amber-200/70 leading-relaxed" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.05rem" }}>{selQ.desc}</p>

            <Panel title="Objectives">
              <div className="p-3 space-y-2">
                {selQ.objs.map((obj, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className={`${obj.cur >= obj.req ? "text-green-400 line-through" : "text-amber-300"}`}>{obj.txt}</span>
                      <span className={`font-bold ${obj.cur >= obj.req ? "text-green-400" : "text-amber-400"}`}>{obj.cur}/{obj.req}</span>
                    </div>
                    <HPBar cur={obj.cur} max={obj.req} color={obj.cur >= obj.req ? "bg-green-600" : "bg-amber-700"} />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Rewards">
              <div className="p-3 space-y-1">
                <StatRow label="Experience" value={`${selQ.xp} XP`} color="text-purple-400" />
                <StatRow label="Gold" value={`${selQ.gold}g`} color="text-amber-400" />
                {selQ.iRewards.length > 0 && (
                  <div className="pt-1 border-t border-border/50">
                    <div className="text-amber-600/80 text-xs font-mono uppercase mb-1">Item Rewards</div>
                    {selQ.iRewards.map((id, i) => {
                      const item = ITEMS[id];
                      return item ? (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span>{item.icon}</span>
                          <span className={RARITY_COLORS[item.rarity]}>{item.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </Panel>

            {selQ.status === "avail" && selQ.minLvl <= p.lvl && (
              <Btn onClick={() => onActivate(selQ.id)} variant="gold" className="w-full py-2">
                📜 Accept Quest
              </Btn>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-amber-700/40 gap-2">
            <span className="text-4xl">📜</span>
            <span className="font-mono text-sm">Select a quest to view details</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// DUNGEON SCREEN
// ─────────────────────────────────────────

function DungeonScreen({ state, onEnterFloor, onLeaveDungeon }: {
  state: GState;
  onEnterFloor: (areaId: string, floor: number) => void;
  onLeaveDungeon: () => void;
}) {
  const p = state.player;
  const dungeonAreas = AREAS.filter(a => a.hasDungeon && a.found);
  const [selArea, setSelArea] = useState(dungeonAreas[0]?.id ?? "darkwood");

  const area = AREAS.find(a => a.id === selArea);
  if (!area) return null;

  const maxFloor = area.id === "throne" ? 3 : area.id === "void_sanc" ? 5 : area.id === "shadowpeak" ? 6 : area.id === "crypts" ? 5 : 4;

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center">
          <h2 className="text-2xl text-amber-400 tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>🏰 Dungeon Delve</h2>
          <p className="text-amber-700/60 text-sm mt-1 font-mono">Enter and descend into darkness for rare rewards</p>
        </div>

        {/* Area selector */}
        <div className="flex gap-2 flex-wrap">
          {dungeonAreas.map(a => (
            <button key={a.id} onClick={() => setSelArea(a.id)}
              className={`flex items-center gap-2 px-3 py-2 border text-sm ${selArea===a.id ? "border-amber-500 bg-amber-900/20 text-amber-300" : "border-border text-amber-700 hover:border-amber-800/40"}`}
              style={{ borderRadius: "2px" }}>
              <span>{a.icon}</span>
              <span style={{ fontFamily: "'Cinzel', serif" }}>{a.name}</span>
            </button>
          ))}
        </div>

        {/* Floor selection */}
        <Panel title={`${area.icon} ${area.name} Dungeon — Lv.${area.lvlRange[0]}–${area.lvlRange[1]}`}>
          <div className="p-4">
            <p className="text-amber-200/60 text-sm mb-4" style={{ fontFamily: "'Crimson Text', serif" }}>{area.desc}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Array.from({ length: maxFloor }).map((_, i) => {
                const floor = i + 1;
                const isCleared = state.player.floorsCleared >= (area.id === "darkwood" ? floor : floor + 4);
                const isBoss = floor === maxFloor;
                const tooLow = p.lvl < area.lvlRange[0] + (floor - 1);
                return (
                  <button key={floor}
                    disabled={tooLow}
                    onClick={() => onEnterFloor(area.id, floor)}
                    className={`p-3 border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isBoss ? "border-red-800/60 bg-red-950/30 hover:border-red-600/60" : "border-border bg-card/40 hover:border-amber-700/40"}`}
                    style={{ borderRadius: "3px" }}>
                    <div className="text-2xl mb-1">{isBoss ? "👹" : isCleared ? "✅" : "⚔️"}</div>
                    <div className={`text-xs font-semibold ${isBoss ? "text-red-400" : "text-amber-300"}`} style={{ fontFamily: "'Cinzel', serif" }}>
                      {isBoss ? "BOSS" : `Floor ${floor}`}
                    </div>
                    <div className="text-xs font-mono text-amber-700/60 mt-0.5">
                      Lv.{area.lvlRange[0] + floor - 1}+
                    </div>
                    {tooLow && <div className="text-red-500/60 text-xs font-mono">⚠️ Too low</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>

        {/* Dungeon tips */}
        <Panel title="Dungeon Rules">
          <div className="p-3 space-y-1 text-xs text-amber-200/60 font-mono">
            <div>• Dungeons contain stronger enemies than open world.</div>
            <div>• Boss floors have unique, powerful enemies.</div>
            <div>• Rare loot has higher drop rates in dungeons.</div>
            <div>• You keep all loot even if you flee.</div>
            <div>• Floor clears count toward the "Dungeon Crawler" achievement.</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// CO-OP SCREEN
// ─────────────────────────────────────────

function CoopScreen({ state, onToggleReady, onSendChat, onBotAction }: {
  state: GState;
  onToggleReady: () => void;
  onSendChat: (msg: string) => void;
  onBotAction: (action: string) => void;
}) {
  const [chatInput, setChatInput] = useState("");
  const [tab, setTab] = useState<"party" | "chat">("party");
  const chatRef = useRef<HTMLDivElement>(null);
  const p = state.player;
  const coop = state.coop;
  const allReady = coop.party.every(m => m.ready);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [coop.chat]);

  function sendChat() {
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput("");
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-amber-400 text-sm tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>👥 CO-OP PARTY</h2>
            <p className="text-amber-700/60 text-xs font-mono mt-0.5">Party Code: {coop.code || "DARK-4291"}</p>
          </div>
          <div className={`text-xs font-mono px-3 py-1.5 border ${allReady ? "border-green-700 text-green-400 bg-green-950/30" : "border-amber-700/50 text-amber-400 bg-amber-900/20"}`} style={{ borderRadius: "2px" }}>
            {allReady ? "🟢 All Ready!" : `${coop.party.filter(m=>m.ready).length}/${coop.party.length} Ready`}
          </div>
        </div>
      </div>

      <div className="flex border-b border-border">
        {(["party","chat"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wide border-b-2 transition-colors ${tab===t ? "border-amber-500 text-amber-300" : "border-transparent text-amber-700"}`}>
            {t === "party" ? `⚔️ Party (${coop.party.length})` : "💬 Chat"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === "party" ? (
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {/* Player */}
            <div className="p-3 border border-amber-600/50 bg-amber-900/15" style={{ borderRadius: "3px" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CLASS_ICONS[p.cls]}</span>
                  <div>
                    <div className="text-amber-300 font-semibold" style={{ fontFamily: "'Cinzel', serif" }}>{p.name} <span className="text-amber-600 text-xs">(You)</span></div>
                    <div className="text-amber-700/70 text-xs font-mono">Lv.{p.lvl} {p.cls}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-green-400">👑 Leader</span>
                  <Btn onClick={onToggleReady} variant={p.wins > 0 ? "gold" : "primary"} className="text-xs py-1 px-2">
                    {p.wins > 0 ? "✓ Ready" : "Not Ready"}
                  </Btn>
                </div>
              </div>
              <div className="mt-2">
                <HPBar cur={p.hp} max={p.maxHp} />
              </div>
            </div>

            {/* Bot members */}
            {coop.party.map(member => (
              <div key={member.id} className="p-3 border border-border bg-card/50" style={{ borderRadius: "3px" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CLASS_ICONS[member.cls]}</span>
                    <div>
                      <div className="text-amber-200 font-semibold flex items-center gap-2" style={{ fontFamily: "'Cinzel', serif" }}>
                        {member.name}
                        <span className="text-amber-700/60 text-xs font-mono">AI</span>
                      </div>
                      <div className="text-amber-700/70 text-xs font-mono">Lv.{member.lvl} {member.cls}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-mono ${member.ready ? "text-green-400" : "text-amber-600"}`}>
                    {member.ready ? "✓ Ready" : "Waiting..."}
                  </span>
                </div>
                <div className="mt-2">
                  <HPBar cur={member.hp} max={member.maxHp} />
                </div>
              </div>
            ))}

            {/* Party info */}
            <div className="mt-2 p-3 bg-zinc-950/60 border border-zinc-800" style={{ borderRadius: "2px" }}>
              <div className="text-amber-600/60 text-xs font-mono mb-2 uppercase tracking-wide">Party Composition</div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs bg-red-950/40 border border-red-900/50 px-2 py-1 text-red-400 font-mono">Damage: {coop.party.filter(m=>["Mage","Rogue","Necromancer"].includes(m.cls)).length + (["Mage","Rogue","Necromancer"].includes(p.cls) ? 1 : 0)}</span>
                <span className="text-xs bg-blue-950/40 border border-blue-900/50 px-2 py-1 text-blue-400 font-mono">Tank: {coop.party.filter(m=>["Warrior","Paladin"].includes(m.cls)).length + (["Warrior","Paladin"].includes(p.cls) ? 1 : 0)}</span>
                <span className="text-xs bg-green-950/40 border border-green-900/50 px-2 py-1 text-green-400 font-mono">Support: {coop.party.filter(m=>["Paladin","Ranger"].includes(m.cls)).length + (["Paladin","Ranger"].includes(p.cls) ? 1 : 0)}</span>
              </div>
            </div>

            <div className="mt-2 p-3 border border-amber-900/30 bg-amber-950/20" style={{ borderRadius: "2px" }}>
              <p className="text-amber-200/60 text-xs font-mono">💡 Co-op dungeons grant +50% XP. Party members must all be ready before entering. AI members automatically level up with you.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div ref={chatRef} className="flex-1 overflow-auto p-3 space-y-2">
              {coop.chat.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.who === p.name ? "flex-row-reverse" : ""}`}>
                  <div className={`max-w-[80%] px-3 py-2 text-xs ${msg.who === "System" ? "bg-zinc-900/60 border border-zinc-800 text-zinc-400 font-mono italic w-full text-center" : msg.who === p.name ? "bg-amber-900/30 border border-amber-800/50 text-amber-200 text-right" : "bg-zinc-900/50 border border-zinc-800 text-amber-200"}`} style={{ borderRadius: "3px" }}>
                    {msg.who !== "System" && msg.who !== p.name && (
                      <div className="text-amber-600 text-xs font-semibold mb-0.5">{msg.who}</div>
                    )}
                    {msg.msg}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-border flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Send a message..."
                className="flex-1 bg-card border border-border px-3 py-2 text-amber-100 text-xs placeholder-amber-800/60 focus:outline-none focus:border-amber-600"
                style={{ borderRadius: "2px" }} />
              <Btn onClick={sendChat} variant="primary" className="text-xs px-3">Send</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ACHIEVEMENTS SCREEN
// ─────────────────────────────────────────

function AchievementsScreen({ state }: { state: GState }) {
  const p = state.player;
  const unlocked = p.achieved;

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl text-amber-400 tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>🏆 Achievements</h2>
          <p className="text-amber-700/60 text-sm font-mono mt-1">{unlocked.length}/{ACHIEVEMENTS.length} unlocked</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <HPBar cur={unlocked.length} max={ACHIEVEMENTS.length} color="bg-amber-600" />
        </div>

        <div className="grid grid-cols-1 gap-2">
          {ACHIEVEMENTS.map(ach => {
            const isUnlocked = unlocked.includes(ach.id);
            return (
              <div key={ach.id}
                className={`flex items-center gap-4 p-4 border transition-all ${isUnlocked ? "border-amber-700/60 bg-amber-900/15" : "border-zinc-900 bg-zinc-950/40 opacity-60"}`}
                style={{ borderRadius: "3px" }}>
                <span className={`text-3xl ${!isUnlocked && "grayscale"}`}>{ach.icon}</span>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${isUnlocked ? "text-amber-300" : "text-zinc-500"}`} style={{ fontFamily: "'Cinzel', serif" }}>
                    {ach.name}
                  </div>
                  <div className={`text-xs ${isUnlocked ? "text-amber-200/70" : "text-zinc-600"}`} style={{ fontFamily: "'Crimson Text', serif" }}>
                    {ach.desc}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isUnlocked ? (
                    <span className="text-green-400 font-mono text-xs">✓ Unlocked</span>
                  ) : (
                    <span className="text-zinc-600 font-mono text-xs">🔒 Locked</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────

function NotifContainer({ notifs }: { notifs: GState["notifs"] }) {
  return (
    <div className="fixed top-16 right-3 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: "280px" }}>
      {notifs.slice(-4).map(n => (
        <div key={n.id} className={`px-3 py-2 border text-xs font-mono ${n.type === "ok" ? "bg-green-950/90 border-green-800 text-green-300" : n.type === "warn" ? "bg-amber-950/90 border-amber-700 text-amber-300" : n.type === "bad" ? "bg-red-950/90 border-red-800 text-red-300" : "bg-zinc-900/90 border-zinc-700 text-amber-200"}`}
          style={{ borderRadius: "2px" }}>
          {n.msg}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────

export default function App() {
  const [state, setState] = useState<GState>(makeInitialState);
  const enemyTurnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (enemyTurnTimer.current) clearTimeout(enemyTurnTimer.current); };
  }, []);

  // Auto-clear notifications
  useEffect(() => {
    if (state.notifs.length > 0) {
      const t = setTimeout(() => {
        setState(s => ({ ...s, notifs: s.notifs.slice(1) }));
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [state.notifs]);

  // Achievement checker — runs inside setState callback to always use fresh state
  useEffect(() => {
    setState(s => {
      const newAchs = ACHIEVEMENTS.filter(a => !s.player.achieved.includes(a.id) && a.check(s));
      if (newAchs.length === 0) return s;
      let ns2 = { ...s, player: { ...s.player, achieved: [...s.player.achieved, ...newAchs.map(a => a.id)] } };
      newAchs.forEach(a => { ns2 = addNotif(ns2, `🏆 Achievement: ${a.name}!`, "ok"); });
      return ns2;
    });
  }, [state.player.wins, state.player.kills, state.player.lvl, state.player.gold, state.player.crafts, state.player.flees, state.player.floorsCleared, state.player.inv.length]);

  function addNotif(s: GState, msg: string, type: GState["notifs"][0]["type"]): GState {
    return { ...s, notifs: [...s.notifs, { id: s._notifId + 1, msg, type }], _notifId: s._notifId + 1 };
  }

  function notify(msg: string, type: GState["notifs"][0]["type"] = "info") {
    setState(s => addNotif(s, msg, type));
  }

  function goScreen(screen: Screen) {
    setState(s => ({ ...s, screen }));
  }

  function handleCreate(cls: HeroClass, name: string) {
    setState(s => {
      const newState = applyClassToState(s, cls, name);
      return { ...newState, screen: "world" };
    });
  }

  function handleLoad() {
    const saved = localStorage.getItem("shadowrealm_save");
    if (saved) {
      try {
        const loaded = JSON.parse(saved) as GState;
        setState({ ...loaded, screen: "world", notifs: [] });
        notify("Game loaded!", "ok");
      } catch { notify("No save data found.", "warn"); }
    } else {
      setState(s => ({ ...s, screen: "create" }));
    }
  }

  function saveGame() {
    localStorage.setItem("shadowrealm_save", JSON.stringify(state));
    notify("Game saved!", "ok");
  }

  // ── EXPLORE / START COMBAT ──
  function handleExplore(areaId: string) {
    const area = AREAS.find(a => a.id === areaId);
    if (!area) return;
    const enemyPool = area.enemyIds;
    const enemyId = enemyPool[Math.floor(Math.random() * enemyPool.length)];
    const enemyTemplate = ENEMIES[enemyId];
    if (!enemyTemplate) return;

    // Scale enemy slightly with player level
    const lvlDiff = Math.max(0, state.player.lvl - area.lvlRange[0]);
    const scaleFactor = 1 + lvlDiff * 0.1;

    const activeEnemy: ActiveEnemy = {
      ...enemyTemplate,
      curHp: Math.round(enemyTemplate.maxHp * scaleFactor),
      maxHp: Math.round(enemyTemplate.maxHp * scaleFactor),
      atk: Math.round(enemyTemplate.atk * scaleFactor),
      sfx: {},
    };

    setState(s => ({
      ...s,
      screen: "combat",
      areaId,
      combat: {
        enemy: activeEnemy,
        log: [`⚔️ You encounter a ${activeEnemy.name}!`, `— ${activeEnemy.desc}`],
        playerTurn: activeEnemy.spd <= getEffStats(s.player).agi ? true : Math.random() > 0.5,
        over: false, result: null, loot: [], xpGain: 0, goldGain: 0,
      },
    }));
  }

  function handleDungeonEnter(areaId: string, floor: number) {
    const area = AREAS.find(a => a.id === areaId);
    if (!area) return;
    // Boss floor uses boss enemy
    const isBoss = floor >= (areaId === "throne" ? 3 : areaId === "void_sanc" ? 5 : areaId === "shadowpeak" ? 6 : areaId === "crypts" ? 5 : 4);
    const bossEnemies: Record<string, string> = {
      darkwood: "werewolf", crypts: "lich", shadowpeak: "dragon_wyrm",
      void_sanc: "bone_dragon", throne: "shadow_lord"
    };
    const normalEnemyIds = area.enemyIds;
    const enemyId = isBoss ? (bossEnemies[areaId] ?? normalEnemyIds[normalEnemyIds.length - 1]) : normalEnemyIds[Math.floor(Math.random() * (normalEnemyIds.length - 1))];

    setState(s => ({
      ...s,
      dungeon: { areaId, floor, maxFloor: 6 },
    }));
    handleExplore(areaId);
    notify(`Entering ${area.name} — Floor ${floor}`, "info");
  }

  // ── COMBAT ACTIONS ──
  function performCombatAction(action: "basic" | "skill" | "item", skillId?: string, itemId?: string) {
    setState(s => {
      if (!s.combat.playerTurn || s.combat.over || !s.combat.enemy) return s;

      let ns = { ...s };
      const p = ns.player;
      const enemy = ns.combat.enemy;
      const eff = getEffStats(p);
      const log = [...ns.combat.log];

      let newHp = p.hp;
      let newMp = p.mp;
      let newEnemyHp = enemy.curHp;
      let newEnemySfx = { ...enemy.sfx };
      let newPlayerSfx = { ...p.sfx };

      // Blessed reduces damage taken
      const isBlessedPlayer = (p.sfx["Blessed"] ?? 0) > 0;
      const isEnragedPlayer = (p.sfx["Enraged"] ?? 0) > 0;
      const isMarkedEnemy = (enemy.sfx["Marked"] ?? 0) > 0;

      if (action === "item" && itemId) {
        const item = ITEMS[itemId];
        if (!item?.effect) return s;
        const effect = item.effect;
        if (effect.startsWith("heal_")) {
          const healAmt = parseInt(effect.split("_")[1]);
          newHp = Math.min(eff.maxHp, newHp + healAmt);
          log.push(`💖 You drink ${item.name}. +${healAmt} HP.`);
        } else if (effect.startsWith("mana_")) {
          const manaAmt = parseInt(effect.split("_")[1]);
          newMp = Math.min(eff.maxMp, newMp + manaAmt);
          log.push(`💙 You drink ${item.name}. +${manaAmt} MP.`);
        } else if (effect === "full_restore") {
          newHp = eff.maxHp;
          newMp = eff.maxMp;
          log.push(`✨ You drink ${item.name}. Full HP and MP restored!`);
        } else if (effect.startsWith("buff_")) {
          const buffStat = effect.split("_")[1];
          log.push(`⚡ You drink ${item.name}. Temporarily buffed!`);
        }
        const newInv = removeFromInv(p.inv, itemId, 1);
        ns = { ...ns, player: { ...p, hp: newHp, mp: newMp, sfx: newPlayerSfx, inv: newInv } };
      } else {
        // Attack/skill
        let dmg = 0;
        let heal = 0;
        let fx: SFX | undefined;
        let fxChance = 0;
        let isMagic = ["Mage","Necromancer","Paladin"].includes(p.cls);

        if (action === "basic") {
          const primaryStat = isMagic ? eff.int : eff.str;
          dmg = calcDmg(primaryStat, 120, enemy.def * (isMagic ? 0.5 : 1));
          log.push(`⚔️ You attack ${enemy.name} for ${dmg} damage!`);
        } else if (action === "skill" && skillId) {
          const skill = p.skills.find(sk => sk.id === skillId);
          if (!skill || !skill.learned) return s;
          if (p.mp < skill.mpCost) { log.push("❌ Not enough MP!"); return s; }
          if (skill.curCd > 0) { log.push(`❌ ${skill.name} is on cooldown (${skill.curCd} turns)!`); return s; }

          newMp -= skill.mpCost;
          const primaryStat = isMagic ? eff.int : eff.str;

          if (skill.sType === "atk" || skill.sType === "heal") {
            if (skill.dmgPct) {
              const ignoreDef = skill.id === "arcane" || skill.id === "void_blast";
              let baseDmg = calcDmg(primaryStat, skill.dmgPct * (1 + (skill.slvl - 1) * 0.1), enemy.def, ignoreDef);
              if (isEnragedPlayer) baseDmg = Math.round(baseDmg * 1.6);
              if (isMarkedEnemy) baseDmg = Math.round(baseDmg * 1.3);
              // Assassinate: instant kill if enemy <30%
              if (skill.id === "assassin" && enemy.curHp / enemy.maxHp < 0.3) {
                baseDmg = enemy.curHp;
                log.push(`💀 ASSASSINATE! Instant kill!`);
              }
              // Multishot/fan: 3 hits
              if (skill.id === "multi_s" || skill.id === "fan_blade") {
                const totalDmg = baseDmg * 3;
                log.push(`${skill.icon} ${skill.name}: 3 hits for ${baseDmg} each = ${totalDmg} total!`);
                baseDmg = totalDmg;
              } else {
                log.push(`${skill.icon} ${skill.name}: ${baseDmg} damage to ${enemy.name}!`);
              }
              dmg = baseDmg;
            }
            if (skill.healAmt) {
              heal = skill.healAmt * (1 + (skill.slvl - 1) * 0.1);
              newHp = Math.min(eff.maxHp, newHp + heal);
              log.push(`💖 +${Math.round(heal)} HP restored!`);
            }
            if (skill.fx && skill.fxChance && Math.random() < skill.fxChance) {
              fx = skill.fx;
              fxChance = skill.fxChance;
            }
          } else if (skill.sType === "buff") {
            if (skill.fx) {
              newPlayerSfx = { ...newPlayerSfx, [skill.fx]: 3 };
              log.push(`${skill.icon} ${skill.name}: ${skill.fx} applied for 3 turns!`);
            }
            if (skill.id === "timestop") {
              newEnemySfx = { ...newEnemySfx, Stunned: 2 };
              log.push(`⏱️ Time stops! Enemy is Stunned for 2 turns!`);
            }
          } else if (skill.sType === "summon") {
            log.push(`${skill.icon} ${skill.name}: A fallen enemy rises to fight for you!`);
            // Bonus damage from summon
            dmg = calcDmg(primaryStat, 80, enemy.def);
            log.push(`💀 Your undead minion strikes for ${dmg} damage!`);
          }

          // Reduce cooldowns of other skills
          const updSkills = p.skills.map(sk => {
            if (sk.id === skillId) return { ...sk, curCd: sk.cd, mp: p.mp };
            return sk.curCd > 0 ? { ...sk, curCd: sk.curCd - 1 } : sk;
          });
          ns = { ...ns, player: { ...ns.player, skills: updSkills } };
        }

        // Apply status effects to enemy
        if (fx) {
          newEnemySfx = { ...newEnemySfx, [fx]: 3 };
          log.push(`${SFX_ICONS[fx]} ${enemy.name} is afflicted with ${fx}!`);
        }

        // Critical hit chance
        const critChance = Math.min(0.5, eff.lck * 0.015);
        if (dmg > 0 && Math.random() < critChance) {
          dmg = Math.round(dmg * 1.5);
          log.push(`💥 Critical Hit! ${dmg} damage!`);
        }

        newEnemyHp = Math.max(0, newEnemyHp - dmg);

        // Tick player status effects
        if ((newPlayerSfx["Poisoned"] ?? 0) > 0) {
          const poisonDmg = 8;
          newHp = Math.max(1, newHp - poisonDmg);
          newPlayerSfx["Poisoned"] = (newPlayerSfx["Poisoned"] ?? 0) - 1;
          log.push(`☠️ Poison deals ${poisonDmg} damage to you.`);
        }

        const updEnemy: ActiveEnemy = { ...enemy, curHp: newEnemyHp, sfx: newEnemySfx };

        // Check enemy death
        if (newEnemyHp <= 0) {
          // Apply kill
          const kills = { ...p.kills, [enemy.id]: (p.kills[enemy.id] ?? 0) + 1 };
          const loot = rollLoot(enemy);
          const goldGain = Math.floor(enemy.gold * (0.8 + Math.random() * 0.4));
          let xpGain = enemy.xp;
          let newGold = p.gold + goldGain;
          let newXp = p.xp + xpGain;
          let newLvl = p.lvl;
          let newXpNext = p.xpNext;
          let newMaxHp = p.maxHp;
          let newMaxMp = p.maxMp;
          let freePoints = p.freePoints;

          // Add loot to inventory
          let newInv = [...ns.player.inv];
          loot.forEach(l => { newInv = addToInv(newInv, l); });

          // Level up
          while (newXp >= newXpNext) {
            newXp -= newXpNext;
            newLvl++;
            newXpNext = xpForLevel(newLvl);
            newMaxHp = Math.round(newMaxHp * 1.1);
            newMaxMp = Math.round(newMaxMp * 1.1);
            freePoints += 3;
            log.push(`⭐ LEVEL UP! You are now Level ${newLvl}! +3 stat points!`);
          }

          // Unlock area discovery
          let foundAreas = [...AREAS];
          const areaIndex = AREAS.findIndex(a => a.id === s.areaId);
          if (areaIndex >= 0 && areaIndex + 1 < AREAS.length) {
            foundAreas[areaIndex + 1] = { ...AREAS[areaIndex + 1], found: true };
          }

          // Quest updates
          let newQuests = ns.quests.map(q => {
            if (q.status !== "active") return q;
            const updObjs = q.objs.map(o => {
              if (o.killId === enemy.id) return { ...o, cur: Math.min(o.req, o.cur + 1) };
              return o;
            });
            const allDone = updObjs.every(o => o.cur >= o.req);
            if (allDone) {
              log.push(`📜 Quest complete: "${q.name}"! +${q.xp} XP, +${q.gold}g`);
              newXp += q.xp;
              newGold += q.gold;
              q.iRewards.forEach(id => {
                const item = ITEMS[id];
                if (item) newInv = addToInv(newInv, { ...item, qty: 1 });
              });
              return { ...q, objs: updObjs, status: "done" as const };
            }
            return { ...q, objs: updObjs };
          });

          // Cooldowns tick
          const updSkills = ns.player.skills.map(sk => sk.curCd > 0 ? { ...sk, curCd: sk.curCd - 1 } : sk);

          // Floor clear tracking
          let floorsCleared = p.floorsCleared;
          if (s.screen === "dungeon" || s.dungeon.areaId) {
            floorsCleared++;
          }

          log.push(`✅ ${enemy.name} defeated! +${xpGain} XP, +${goldGain} gold.`);
          if (loot.length > 0) log.push(`🎁 Loot: ${loot.map(l => l.name).join(", ")}`);

          ns = {
            ...ns,
            player: {
              ...ns.player,
              hp: Math.min(newHp, newMaxHp),
              mp: Math.min(newMp, newMaxMp),
              maxHp: newMaxHp, maxMp: newMaxMp,
              xp: newXp, xpNext: newXpNext, lvl: newLvl,
              gold: newGold, kills,
              inv: newInv, skills: updSkills,
              sfx: newPlayerSfx, freePoints,
              wins: p.wins + 1, floorsCleared,
            },
            quests: newQuests,
            combat: {
              ...ns.combat, enemy: updEnemy, log,
              over: true, result: "win",
              loot, xpGain, goldGain,
              playerTurn: false,
            },
          };
          return ns;
        }

        ns = { ...ns, player: { ...ns.player, hp: newHp, mp: newMp, sfx: newPlayerSfx }, combat: { ...ns.combat, enemy: updEnemy, log, playerTurn: false } };
      }

      ns = { ...ns, player: { ...ns.player, hp: newHp, mp: newMp, sfx: newPlayerSfx } };
      if (action !== "item") {
        ns = { ...ns, combat: { ...ns.combat, log, playerTurn: false } };
      } else {
        ns = { ...ns, combat: { ...ns.combat, log, playerTurn: true } };
        return ns;
      }

      return ns;
    });
  }

  // ── ENEMY TURN ──
  useEffect(() => {
    if (!state.combat.playerTurn && !state.combat.over && state.combat.enemy) {
      enemyTurnTimer.current = setTimeout(() => {
        setState(s => {
          if (s.combat.playerTurn || s.combat.over || !s.combat.enemy) return s;
          const enemy = s.combat.enemy;
          const p = s.player;
          const eff = getEffStats(p);
          const log = [...s.combat.log];
          let newHp = p.hp;
          let newEnemySfx = { ...enemy.sfx };
          let newEnemyHp = enemy.curHp;

          // Check if enemy is stunned
          if ((newEnemySfx["Stunned"] ?? 0) > 0) {
            newEnemySfx["Stunned"] = (newEnemySfx["Stunned"] ?? 0) - 1;
            log.push(`💫 ${enemy.name} is stunned and cannot act!`);
          } else {
            // Tick enemy status effects
            if ((newEnemySfx["Burning"] ?? 0) > 0) {
              const burnDmg = 10;
              newEnemyHp = Math.max(0, newEnemyHp - burnDmg);
              newEnemySfx["Burning"] = (newEnemySfx["Burning"] ?? 0) - 1;
              log.push(`🔥 ${enemy.name} burns for ${burnDmg} damage.`);
            }
            if ((newEnemySfx["Poisoned"] ?? 0) > 0) {
              const poisonDmg = 8;
              newEnemyHp = Math.max(0, newEnemyHp - poisonDmg);
              newEnemySfx["Poisoned"] = (newEnemySfx["Poisoned"] ?? 0) - 1;
              log.push(`☠️ ${enemy.name} is poisoned for ${poisonDmg} damage.`);
            }
            if ((newEnemySfx["Bleeding"] ?? 0) > 0) {
              const bleedDmg = 6;
              newEnemyHp = Math.max(0, newEnemyHp - bleedDmg);
              newEnemySfx["Bleeding"] = (newEnemySfx["Bleeding"] ?? 0) - 1;
              log.push(`🩸 ${enemy.name} bleeds for ${bleedDmg} damage.`);
            }

            if (newEnemyHp <= 0) {
              // Enemy died from DoT
              const goldGain = Math.floor(enemy.gold * (0.8 + Math.random() * 0.4));
              const loot = rollLoot(enemy);
              let newInv = [...p.inv];
              loot.forEach(l => { newInv = addToInv(newInv, l); });
              log.push(`⚡ DoT kills ${enemy.name}! +${enemy.xp} XP, +${goldGain} gold.`);
              return {
                ...s,
                player: { ...p, gold: p.gold + goldGain, xp: p.xp + enemy.xp, inv: newInv, wins: p.wins + 1 },
                combat: { ...s.combat, enemy: { ...enemy, curHp: 0, sfx: newEnemySfx }, log, over: true, result: "win", loot, xpGain: enemy.xp, goldGain },
              };
            }

            // Enemy attacks
            const isBlessedPlayer = (p.sfx["Blessed"] ?? 0) > 0;
            let atkDmg = Math.max(1, enemy.atk - eff.def * 0.4);
            if (isBlessedPlayer) atkDmg = Math.round(atkDmg * 0.5);
            if (enemy.tier === "b" || enemy.tier === "l") {
              // Boss has special attack
              const specialRoll = Math.random();
              if (specialRoll < 0.3) {
                atkDmg = Math.round(atkDmg * 1.8);
                log.push(`💢 ${enemy.name} uses a SPECIAL ATTACK for ${Math.round(atkDmg)} damage!`);
              } else {
                log.push(`⚔️ ${enemy.name} attacks you for ${Math.round(atkDmg)} damage!`);
              }
            } else {
              log.push(`⚔️ ${enemy.name} attacks you for ${Math.round(atkDmg)} damage!`);
            }

            // Random status on player
            if (enemy.tier === "e" || enemy.tier === "b" || enemy.tier === "l") {
              if (Math.random() < 0.2) {
                const sfxOptions: SFX[] = ["Poisoned", "Bleeding", "Stunned"];
                const randomSfx = sfxOptions[Math.floor(Math.random() * sfxOptions.length)];
                log.push(`${SFX_ICONS[randomSfx]} You are afflicted with ${randomSfx}!`);
                const newPSfx = { ...p.sfx, [randomSfx]: 2 };
                s = { ...s, player: { ...s.player, sfx: newPSfx } };
              }
            }

            newHp = Math.max(0, p.hp - Math.round(atkDmg));
          }

          const updEnemy = { ...enemy, curHp: newEnemyHp, sfx: newEnemySfx };

          // Player dead
          if (newHp <= 0) {
            log.push(`💀 You have been defeated by ${enemy.name}...`);
            const reviveHp = Math.floor(eff.maxHp * 0.3);
            return {
              ...s,
              player: { ...p, hp: reviveHp, sfx: {} },
              combat: { ...s.combat, enemy: updEnemy, log, over: true, result: "lose", playerTurn: false },
            };
          }

          // Tick player status effects after enemy turn
          let newPSfx = { ...s.player.sfx };
          let hp2 = newHp;
          if ((newPSfx["Burning"] ?? 0) > 0) {
            hp2 = Math.max(1, hp2 - 8);
            newPSfx["Burning"] = (newPSfx["Burning"] ?? 0) - 1;
            log.push(`🔥 You burn for 8 damage.`);
          }
          // Reduce buff durations
          (Object.keys(newPSfx) as SFX[]).forEach(fx => {
            if ((newPSfx[fx] ?? 0) > 0) newPSfx[fx] = (newPSfx[fx] ?? 0) - 1;
          });

          // Tick skill cooldowns
          const updSkills = s.player.skills.map(sk => sk.curCd > 0 ? { ...sk, curCd: sk.curCd - 1 } : sk);

          return {
            ...s,
            player: { ...s.player, hp: hp2, sfx: newPSfx, skills: updSkills },
            combat: { ...s.combat, enemy: updEnemy, log, playerTurn: true },
          };
        });
      }, 800);
    }
  }, [state.combat.playerTurn, state.combat.over, state.combat.enemy]);

  function handleFlee() {
    setState(s => {
      const log = [...s.combat.log, "🏃 You flee from battle!"];
      return {
        ...s,
        player: { ...s.player, flees: s.player.flees + 1 },
        combat: { ...s.combat, log, over: true, result: "flee" },
      };
    });
  }

  function handleLootClose() {
    setState(s => ({
      ...s,
      screen: "world",
      combat: { enemy:null, log:[], playerTurn:true, over:false, result:null, loot:[], xpGain:0, goldGain:0 },
    }));
  }

  // ── INVENTORY ACTIONS ──
  function handleUseItem(id: string) {
    setState(s => {
      const item = s.player.inv.find(i => i.id === id);
      if (!item?.effect) return s;
      const p = s.player;
      const eff = getEffStats(p);
      let newHp = p.hp, newMp = p.mp;
      const effect = item.effect;
      if (effect.startsWith("heal_")) newHp = Math.min(eff.maxHp, newHp + parseInt(effect.split("_")[1]));
      else if (effect.startsWith("mana_")) newMp = Math.min(eff.maxMp, newMp + parseInt(effect.split("_")[1]));
      else if (effect === "full_restore") { newHp = eff.maxHp; newMp = eff.maxMp; }
      const newInv = removeFromInv(p.inv, id, 1);
      return addNotif({ ...s, player: { ...p, hp: newHp, mp: newMp, inv: newInv } }, `Used ${item.name}`, "ok");
    });
  }

  function handleEquipItem(id: string) {
    setState(s => {
      const item = ITEMS[id];
      if (!item) return s;
      const p = s.player;
      const slot = (item.type === "Ring" ? (p.equip["Ring1"] ? "Ring2" : "Ring1") : item.type) as Slot;
      const oldEquipped = p.equip[slot];
      let newInv = [...p.inv];
      if (oldEquipped) newInv = addToInv(newInv, { ...ITEMS[oldEquipped], qty: 1 });
      newInv = removeFromInv(newInv, id, 1);
      return addNotif({
        ...s,
        player: { ...p, equip: { ...p.equip, [slot]: id }, inv: newInv },
      }, `Equipped ${item.name}`, "ok");
    });
  }

  function handleUnequip(slot: Slot) {
    setState(s => {
      const id = s.player.equip[slot];
      if (!id) return s;
      const item = ITEMS[id];
      let newInv = addToInv(s.player.inv, { ...item, qty: 1 });
      const newEquip = { ...s.player.equip };
      delete newEquip[slot];
      return addNotif({
        ...s,
        player: { ...s.player, equip: newEquip, inv: newInv },
      }, `Unequipped ${item?.name ?? id}`, "info");
    });
  }

  function handleDropItem(id: string) {
    setState(s => {
      const item = s.player.inv.find(i => i.id === id);
      return addNotif({
        ...s,
        player: { ...s.player, inv: removeFromInv(s.player.inv, id, 1) },
      }, `Dropped ${item?.name ?? id}`, "warn");
    });
  }

  function handleSellItem(id: string) {
    setState(s => {
      const item = s.player.inv.find(i => i.id === id);
      if (!item) return s;
      const sellPrice = Math.floor(item.value * 0.5);
      return addNotif({
        ...s,
        player: { ...s.player, gold: s.player.gold + sellPrice, inv: removeFromInv(s.player.inv, id, 1) },
      }, `Sold ${item.name} for ${sellPrice}g`, "ok");
    });
  }

  function handleAllocate(stat: keyof StatBlock) {
    setState(s => {
      if (s.player.freePoints <= 0) return s;
      return {
        ...s,
        player: {
          ...s.player,
          base: { ...s.player.base, [stat]: s.player.base[stat] + 1 },
          freePoints: s.player.freePoints - 1,
        },
      };
    });
  }

  // ── SKILLS ACTIONS ──
  function handleLearnSkill(skillId: string) {
    setState(s => {
      const p = s.player;
      const skillPoints = Math.max(0, p.lvl - p.skills.filter(sk => sk.learned).reduce((a, sk) => a + sk.slvl, 0));
      if (skillPoints <= 0) return s;
      const skill = p.skills.find(sk => sk.id === skillId);
      if (!skill || skill.learned) return s;
      const newSkills = p.skills.map(sk => sk.id === skillId ? { ...sk, learned: true, slvl: 1 } : sk);
      return addNotif({ ...s, player: { ...p, skills: newSkills } }, `Learned ${skill.name}!`, "ok");
    });
  }

  function handleUpgradeSkill(skillId: string) {
    setState(s => {
      const p = s.player;
      const skillPoints = Math.max(0, p.lvl - p.skills.filter(sk => sk.learned).reduce((a, sk) => a + sk.slvl, 0));
      if (skillPoints <= 0) return s;
      const skill = p.skills.find(sk => sk.id === skillId);
      if (!skill || !skill.learned || skill.slvl >= skill.maxLvl) return s;
      const newSkills = p.skills.map(sk => sk.id === skillId ? { ...sk, slvl: sk.slvl + 1 } : sk);
      return addNotif({ ...s, player: { ...p, skills: newSkills } }, `${skill.name} upgraded to Lv.${skill.slvl + 1}!`, "ok");
    });
  }

  // ── CRAFTING ──
  function handleCraft(recipeId: string) {
    setState(s => {
      const recipe = RECIPES.find(r => r.id === recipeId);
      if (!recipe) return s;
      const p = s.player;
      let newInv = [...p.inv];
      for (const ing of recipe.ingredients) {
        const owned = newInv.find(i => i.id === ing.id);
        if (!owned || owned.qty < ing.qty) return addNotif(s, "Missing ingredients!", "bad");
        newInv = removeFromInv(newInv, ing.id, ing.qty);
      }
      const outItem = ITEMS[recipe.outId];
      if (!outItem) return s;
      newInv = addToInv(newInv, { ...outItem, qty: recipe.outQty });
      return addNotif({
        ...s,
        player: { ...p, inv: newInv, crafts: p.crafts + 1 },
      }, `Crafted ${recipe.name} x${recipe.outQty}!`, "ok");
    });
  }

  // ── SHOP ──
  function handleBuy(itemId: string) {
    setState(s => {
      const shopItem = s.shop.find(i => i.id === itemId);
      if (!shopItem || s.player.gold < shopItem.value) {
        return addNotif(s, "Not enough gold!", "bad");
      }
      const newInv = addToInv(s.player.inv, { ...shopItem, qty: 1 });
      return addNotif({
        ...s,
        player: { ...s.player, gold: s.player.gold - shopItem.value, inv: newInv },
        shop: s.shop.map(i => i.id === itemId ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0),
      }, `Bought ${shopItem.name}!`, "ok");
    });
  }

  function handleShopSell(itemId: string) {
    setState(s => {
      const item = s.player.inv.find(i => i.id === itemId);
      if (!item) return s;
      const sellPrice = Math.floor(item.value * 0.5);
      return addNotif({
        ...s,
        player: { ...s.player, gold: s.player.gold + sellPrice, inv: removeFromInv(s.player.inv, itemId, 1) },
      }, `Sold ${item.name} for ${sellPrice}g`, "ok");
    });
  }

  function handleRefreshShop() {
    setState(s => addNotif({ ...s, shop: generateShopStock() }, "Shop restocked!", "info"));
  }

  // ── QUESTS ──
  function handleActivateQuest(qid: string) {
    setState(s => {
      const quest = s.quests.find(q => q.id === qid);
      if (!quest || quest.status !== "avail") return s;
      return addNotif({
        ...s,
        quests: s.quests.map(q => q.id === qid ? { ...q, status: "active" as const } : q),
        player: { ...s.player, activeQ: [...s.player.activeQ, qid] },
      }, `Quest accepted: ${quest.name}`, "info");
    });
  }

  // ── COOP ──
  function handleSendChat(msg: string) {
    setState(s => {
      const botResponses = [
        "With me by your side, darkness shall not prevail!",
        "Let us venture deeper into the shadow.",
        "I sense great evil ahead. Be cautious.",
        "My blade is ready.",
        "For glory and gold!",
        "The shadows grow thicker here...",
        "I spotted something glinting in the dark.",
      ];
      const botName = s.coop.party[Math.floor(Math.random() * s.coop.party.length)]?.name ?? "Unknown";
      const newChat = [
        ...s.coop.chat,
        { who: s.player.name, msg, time: Date.now() },
        Math.random() < 0.6 ? { who: botName, msg: botResponses[Math.floor(Math.random() * botResponses.length)], time: Date.now() + 500 } : null,
      ].filter(Boolean) as typeof s.coop.chat;
      return { ...s, coop: { ...s.coop, chat: newChat } };
    });
  }

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────

  const { screen, player } = state;
  const isGameActive = screen !== "title" && screen !== "create";

  return (
    <div className="size-full flex flex-col bg-background text-foreground overflow-hidden"
      style={{ fontFamily: "'Crimson Text', serif" }}>

      {/* Notifications */}
      {state.notifs.length > 0 && <NotifContainer notifs={state.notifs} />}

      {/* Title screen */}
      {screen === "title" && (
        <TitleScreen onStart={() => setState(s => ({ ...s, screen: "create" }))} onLoad={handleLoad} />
      )}

      {/* Character creation */}
      {screen === "create" && <CharacterCreation onCreate={handleCreate} />}

      {/* Main game */}
      {isGameActive && (
        <>
          {/* HUD + Save button */}
          <div className="flex items-center gap-0">
            <div className="flex-1">
              <HUD state={state} onScreen={goScreen} />
            </div>
            <button onClick={saveGame} className="h-full px-2 border-l border-b border-border bg-card text-amber-700/60 hover:text-amber-400 text-xs font-mono" title="Save game" style={{ minWidth: "36px" }}>
              💾
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {screen === "world"       && <WorldScreen state={state} onExplore={handleExplore} onEnterShop={() => goScreen("shop")} />}
            {screen === "combat"      && <CombatScreen state={state} onAction={performCombatAction} onFlee={handleFlee} onLootClose={handleLootClose} />}
            {screen === "inventory"   && <InventoryScreen state={state} onUse={handleUseItem} onEquip={handleEquipItem} onDrop={handleDropItem} onSell={handleSellItem} />}
            {screen === "equipment"   && <EquipmentScreen state={state} onUnequip={handleUnequip} onAllocate={handleAllocate} />}
            {screen === "skills"      && <SkillsScreen state={state} onLearn={handleLearnSkill} onUpgrade={handleUpgradeSkill} />}
            {screen === "crafting"    && <CraftingScreen state={state} onCraft={handleCraft} />}
            {screen === "shop"        && <ShopScreen state={state} onBuy={handleBuy} onSell={handleShopSell} onRefresh={handleRefreshShop} />}
            {screen === "quests"      && <QuestScreen state={state} onActivate={handleActivateQuest} />}
            {screen === "dungeon"     && <DungeonScreen state={state} onEnterFloor={handleDungeonEnter} onLeaveDungeon={() => goScreen("world")} />}
            {screen === "coop"        && <CoopScreen state={state} onToggleReady={() => {}} onSendChat={handleSendChat} onBotAction={() => {}} />}
            {screen === "achievements" && <AchievementsScreen state={state} />}
          </div>

          {/* Bottom nav */}
          <BottomNav screen={screen} onScreen={goScreen} />
        </>
      )}
    </div>
  );
}

// Fix missing component name reference
function CharacterCreation({ onCreate }: { onCreate: (cls: HeroClass, name: string) => void }) {
  return <CharCreateScreen onCreate={onCreate} />;
}
