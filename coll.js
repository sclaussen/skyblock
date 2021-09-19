'use strict'
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const clicolor = require('cli-color');
const program = require('commander');

const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;

const curl = require('./lib/curl');
const casey = require('./lib/casey');
const p = require('./lib/pr').p(d);
const e = require('./lib/pr').e(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);
const table = require('./lib/util').table;

const { sortBy, deburr, groupBy, orderBy, toLower, map, uniq, filter } = _

var options;

collections(process.argv);

async function collections(args) {

    collections2();

    options = parse(args);

    let skyblockCollections = await readSkyblockCollections();
    let sortedSkyblockCollections = sortBy(skyblockCollections, [ 'group', 'name' ]);
    let playerCollections = YAML.parse(fs.readFileSync('./collections2.yaml', 'utf8'));

    printCollections(skyblockCollections, playerCollections, options);
}

function printCollections(skyblockCollections, playerCollections, options) {
    for (let skyblockCollection of skyblockCollections) {

        let playerCollection = _.find(playerCollections, { name: skyblockCollection.name });
        if (!playerCollection) {
            console.log('ERROR: Unable to find the player collection: ' + skyblockCollection.name);
            process.exit(1);
        }

        // See if the collection has already been completed
        let collectionCompleted = '';
        if (playerCollection.level === skyblockCollection.tiers) {
            collectionCompleted = '✓';
        }

        console.log(lj(collectionCompleted, 2) + skyblockCollection.name + ' (' + playerCollection.level + ' of ' + skyblockCollection.tiers + ' tiers)');
        if (collectionCompleted === '✓') {
            if (options.unlocked) {
                console.log();
                continue;
            }
        }

        for (let tier of _.keys(skyblockCollection.unlocks)) {
            for (let unlock of skyblockCollection.unlocks[tier]) {

                let tierCompleted = '';
                if (tier <= playerCollection.level) {
                    tierCompleted = '✓';
                }

                if (options.locked && tierCompleted === '✓') {
                    continue;
                }

                console.log('  ' + lj(tierCompleted, 3) + rj(tier, 2) + ' ' + lj(skyblockCollection.group + ' ' + skyblockCollection.name, 20) + ' ' +  unlock.toLowerCase());
            }
        }
        console.log();
    }
}

async function collections2(args) {

    var collection = [
        'BLAZE_ROD_-1',
        'BLAZE_ROD_1',
        'BLAZE_ROD_2',
        'BLAZE_ROD_3',
        'BLAZE_ROD_4',
        'BLAZE_ROD_5',
        'BLAZE_ROD_7',
        'BONE_-1',
        'BONE_1',
        'BONE_2',
        'BONE_3',
        'BONE_4',
        'BONE_5',
        'BONE_6',
        'BONE_7',
        'BONE_8',
        'BONE_9',
        'CACTUS_-1',
        'CACTUS_1',
        'CACTUS_2',
        'CACTUS_3',
        'CACTUS_4',
        'CACTUS_5',
        'CACTUS_6',
        'CARROT_ITEM_-1',
        'CARROT_ITEM_1',
        'CARROT_ITEM_2',
        'CARROT_ITEM_3',
        'CARROT_ITEM_4',
        'CARROT_ITEM_5',
        'CLAY_BALL_-1',
        'CLAY_BALL_1',
        'CLAY_BALL_2',
        'CLAY_BALL_3',
        'CLAY_BALL_4',
        'CLAY_BALL_5',
        'COAL_-1',
        'COAL_1',
        'COAL_10',
        'COAL_2',
        'COAL_3',
        'COAL_4',
        'COAL_5',
        'COAL_6',
        'COAL_7',
        'COAL_8',
        'COAL_9',
        'COBBLESTONE_-1',
        'COBBLESTONE_1',
        'COBBLESTONE_10',
        'COBBLESTONE_2',
        'COBBLESTONE_3',
        'COBBLESTONE_4',
        'COBBLESTONE_5',
        'COBBLESTONE_6',
        'COBBLESTONE_7',
        'COBBLESTONE_8',
        'COBBLESTONE_9',
        'DIAMOND_-1',
        'DIAMOND_1',
        'DIAMOND_2',
        'DIAMOND_3',
        'DIAMOND_4',
        'DIAMOND_5',
        'DIAMOND_6',
        'DIAMOND_7',
        'DIAMOND_8',
        'DIAMOND_9',
        'EMERALD_-1',
        'EMERALD_1',
        'EMERALD_2',
        'EMERALD_3',
        'EMERALD_4',
        'EMERALD_5',
        'EMERALD_6',
        'ENDER_PEARL_-1',
        'ENDER_PEARL_1',
        'ENDER_PEARL_2',
        'ENDER_PEARL_3',
        'ENDER_PEARL_4',
        'ENDER_PEARL_5',
        'ENDER_PEARL_6',
        'ENDER_PEARL_7',
        'ENDER_PEARL_8',
        'ENDER_PEARL_9',
        'ENDER_STONE_-1',
        'ENDER_STONE_1',
        'ENDER_STONE_2',
        'ENDER_STONE_3',
        'ENDER_STONE_4',
        'ENDER_STONE_5',
        'ENDER_STONE_6',
        'ENDER_STONE_7',
        'ENDER_STONE_8',
        'FEATHER_-1',
        'FEATHER_1',
        'FEATHER_2',
        'FEATHER_3',
        'FEATHER_4',
        'FEATHER_5',
        'FEATHER_6',
        'FEATHER_7',
        'GHAST_TEAR_-1',
        'GHAST_TEAR_1',
        'GHAST_TEAR_2',
        'GHAST_TEAR_3',
        'GHAST_TEAR_4',
        'GHAST_TEAR_5',
        'GHAST_TEAR_6',
        'GLOWSTONE_DUST_-1',
        'GLOWSTONE_DUST_1',
        'GLOWSTONE_DUST_2',
        'GLOWSTONE_DUST_3',
        'GLOWSTONE_DUST_4',
        'GLOWSTONE_DUST_5',
        'GLOWSTONE_DUST_6',
        'GLOWSTONE_DUST_7',
        'GLOWSTONE_DUST_8',
        'GLOWSTONE_DUST_9',
        'GOLD_INGOT_-1',
        'GOLD_INGOT_1',
        'GOLD_INGOT_2',
        'GOLD_INGOT_3',
        'GOLD_INGOT_4',
        'GOLD_INGOT_5',
        'GOLD_INGOT_6',
        'GOLD_INGOT_7',
        'GOLD_INGOT_8',
        'GRAVEL_-1',
        'GRAVEL_1',
        'GRAVEL_2',
        'GRAVEL_3',
        'GRAVEL_4',
        'GRAVEL_6',
        'GRAVEL_7',
        'GRAVEL_8',
        'GRAVEL_9',
        'ICE_-1',
        'ICE_1',
        'ICE_2',
        'ICE_3',
        'ICE_4',
        'ICE_5',
        'INK_SACK:3_-1',
        'INK_SACK:3_1',
        'INK_SACK:3_2',
        'INK_SACK:3_3',
        'INK_SACK:3_4',
        'INK_SACK:3_5',
        'INK_SACK:3_6',
        'INK_SACK:3_7',
        'INK_SACK:4_-1',
        'INK_SACK:4_1',
        'INK_SACK:4_10',
        'INK_SACK:4_2',
        'INK_SACK:4_3',
        'INK_SACK:4_4',
        'INK_SACK:4_5',
        'INK_SACK:4_6',
        'INK_SACK:4_7',
        'INK_SACK:4_8',
        'INK_SACK:4_9',
        'INK_SACK_-1',
        'INK_SACK_1',
        'INK_SACK_2',
        'INK_SACK_3',
        'INK_SACK_4',
        'IRON_INGOT_-1',
        'IRON_INGOT_1',
        'IRON_INGOT_2',
        'IRON_INGOT_3',
        'IRON_INGOT_4',
        'IRON_INGOT_5',
        'IRON_INGOT_6',
        'IRON_INGOT_7',
        'IRON_INGOT_8',
        'IRON_INGOT_9',
        'LEATHER_-1',
        'LEATHER_1',
        'LEATHER_2',
        'LEATHER_3',
        'LEATHER_4',
        'LEATHER_5',
        'LEATHER_6',
        'LEATHER_7',
        'LEATHER_8',
        'LOG:1_-1',
        'LOG:1_1',
        'LOG:1_2',
        'LOG:1_3',
        'LOG:1_4',
        'LOG:1_5',
        'LOG:2_-1',
        'LOG:2_1',
        'LOG:2_2',
        'LOG:2_3',
        'LOG:2_4',
        'LOG:2_5',
        'LOG:2_6',
        'LOG:2_7',
        'LOG:2_8',
        'LOG:2_9',
        'LOG:3_-1',
        'LOG:3_1',
        'LOG:3_2',
        'LOG:3_3',
        'LOG:3_4',
        'LOG:3_5',
        'LOG:3_6',
        'LOG:3_7',
        'LOG:3_8',
        'LOG:3_9',
        'LOG_-1',
        'LOG_1',
        'LOG_2',
        'LOG_2:1_-1',
        'LOG_2:1_1',
        'LOG_2:1_2',
        'LOG_2:1_3',
        'LOG_2:1_4',
        'LOG_2:1_5',
        'LOG_2:1_6',
        'LOG_2_-1',
        'LOG_2_1',
        'LOG_2_2',
        'LOG_2_3',
        'LOG_2_4',
        'LOG_2_5',
        'LOG_2_6',
        'LOG_2_7',
        'LOG_3',
        'LOG_4',
        'LOG_5',
        'LOG_6',
        'LOG_7',
        'LOG_8',
        'LOG_9',
        'MAGMA_CREAM_-1',
        'MAGMA_CREAM_1',
        'MAGMA_CREAM_2',
        'MAGMA_CREAM_3',
        'MAGMA_CREAM_4',
        'MAGMA_CREAM_5',
        'MAGMA_CREAM_6',
        'MAGMA_CREAM_7',
        'MAGMA_CREAM_8',
        'MAGMA_CREAM_9',
        'MELON_-1',
        'MELON_1',
        'MELON_2',
        'MELON_3',
        'MELON_4',
        'MELON_5',
        'MELON_6',
        'MITHRIL_ORE_-1',
        'MITHRIL_ORE_1',
        'MITHRIL_ORE_2',
        'MITHRIL_ORE_3',
        'MITHRIL_ORE_4',
        'MITHRIL_ORE_5',
        'MITHRIL_ORE_6',
        'MUSHROOM_COLLECTION_-1',
        'MUSHROOM_COLLECTION_1',
        'MUSHROOM_COLLECTION_2',
        'MUSHROOM_COLLECTION_4',
        'MUSHROOM_COLLECTION_5',
        'MUSHROOM_COLLECTION_6',
        'MUSHROOM_COLLECTION_7',
        'MUTTON_-1',
        'MUTTON_1',
        'MUTTON_2',
        'MUTTON_3',
        'MUTTON_4',
        'MUTTON_5',
        'MUTTON_6',
        'MUTTON_7',
        'NETHERRACK_-1',
        'NETHERRACK_1',
        'NETHERRACK_2',
        'NETHERRACK_3',
        'NETHERRACK_4',
        'NETHER_STALK_-1',
        'NETHER_STALK_1',
        'NETHER_STALK_2',
        'NETHER_STALK_3',
        'NETHER_STALK_4',
        'NETHER_STALK_5',
        'NETHER_STALK_6',
        'NETHER_STALK_7',
        'NETHER_STALK_8',
        'NETHER_STALK_9',
        'OBSIDIAN_-1',
        'OBSIDIAN_1',
        'OBSIDIAN_2',
        'OBSIDIAN_3',
        'OBSIDIAN_4',
        'OBSIDIAN_5',
        'OBSIDIAN_6',
        'OBSIDIAN_7',
        'OBSIDIAN_8',
        'PORK_-1',
        'PORK_1',
        'PORK_2',
        'PORK_3',
        'PORK_4',
        'PORK_5',
        'PORK_6',
        'POTATO_ITEM_-1',
        'POTATO_ITEM_1',
        'POTATO_ITEM_2',
        'POTATO_ITEM_3',
        'POTATO_ITEM_4',
        'POTATO_ITEM_5',
        'POTATO_ITEM_6',
        'POTATO_ITEM_7',
        'POTATO_ITEM_8',
        'PRISMARINE_CRYSTALS_-1',
        'PRISMARINE_CRYSTALS_1',
        'PRISMARINE_CRYSTALS_2',
        'PRISMARINE_CRYSTALS_3',
        'PRISMARINE_CRYSTALS_4',
        'PRISMARINE_CRYSTALS_5',
        'PRISMARINE_CRYSTALS_6',
        'PRISMARINE_CRYSTALS_7',
        'PRISMARINE_SHARD_-1',
        'PRISMARINE_SHARD_1',
        'PRISMARINE_SHARD_2',
        'PRISMARINE_SHARD_3',
        'PRISMARINE_SHARD_4',
        'PRISMARINE_SHARD_5',
        'PRISMARINE_SHARD_6',
        'PUMPKIN_-1',
        'PUMPKIN_1',
        'PUMPKIN_2',
        'PUMPKIN_3',
        'PUMPKIN_4',
        'PUMPKIN_5',
        'PUMPKIN_6',
        'PUMPKIN_7',
        'PUMPKIN_8',
        'QUARTZ_-1',
        'QUARTZ_1',
        'QUARTZ_2',
        'QUARTZ_3',
        'QUARTZ_4',
        'QUARTZ_5',
        'QUARTZ_6',
        'QUARTZ_7',
        'QUARTZ_8',
        'QUARTZ_9',
        'RABBIT_-1',
        'RABBIT_1',
        'RABBIT_2',
        'RABBIT_3',
        'RABBIT_4',
        'RABBIT_5',
        'RABBIT_6',
        'RABBIT_7',
        'RABBIT_8',
        'RAW_CHICKEN_-1',
        'RAW_CHICKEN_1',
        'RAW_CHICKEN_2',
        'RAW_CHICKEN_3',
        'RAW_CHICKEN_4',
        'RAW_CHICKEN_5',
        'RAW_CHICKEN_6',
        'RAW_CHICKEN_7',
        'RAW_FISH:1_-1',
        'RAW_FISH:1_1',
        'RAW_FISH:1_2',
        'RAW_FISH:1_3',
        'RAW_FISH:1_4',
        'RAW_FISH:1_5',
        'RAW_FISH:1_6',
        'RAW_FISH:1_7',
        'RAW_FISH:2_-1',
        'RAW_FISH:2_1',
        'RAW_FISH:2_2',
        'RAW_FISH:2_3',
        'RAW_FISH:2_4',
        'RAW_FISH:2_5',
        'RAW_FISH:2_6',
        'RAW_FISH:3_-1',
        'RAW_FISH:3_1',
        'RAW_FISH:3_2',
        'RAW_FISH:3_3',
        'RAW_FISH:3_4',
        'RAW_FISH:3_5',
        'RAW_FISH:3_6',
        'RAW_FISH:3_7',
        'RAW_FISH_-1',
        'RAW_FISH_1',
        'RAW_FISH_2',
        'RAW_FISH_3',
        'RAW_FISH_4',
        'RAW_FISH_5',
        'RAW_FISH_6',
        'RAW_FISH_7',
        'REDSTONE_-1',
        'REDSTONE_1',
        'REDSTONE_10',
        'REDSTONE_11',
        'REDSTONE_12',
        'REDSTONE_13',
        'REDSTONE_14',
        'REDSTONE_2',
        'REDSTONE_3',
        'REDSTONE_4',
        'REDSTONE_5',
        'REDSTONE_6',
        'REDSTONE_7',
        'REDSTONE_8',
        'REDSTONE_9',
        'ROTTEN_FLESH_-1',
        'ROTTEN_FLESH_1',
        'ROTTEN_FLESH_2',
        'ROTTEN_FLESH_3',
        'ROTTEN_FLESH_4',
        'ROTTEN_FLESH_5',
        'ROTTEN_FLESH_6',
        'ROTTEN_FLESH_7',
        'SAND_-1',
        'SAND_1',
        'SAND_2',
        'SAND_3',
        'SAND_4',
        'SAND_5',
        'SAND_6',
        'SAND_7',
        'SEEDS_-1',
        'SEEDS_1',
        'SEEDS_2',
        'SEEDS_3',
        'SEEDS_4',
        'SEEDS_5',
        'SEEDS_6',
        'SLIME_BALL_-1',
        'SLIME_BALL_1',
        'SLIME_BALL_2',
        'SLIME_BALL_3',
        'SLIME_BALL_4',
        'SLIME_BALL_5',
        'SLIME_BALL_6',
        'SLIME_BALL_7',
        'SLIME_BALL_8',
        'SPIDER_EYE_-1',
        'SPIDER_EYE_1',
        'SPIDER_EYE_2',
        'SPIDER_EYE_3',
        'SPIDER_EYE_4',
        'SPIDER_EYE_5',
        'SPIDER_EYE_6',
        'SPIDER_EYE_7',
        'SPIDER_EYE_8',
        'SPONGE_-1',
        'SPONGE_1',
        'SPONGE_2',
        'SPONGE_3',
        'SPONGE_4',
        'SPONGE_5',
        'STRING_-1',
        'STRING_1',
        'STRING_2',
        'STRING_3',
        'STRING_4',
        'STRING_5',
        'STRING_6',
        'STRING_7',
        'STRING_8',
        'STRING_9',
        'SUGAR_CANE_-1',
        'SUGAR_CANE_1',
        'SUGAR_CANE_2',
        'SUGAR_CANE_3',
        'SUGAR_CANE_4',
        'SUGAR_CANE_5',
        'SUGAR_CANE_6',
        'SUGAR_CANE_7',
        'SUGAR_CANE_8',
        'SULPHUR_-1',
        'SULPHUR_1',
        'WATER_LILY_-1',
        'WATER_LILY_1',
        'WATER_LILY_2',
        'WATER_LILY_3',
        'WATER_LILY_4',
        'WATER_LILY_5',
        'WHEAT_-1',
        'WHEAT_1',
        'WHEAT_10',
        'WHEAT_2',
        'WHEAT_3',
        'WHEAT_4',
        'WHEAT_5',
        'WHEAT_6',
        'WHEAT_7',
        'WHEAT_8',
        'WHEAT_9'
    ];


    let aliases = {
        'INK_SACK:3': 'cocoa_beans',
        'INK_SACK:4': 'lapis_lazuli',
        'LOG_2:1': 'dark_oak_wood',
        'LOG_2': 'acacia_wood',
        'LOG:1': 'spruce_wood',
        'LOG:2': 'birch_wood',
        'LOG:3': 'jungle_wood',
        'LOG': 'oak_wood',
        'CARROT_ITEM': 'carrot',
        'ENDER_STONE': 'end_stone',
        'POTATO_ITEM': 'potato',
        'CLAY_BALL': 'clay',
        'MUSHROOM_COLLECTION': 'mushroom',
        'RABBIT': 'raw_rabbit',
        'NETHER_STALK': 'nether_wart',
        'PORK': 'raw_porkchop',
        'QUARTZ': 'nether_quartz',
        'MITHRIL_ORE': 'mithril',
        'SLIME_BALL': 'slimeball',
    };

    for (let name of collection) {
        for (let alias of _.keys(aliases)) {
            if (name.includes(alias)) {
                p('replacing ' + alias  + ' with ' + aliases[alias]);
                name.replace(alias, aliases[alias]);
                break;
            }
        }
    }
    y4(collection.sort());
    process.exit(1);


    let collectionNames = [];
    collection.forEach(function(value) {
        if (value.includes('-1')) {
            collectionNames.push(value.substring(0, value.length - 3));
        }
    });
    y4(collectionNames.sort());
    process.exit(1);



    let levels = [];
    collectionNames.forEach(function(collectionName) {
        let matches = _.filter(collection, function(name) {
            if (name.includes(collectionName)) {
                return name;
            }
        });

        let last = matches[matches.length - 1];
        last = last.substring(last.lastIndexOf('_') + 1);
        levels.push({
            name: collectionName.toLowerCase(),
            level: parseInt(last)
        });
    });

    levels.push({
        name: 'gemstone',
        level: 19
    });
    levels.push({
        name: 'hard_stone',
        level: 19
    });
    levels.push({
        name: 'gunpowder',
        level: 19
    });

    fs.writeFileSync('./collections2.yaml', YAML.stringify(levels), 'utf8');

    y4(levels);

    console.log(table(levels.sort(), [
        {
            name: 'level',
            width: 2
        },
        {
            name: 'name',
            width: -20,
        },
    ]));
}

async function readSkyblockCollections() {
    let collections = [];

    let responseBody = (await curl.get('https://api.hypixel.net/resources/skyblock/collections')).body;

    for (let skyblockCollectionGroup of _.values(responseBody.collections)) {

        for (let skyblockCollection of _.values(skyblockCollectionGroup.items)) {

            let collection = {
                group: skyblockCollectionGroup.name.toLowerCase().replaceAll(' ', '_'),
                name: skyblockCollection.name.toLowerCase().replaceAll(' ', '_'),
                tiers: skyblockCollection.maxTiers,
                unlocks: {}
            };

            for (let tier of _.values(skyblockCollection.tiers)) {
                collection.unlocks[tier.tier] = tier.unlocks;
            }

            collections.push(collection);
        }
    }

    return collections;
}

function parse(args) {

    program
        .option('-l, --locked', 'Only list the locked tiers')
        .parse(args);

    let options = program.opts();

    // p4(options);

    return options;
}
