import { TRAIT_IDS, AUGMENT_IDS, AUGMENT_LEVELS } from '../domain/character';
import { ARTS, ART_IDS, ITEM_DEFS } from '../domain/content';
import { bossById, REGIONS } from '../domain/campaign';
import { ENCOUNTER_KINDS, type GameState } from '../domain/model';
import { itemDefinition, REFINE_COST } from '../domain/items';
import { PROJECTILE_VISUALS } from '../domain/projectile-visual';
import { ENEMY_ROLES } from '../domain/region-enemies';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown) => finite(value) && value >= 0;
const integer = (value: unknown) => nonnegative(value) && Number.isSafeInteger(value);
const optional = (value: unknown, check: (value: unknown) => boolean) =>
  value === undefined || check(value);
const appearance = (value: unknown) => integer(value) && Number(value) < 10;
const numbers = (value: RecordValue, keys: string[]) => keys.every((key) => finite(value[key]));
const list = (value: unknown, check: (value: unknown) => boolean): value is unknown[] =>
  Array.isArray(value) && value.every(check);
const member = (value: unknown, options: readonly string[]) =>
  text(value) && options.includes(value);
const artId = (value: unknown): value is keyof typeof ARTS => member(value, ART_IDS);
const uniqueIds = (values: unknown[]) =>
  new Set(values.map((value) => (value as RecordValue).id)).size === values.length;

function item(value: unknown) {
  return (
    record(value) &&
    text(value.id) &&
    text(value.name) &&
    optional(value.statRevision, (revision) => revision === 1) &&
    member(value.kind, Object.keys(ITEM_DEFS)) &&
    optional(
      value.templateId,
      (id) =>
        text(id) && (!!itemDefinition(id) || (id.startsWith('boss-') && !!bossById(id.slice(5)))),
    ) &&
    optional(value.rarity, (rarity) => member(rarity, ['common', 'refined', 'rare', 'heroic'])) &&
    optional(value.upgrades, (count) => integer(count) && (count as number) <= REFINE_COST.limit) &&
    optional(value.weaponStyle, (style) =>
      member(style, ['sword', 'dao', 'dart', 'gauntlet', 'staff', 'fan']),
    ) &&
    optional(value.originBoss, (id) => text(id) && !!bossById(id)) &&
    member(value.place, ['weapon', 'general', 'board', 'ground', 'warehouse', 'equipped']) &&
    integer(value.w) &&
    value.w !== 0 &&
    integer(value.h) &&
    value.h !== 0 &&
    integer(value.x) &&
    integer(value.y) &&
    typeof value.rotated === 'boolean' &&
    integer(value.count) &&
    value.count !== 0 &&
    nonnegative(value.quality) &&
    nonnegative(value.power)
  );
}
function learnedArt(value: unknown) {
  return (
    record(value) &&
    artId(value.id) &&
    integer(value.level) &&
    value.level !== 0 &&
    (value.level as number) <= ARTS[value.id].max &&
    nonnegative(value.gauge) &&
    (value.gauge as number) <= (value.id === 'gaebang' ? 200 : 100) &&
    integer(value.combo) &&
    nonnegative(value.defenseCd) &&
    optional(value.queuedBoosts, (boosts) => integer(boosts) && (boosts as number) <= 2) &&
    optional(value.chainTime, nonnegative) &&
    optional(value.chain, integer) &&
    optional(value.lastHit, (variant) => member(variant, ['a', 'b', 'c'])) &&
    ['bonus', 'buffTime', 'rally', 'rallyTime', 'ultimateHealing'].every((key) =>
      optional(value[key], nonnegative),
    )
  );
}
function growth(value: unknown) {
  return (
    record(value) &&
    ['constitution', 'strength', 'agility', 'inner'].every(
      (key) => finite(value[key]) && Number(value[key]) >= 0.8 && Number(value[key]) <= 2.0,
    )
  );
}
function recruitment(value: unknown) {
  return (
    record(value) &&
    integer(value.tickets) &&
    Number(value.tickets) <= 3 &&
    nonnegative(value.anchor) &&
    nonnegative(value.observedAt) &&
    Number(value.anchor) <= Number(value.observedAt) &&
    integer(value.sequence) &&
    list(
      value.candidates,
      (c) =>
        record(c) &&
        text(c.id) &&
        integer(c.seed) &&
        growth(c.growth) &&
        optional(c.appearance, appearance) &&
        optional(c.portrait, (id) => integer(id) && Number(id) <= 2) &&
        optional(c.innate, (id) => member(id, TRAIT_IDS)),
    ) &&
    (value.candidates.length === 0 || value.candidates.length === 3) &&
    uniqueIds(value.candidates)
  );
}
function fighter(value: unknown) {
  return (
    record(value) &&
    text(value.id) &&
    text(value.name) &&
    optional(value.portrait, (id) => integer(id) && Number(id) <= 2) &&
    optional(value.appearance, appearance) &&
    optional(value.growth, growth) &&
    optional(
      value.growthStartLevel,
      (start) => integer(start) && Number(start) <= Number(value.level),
    ) &&
    optional(value.progressionVersion, (version) => version === 2) &&
    optional(value.innate, (id) => member(id, TRAIT_IDS)) &&
    optional(value.trainingPoints, integer) &&
    optional(value.deferredTrainingPoints, integer) &&
    optional(
      value.augments,
      (values) =>
        list(values, (id) => member(id, AUGMENT_IDS)) &&
        values.length <= 3 &&
        new Set(values).size === values.length,
    ) &&
    optional(
      value.augmentOffers,
      (values) =>
        list(values, (id) => member(id, AUGMENT_IDS)) &&
        (values.length === 0 || values.length === 3) &&
        new Set(values).size === values.length,
    ) &&
    (value.progressionVersion !== 2 ||
      (growth(value.growth) &&
        integer(value.trainingPoints) &&
        Array.isArray(value.augments) &&
        value.augments.length <=
          AUGMENT_LEVELS.filter((level) => Number(value.level) >= level).length)) &&
    (!Array.isArray(value.augmentOffers) ||
      value.augmentOffers.length === 0 ||
      (Array.isArray(value.augments) &&
        value.augments.length <
          AUGMENT_LEVELS.filter((level) => Number(value.level) >= level).length &&
        value.augmentOffers.every((id) => !(value.augments as unknown[]).includes(id)))) &&
    optional(
      value.traitState,
      (state) =>
        record(state) &&
        optional(state.survived, (flag) => typeof flag === 'boolean') &&
        [
          'untouched',
          'switchCd',
          'attackBoost',
          'staggerBoost',
          'momentum',
          'target',
          'hits',
          'sequence',
        ].every((key) => optional(state[key], nonnegative)),
    ) &&
    integer(value.level) &&
    nonnegative(value.xp) &&
    nonnegative(value.hp) &&
    integer(value.active) &&
    list(value.arts, learnedArt) &&
    value.arts.length <= 4 &&
    uniqueIds(value.arts) &&
    ((value.active as number) < value.arts.length ||
      (value.active === 0 && value.arts.length === 0)) &&
    list(value.items, item) &&
    uniqueIds(value.items) &&
    text(value.action) &&
    numbers(value, [
      'x',
      'y',
      'facing',
      'actionTime',
      'cooldown',
      'invulnerable',
      'guard',
      'shield',
    ]) &&
    integer(value.attackSeq) &&
    optional(value.fortify, nonnegative) &&
    optional(value.slowTime, nonnegative) &&
    optional(value.healSuppression, nonnegative) &&
    optional(value.poisonTime, nonnegative) &&
    optional(value.burnTime, nonnegative) &&
    optional(value.fieldTick, nonnegative) &&
    ['bleedTime', 'coldStacks', 'coldTime', 'freezeTime', 'capturedTime'].every((key) =>
      optional(value[key], nonnegative),
    ) &&
    optional(value.spent, integer) &&
    optional(value.bornAt, finite) &&
    optional(value.expiresAt, finite) &&
    optional(
      value.bindings,
      (bindings) =>
        record(bindings) &&
        Object.entries(bindings).every(([id, weapon]) => artId(id) && text(weapon)),
    )
  );
}
function offer(value: unknown) {
  return record(value) && artId(value.art) && member(value.type, ['learn', 'upgrade']);
}
function validOffers(values: RecordValue[], subject: RecordValue, spent: number) {
  if (!values.length) return true;
  if (subject.progressionVersion !== 2 && spent >= (subject.level as number)) return false;
  const learned = subject.arts as RecordValue[];
  const offeredIds = values.map((value) => value.art);
  if (new Set(offeredIds).size !== offeredIds.length) return false;
  return values.every((value) => {
    const known = learned.find((art) => art.id === value.art);
    if (
      subject.progressionVersion === 2 &&
      Number(subject.trainingPoints) < (value.type === 'learn' ? 1 : Number(known?.level ?? 1))
    )
      return false;
    return value.type === 'learn'
      ? !known && learned.length < 4
      : !!known && (known.level as number) < ARTS[value.art as keyof typeof ARTS].max;
  });
}
function enemy(value: unknown) {
  return (
    record(value) &&
    integer(value.id) &&
    member(value.kind, ['sword', 'spear', 'archer', 'chief', 'captain']) &&
    optional(value.steerX, finite) &&
    optional(value.steerY, finite) &&
    optional(value.moving, (flag) => typeof flag === 'boolean') &&
    optional(value.role, (role) => member(role, ENEMY_ROLES)) &&
    member(value.state, ['approach', 'windup', 'strike', 'recover']) &&
    optional(value.bossId, (id) => text(id) && !!bossById(id)) &&
    optional(value.move, (move) =>
      member(move, [
        'slash',
        'thrust',
        'dash',
        'fan',
        'ring',
        'pulse',
        'hazard',
        'summon',
        'sweep',
        'slam',
        'combo',
        'stance',
        'grab',
        'bell',
      ]),
    ) &&
    optional(value.targetX, finite) &&
    optional(value.targetY, finite) &&
    optional(
      value.pressure,
      (p) =>
        record(p) &&
        ['farTime', 'warning', 'burst', 'cooldown', 'lastDistance'].every((key) =>
          nonnegative(p[key]),
        ) &&
        Number(p.farTime) <= 0.85 &&
        Number(p.warning) <= 0.32 &&
        Number(p.burst) <= 1.8 &&
        Number(p.cooldown) <= 5 &&
        Number(p.lastDistance) <= 2500 &&
        optional(p.advance, (n) => nonnegative(n) && Number(n) <= 95),
    ) &&
    optional(
      value.strike,
      (strike) =>
        record(strike) &&
        numbers(strike, ['fromX', 'fromY', 'toX', 'toY']) &&
        finite(strike.duration) &&
        (strike.duration as number) > 0 &&
        (strike.duration as number) <= 1.5 &&
        nonnegative(strike.damage) &&
        typeof strike.hit === 'boolean' &&
        optional(strike.target, integer) &&
        optional(
          strike.contactsDone,
          (n) => integer(n) && (n as number) >= 0 && (n as number) <= 3,
        ),
    ) &&
    optional(value.summoned, (flag) => typeof flag === 'boolean') &&
    optional(value.windDeflection, finite) &&
    [
      'skillClock',
      'guardTime',
      'rageTime',
      'veilTime',
      'staggerTime',
      'armourTime',
      'reactionTime',
      'observedAttack',
    ].every((key) => optional(value[key], nonnegative)) &&
    optional(value.poisonStacks, (stacks) => integer(stacks) && (stacks as number) <= 5) &&
    optional(value.poisonTime, nonnegative) &&
    optional(value.poisonTick, finite) &&
    [
      'poisonDamage',
      'poisonLevel',
      'poisonSeq',
      'poisonVolley',
      'blossom',
      'blossomTime',
      'confused',
    ].every((key) => optional(value[key], nonnegative)) &&
    typeof value.elite === 'boolean' &&
    numbers(value, ['x', 'y', 'hp', 'maxHp', 'facing', 'timer', 'aim', 'pattern', 'xp', 'hitSeq'])
  );
}
function projectile(value: unknown) {
  return (
    record(value) &&
    typeof value.friendly === 'boolean' &&
    optional(value.delay, nonnegative) &&
    optional(
      value.landing,
      (landing) =>
        record(landing) &&
        !value.friendly &&
        numbers(landing, ['x', 'y', 'radius']) &&
        member(landing.kind, ['poison', 'cold', 'trap', 'gate', 'blood', 'brew', 'fire']),
    ) &&
    optional(value.visual, (visual) => member(visual, PROJECTILE_VISUALS)) &&
    optional(value.art, artId) &&
    optional(value.seq, integer) &&
    optional(value.variant, (variant) => member(variant, ['a', 'b', 'c'])) &&
    optional(value.level, integer) &&
    optional(value.owner, integer) &&
    optional(value.hostileToEnemies, (flag) => typeof flag === 'boolean') &&
    optional(value.returnAt, nonnegative) &&
    optional(value.returned, (flag) => typeof flag === 'boolean') &&
    optional(value.status, (status) => member(status, ['poison', 'cold', 'bleed'])) &&
    ['bounces', 'bounceObject', 'bounceCooldown', 'visualScale'].every((key) =>
      optional(value[key], nonnegative),
    ) &&
    list(value.hits, finite) &&
    numbers(value, ['x', 'y', 'vx', 'vy', 'life', 'damage', 'radius'])
  );
}
function effect(value: unknown) {
  return (
    record(value) &&
    member(value.kind, ['slash', 'thrust', 'burst', 'hit', 'guard', 'arrow', 'chain']) &&
    optional(value.weapon, (style) =>
      member(style, ['sword', 'dao', 'dart', 'gauntlet', 'staff', 'fan']),
    ) &&
    numbers(value, ['x', 'y', 'angle', 'life', 'duration', 'radius', 'color'])
  );
}
function attack(value: unknown) {
  return (
    record(value) &&
    typeof value.thrust === 'boolean' &&
    typeof value.heal === 'boolean' &&
    optional(value.art, artId) &&
    optional(value.variant, (variant) => member(variant, ['a', 'b', 'c'])) &&
    optional(value.boosted, (flag) => typeof flag === 'boolean') &&
    optional(value.seq, integer) &&
    numbers(value, ['timer', 'angle', 'damage', 'range', 'arc'])
  );
}
function run(value: unknown) {
  return (
    record(value) &&
    text(value.id) &&
    integer(value.seed) &&
    integer(value.wave) &&
    (value.wave as number) >= 1 &&
    (value.wave as number) <= 20 &&
    optional(
      value.regionRoute,
      (route) =>
        list(route, (name) => text(name) && REGIONS.some((region) => region.name === name)) &&
        route.length === 4 &&
        new Set(route).size === 4,
    ) &&
    member(value.phase, ['combat', 'loot', 'prep', 'dead', 'victory']) &&
    fighter(value.fighter) &&
    list(value.enemies, enemy) &&
    list(value.projectiles, projectile) &&
    list(value.effects, effect) &&
    list(value.attacks, attack) &&
    optional(
      value.formations,
      (nodes) =>
        list(
          nodes,
          (node) =>
            record(node) &&
            numbers(node, ['x', 'y', 'life', 'pulse', 'damage']) &&
            optional(node.kind, (kind) => member(kind, ['heaven', 'earth', 'ultimate'])) &&
            optional(node.pulses, nonnegative),
        ) &&
        Array.isArray(nodes) &&
        nodes.length <= 4,
    ) &&
    optional(value.zoneClock, nonnegative) &&
    optional(value.zoneSeq, integer) &&
    optional(value.encounterSeq, integer) &&
    optional(value.exchangeSeq, integer) &&
    optional(
      value.petalStrikes,
      (strikes) =>
        list(
          strikes,
          (strike) =>
            record(strike) &&
            integer(strike.target) &&
            finite(strike.timer) &&
            nonnegative(strike.damage),
        ) &&
        Array.isArray(strikes) &&
        strikes.length <= 3,
    ) &&
    optional(
      value.encounterObjects,
      (objects) =>
        list(
          objects,
          (object) =>
            record(object) &&
            integer(object.id) &&
            integer(object.owner) &&
            member(object.kind, ENCOUNTER_KINDS) &&
            optional(object.mechanic, (kind) =>
              member(kind, [
                'bamboo',
                'falling-bamboo',
                'door',
                'rotating-door',
                'stone-door',
                'sandwall',
                'drone',
                'blade',
                'oasis',
                'plate',
                'exchange',
                'grab',
                'bell',
                'cleansing',
                'formation',
                'poison-powder',
                'poison-mist',
              ]),
            ) &&
            ['age', 'stage', 'target'].every((key) => optional(object[key], nonnegative)) &&
            ['anchorX', 'anchorY'].every((key) => optional(object[key], finite)) &&
            ['radius', 'warning', 'hp', 'maxHp'].every((key) => nonnegative(object[key])) &&
            numbers(object, ['x', 'y', 'life', 'pulse', 'aim']),
        ) &&
        Array.isArray(objects) &&
        objects.length <= 12 &&
        uniqueIds(objects),
    ) &&
    optional(
      value.zones,
      (zones) =>
        list(
          zones,
          (zone) =>
            record(zone) &&
            integer(zone.id) &&
            member(zone.kind, ['poison', 'cold', 'trap', 'gate', 'blood', 'brew', 'fire']) &&
            optional(zone.impactDamage, nonnegative) &&
            optional(zone.owner, integer) &&
            numbers(zone, ['x', 'y', 'radius', 'warning', 'life', 'pulse']),
        ) &&
        Array.isArray(zones) &&
        zones.length <= 8,
    ) &&
    list(value.offers, offer) &&
    value.offers.length <= 3 &&
    integer(value.spent) &&
    validOffers(
      value.offers as RecordValue[],
      value.fighter as RecordValue,
      value.spent as number,
    ) &&
    list(value.xpBudget, nonnegative) &&
    value.xpBudget.length === 20 &&
    nonnegative(value.gold) &&
    integer(value.kills) &&
    nonnegative(value.elapsed) &&
    text(value.message) &&
    integer(value.merchantStock) &&
    optional(
      value.restEvents,
      (events) =>
        Array.isArray(events) &&
        events.length <= 4 &&
        events.every(
          (event) =>
            record(event) &&
            [4, 9, 14, 19].includes(Number(event.wave)) &&
            integer(event.wave) &&
            Number(event.wave) <= Number(value.wave) &&
            member(event.kind, ['herbalist', 'manuscript', 'salvage']) &&
            member(event.choice, ['accept', 'leave']),
        ) &&
        new Set(events.map((event) => (event as RecordValue).wave)).size === events.length,
    ) &&
    optional(
      value.supplies,
      (supplies) =>
        list(
          supplies,
          (supply) =>
            record(supply) &&
            text(supply.templateId) &&
            !!itemDefinition(supply.templateId) &&
            integer(supply.stock) &&
            (supply.stock as number) <= 3 &&
            integer(supply.price) &&
            (supply.price as number) > 0,
        ) &&
        Array.isArray(supplies) &&
        supplies.length === 3 &&
        new Set(supplies.map((supply) => (supply as RecordValue).templateId)).size === 3,
    )
  );
}

/** Validate before publishing a save to React or writing it back. Never repair by overwriting. */
export function isGameSave(value: unknown): value is GameState {
  if (!record(value) || value.version !== 1 || !record(value.family)) return false;
  const family = value.family;
  const roster = family.roster;
  return (
    list(roster, fighter) &&
    uniqueIds(roster) &&
    list(family.warehouse, item) &&
    uniqueIds(family.warehouse) &&
    ['runs', 'victories', 'deaths', 'retired'].every((key) => integer(family[key])) &&
    optional(family.itemSequence, integer) &&
    optional(family.silver, integer) &&
    optional(family.recruitment, recruitment) &&
    optional(
      family.journeys,
      (journeys) =>
        list(
          journeys,
          (journey) =>
            record(journey) &&
            text(journey.id) &&
            text(journey.name) &&
            member(journey.outcome, ['victory', 'dead']) &&
            integer(journey.wave) &&
            (journey.wave as number) >= 1 &&
            (journey.wave as number) <= 20 &&
            ['level', 'kills', 'gold', 'items'].every((key) => integer(journey[key])) &&
            nonnegative(journey.elapsed) &&
            nonnegative(journey.endedAt) &&
            list(journey.route, text) &&
            journey.route.length <= 4,
        ) &&
        Array.isArray(journeys) &&
        journeys.length <= 10 &&
        uniqueIds(journeys),
    ) &&
    optional(
      family.training,
      (training) =>
        record(training) &&
        text(training.fighterId) &&
        integer(training.seed) &&
        roster.some((f) => (f as RecordValue).id === training.fighterId) &&
        list(training.offers, offer) &&
        training.offers.length <= 3 &&
        validOffers(
          training.offers as RecordValue[],
          (roster as RecordValue[]).find((f) => f.id === training.fighterId)!,
          Number(
            (roster as RecordValue[]).find((f) => f.id === training.fighterId)!.spent ??
              (roster as RecordValue[]).find((f) => f.id === training.fighterId)!.level,
          ),
        ),
    ) &&
    (value.selectedId === null || text(value.selectedId)) &&
    (value.run === null || run(value.run))
  );
}
