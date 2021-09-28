'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const _ = require('lodash');
const fs = require('fs');

const YAML = require('yaml');
const program = require('commander');
const moment = require('moment');

const { parse, writeUncompressed } = require('prismarine-nbt')
const writeAuctionItemsCache = require('./lib/auclib').writeAuctionItemsCache;
const readAuctionItemsCache = require('./lib/auclib').readAuctionItemsCache;
const removeSpecialCharacters = require('./lib/auclib').removeSpecialCharacters;
const format = require('./lib/util').format;

const slack = require('./lib/slack').slack;
const sleep = require('./lib/util').sleep;
const table = require('./lib/util').table;
const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;

const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);

// const watchFile = 'watch-test.yaml';
const watchFile = 'dat/watch.yaml';


auc(process.argv);


var options;


// def raw_damage():
//     return (5 + weapon_dmg + floor(strength) / 5) * (1 + (strength) / 100.0)
// def ench_damage():
//     return raw_damage() * (1 + ench_modifer / 100.0)
// def final_damage():
//     return ench_damage() * (1 + (crit_dmg) / 100.0)
async function auc(args) {

    // Parse the options
    options = parseArguments(args);

    if (!options.query) {
        while (true) {

            // Get the auctions from skyblock and write out the auction cache
            await writeAuctionItemsCache();

            // Read the watch definitions
            console.log('Reading watch definitions...');
            let watchDefinitions = YAML.parse(fs.readFileSync(watchFile, 'utf8'), { prettyErrors: true });

            // Read the auction cache
            console.log('Reading auction cache...');
            let auctionItems = await readAuctionItemsCache();

            // Find all auction matches based on watch.yaml
            let matches = sort(await findMatches(auctionItems, watchDefinitions));

            // Print everything out
            console.clear();
            console.log('\n-- Research --');
            console.log(print(_.filter(matches, function(o) { return o.action === 'research' })));

            console.log('\n-- Buy --');
            console.log(print(_.filter(matches, function(o) { return o.action === 'buy' })));

            console.log('\n-- Flip --');
            console.log(print(_.filter(matches, function(o) { return o.action !== 'buy' && o.action !== 'research' })));

            console.log();
        }
    }


    // await writeAuctionItemsCache();
    let auctionItems = await readAuctionItemsCache();
    let filtered = filter(auctionItems, options);
    let sorted = sort(filtered);
    let truncated = sorted;
    if (options.limit) {
        truncated = truncated.splice(0, options.limit);
    }

    // await digBytes(truncated);

    console.log(print(truncated));
}

async function digBytes(items) {
    for (let item of items) {
        let buffer = new Buffer.from(item.item_bytes, 'base64');
        const { parsed, type } = await parse(buffer)
        p4(parsed);
    }
}

function filter(items, criteria) {

    // Find the auctions containing the user specified query
    return _.filter(items, function(o) {

        if (o.type !== 'BIN') {
            return false;
        }

        // Match the name
        if (!o.name.includes(criteria.query)) {
            return false;
        }

        // Match the tier
        if (criteria.tier && !o.tier.includes(criteria.tier)) {
            return false;
        }

        // Match the reforge
        if (criteria.reforge &&!o.reforge.includes(criteria.reforge)) {
            return false;
        }

        // Match only enchanted book phrases if -e was provided
        if (options.enchantment && !o.name.includes('enchanted book')) {
            return false;
        }

        // Match the extra metadata if values were provided
        if (criteria.extra) {
            for (let extraPhrase of criteria.extra) {
                if (!o.extra.includes(extraPhrase)) {
                    return false;
                }
            }
        }

        // Verify the selling prices is less than the max
        if (criteria.max) {
            if (!(o.cost < criteria.max)) {
                return false;
            }
        }

        // Match the star rating if it was provided
        if (criteria.stars) {
            switch (criteria.stars) {
            case 5:
                if (o.stars !== '✪✪✪✪✪') {
                    return false;
                }
                break;
            case 4:
                if (o.stars !== '✪✪✪✪') {
                    return false;
                }
                break;
            case 3:
                if (o.stars !== '✪✪✪') {
                    return false;
                }
                break;
            case 2:
                if (o.stars !== '✪✪') {
                    return false;
                }
                break;
            case 1:
                if (o.stars !== '✪') {
                    return false;
                }
                break;
            }
        }

        return true;
    });
}

async function findMatches(auctionItems, watchDefinitions) {
    let matches = [];
    let recordLowCostFound = false;
    watchDefinitions = _.mapKeys(watchDefinitions, function(value, key) {
        return key.replaceAll('X', '\'');
    });

    for (let watchDefinitionKey of _.keys(watchDefinitions)) {


        let watchDefinition = watchDefinitions[watchDefinitionKey];
        if (!watchDefinition) {
            continue;
        }


        // Add the watchDefinition key as the query property converting
        // underscores to spaces or dashes
        if (!watchDefinition.query) {
            if (watchDefinition.enchantment) {
                watchDefinition.query = watchDefinitionKey.replaceAll('_', '-');
            } else {
                watchDefinition.query = watchDefinitionKey.replaceAll('_', ' ');
            }
            watchDefinition.query_added = true;
        }
        if (watchDefinition.query2) {
            watchDefinition.query_saved = watchDefinition.query;
            watchDefinition.query += '\'' + watchDefinition.query2;
        }


        // Append pet to the query for watch definitions with pet=true
        if (watchDefinition.pet && !watchDefinition.query.includes(' pet')) {
            watchDefinition.query += ' pet';
        }


        if (watchDefinition.action === 'research' && !watchDefinition.limit) {
            watchDefinition.limit = 3;
            watchDefinition.limit_added = true;
        }


        // Find the auction items that match the watchDefinition criteria
        let results = sort(filter(auctionItems, watchDefinition));
        if (watchDefinition.limit) {
            results = results.slice(0, watchDefinition.limit);
        }

        _.map(results, function(match, key, coll) {

            // "action"
            match.action = 'flip';
            if ('action' in watchDefinition) {
                match.action = watchDefinition.action;
            }

            // "sell"
            match.sell = 0;
            if ('sell' in watchDefinition) {
                match.sell = watchDefinition.sell;
            }

            // "margin"
            match.margin = 0;
            if (watchDefinition.sell) {
                match.margin = (match.sell - match.cost) / match.cost;
            }

            // "max"
            if ('max' in watchDefinition) {
                match.max = watchDefinition.max;
            }

            // new low?
            if (!watchDefinition.low || match.cost < watchDefinition.low) {
                recordLowCostFound = true;
                watchDefinition.low = match.cost;
                logLowCost(match, watchDefinition, watchDefinitionKey);
            }
        });


        matches.push(results);
    }


    // Notify action=notify|view
    matches = _.flatten(matches);
    if (!options.noNotifications) {
        let slackMessage = '';
        let slacks = [];
        for (let match of matches) {
            if (match.action !== 'quiet' && match.action !== 'research' && match.action !== 'buy') {
                if (match.cost < match.max) {
                    slacks.push(JSON.parse(JSON.stringify(match)));
                }
            }
        }
        if (slacks.length > 0) {
            let now = moment().format('hh:mm:ss');
            let slackMessage = printSlack(sort(slacks));
            let response = await slack('```' + now + '\n' + slackMessage + '```');
        }
    }


    // If any new record low auction item costs were found
    // re-serialize the watch.yaml file
    if (recordLowCostFound) {
        console.log('Re-serializing watch.yaml due to new record low(s).');
        serializeWatchDefinitions(watchDefinitions);
    }


    // Remove action=quiet
    matches = _.filter(matches, function(match) {
        if (match.action !== 'research' && match.action !== 'buy' && match.action !== 'flip') {
            return false;
        }
        return true;
    });


    return matches;
}

function sort(auctionItems) {
    return _.sortBy(auctionItems, [ 'name', 'cost' ]);
}

function logLowCost(match, watchDefinition, watchDefinitionKey) {
    let s = '';
    s += rj(Number(Number.parseFloat(watchDefinition.low).toFixed(0)).toLocaleString(), 13);
    s += rj(Number(Number.parseFloat(match.cost).toFixed(0)).toLocaleString(), 13) + '  ';
    s += lj(watchDefinitionKey, 50);
    s += lj(watchDefinition.query, 50);
    s += '\n';
    fs.appendFileSync('./dat/lows.yaml', s, 'utf-8');
}

function serializeWatchDefinitions(watchDefinitions) {
    // Reset the watchDefinition back to its initial values so the augmented
    // values don't get serialized into the definitions file.
    watchDefinitions = _.mapKeys(watchDefinitions, function(value, key) {
        return key.replaceAll('\'', 'X');
    });

    _.map(watchDefinitions, function(watchDefinition) {

        if (watchDefinition.query2) {
            watchDefinition.query = watchDefinition.query_saved;
            delete watchDefinition.query_saved;
        }

        if (watchDefinition.query_added) {
            delete watchDefinition.query_added;
            delete watchDefinition.query;
        }

        if (watchDefinition.limit_added) {
            delete watchDefinition.limit_added;
            delete watchDefinition.limit;
        }
    });

    fs.writeFileSync(watchFile, YAML.stringify(watchDefinitions), 'utf8');
}

function print(items, max, highlight) {
    items = augmentNames(items);
    items = addStats(items);
    return table(items, [
        {
            name: 'cost',
            width: 5,
            format: { mix: true },
            extra_spaces: 1
        },
        {
            name: 'sell',
            width: 5,
            format: { mix: true, hide_zero: true },
        },
        {
            name: 'margin',
            alias: 'm%',
            width: 3,
            format: { percent: true, hide_zero: true },
            // highlight_green_above: 15,
            // highlight_red_below: 10,
        },
        {
            name: 'name',
            width: -75,
        },
        // {
        //     name: 'health',
        //     alias: 'H',
        //     width: 3,
        // },
        // {
        //     name: 'health_reforge',
        //     alias: ' ',
        //     width: 3,
        // },
        // {
        //     name: 'health_potato',
        //     alias: ' ',
        //     width: 2,
        //     extra_spaces: 3,
        //     // highlight_green_above: 1,
        // },
        // {
        //     name: 'defense',
        //     alias: 'D',
        //     width: 3,
        // },
        // {
        //     name: 'defense_reforge',
        //     alias: ' ',
        //     width: 2,
        // },
        // {
        //     name: 'defense_potato',
        //     alias: ' ',
        //     width: 2,
        //     // highlight_green_above: 1,
        //     extra_spaces: 3
        // },
        // {
        //     name: 'strength',
        //     alias: 'S',
        //     width: 3,
        // },
        // {
        //     name: 'strength_reforge',
        //     alias: ' ',
        //     width: 3,
        //     extra_spaces: 3
        // },
        // {
        //     name: 'crit_chance',
        //     alias: 'CC',
        //     width: 4,
        // },
        // {
        //     name: 'crit_damage',
        //     alias: 'CD',
        //     width: 4,
        //     extra_spaces: 3
        // },
        // {
        //     name: 'intelligence',
        //     alias: 'I',
        //     width: 3,
        //     extra_spaces: 3
        // },
        // {
        //     name: 'speed',
        //     alias: 'S',
        //     width: 3,
        //     extra_spaces: 3
        // },
        // {
        //     name: 'attack_speed',
        //     alias: 'AS',
        //     width: 4,
        //     extra_spaces: 3
        // },
        {
            name: 'gear_score',
            alias: 'GS',
            width: 4,
            extra_spaces: 3
        },
        {
            name: 'enchantments',
            width: -40,
            format: { shorten: 80, shorten_append: '...]' }
        },
    ], highlight);
}

function printSlack(items, max, highlight) {
    items = augmentNames(items);
    // items = addStats(items);
    return table(items, [
        {
            name: 'cost',
            width: 5,
            format: { mix: true },
            extra_spaces: 1
        },
        {
            name: 'sell',
            width: 5,
            format: { mix: true, hide_zero: true },
        },
        {
            name: 'name',
            width: -75,
        },
    ], highlight);
}

function augmentNames(items) {
    // Augment the name field with tier, reforge, and pet level
    _.map(items, function(item, key, coll) {
        if (item.tier) {
            item.name += ' [' + item.tier.substring(2) + ']';
        }
        if (item.reforge) {
            item.name += ' [' + item.reforge + ']';
        }
        if (item.pet_level) {
            item.name += ' [' + item.pet_level + ']';
        }
        if (item.stars) {
            item.name += ' ' + item.stars;
        }
        if (item.pet_held_item) {
            item.name += ' [' + item.pet_held_item + ']';
        }
        if (item.pet_candy_used) {
            item.name += ' [candy: ' + item.pet_candy_used + ']';
        }
    });
    return items;
}

function addStats(items) {
    _.map(items, function(item) {

        let match;
        let regex;

        let lore = removeSpecialCharacters(item.lore);

        // Gear score
        let gearScore = getField(lore, 'gear score');
        item.gear_score = gearScore.substring(0, gearScore.indexOf(' '));


        // Strength
        let strength = getField(lore, 'strength');
        regex = /^\+([0-9]+)/;
        match = regex.exec(strength);
        if (match) {
            item.strength = match[1];
        }

        regex = /[a-z]+ \+([0-9]+)/;
        match = regex.exec(strength);
        if (match) {
            item.strength_reforge = match[1];
        }


        // Crit Chance
        let critChance = getField(lore, 'crit chance');
        regex = /^\+([0-9]+%)/;
        match = regex.exec(critChance);
        if (match) {
            item.crit_chance = match[1];
        }



        // Crit Damage
        let critDamage = getField(lore, 'crit damage');
        regex = /^\+([0-9]+\%)/;
        match = regex.exec(critDamage);
        if (match) {
            item.crit_damage = match[1];
        }



        // Health
        let health = getField(lore, 'health');

        // Health
        regex = /^\+([0-9]+) hp/;
        match = regex.exec(health);
        if (match) {
            item.health = match[1];
        }

        // Health reforge
        regex = /[a-z]+ \+([0-9]+)/;
        match = regex.exec(health);
        if (match) {
            item.health_reforge = match[1];
        }

        // Health potato (extracted from health)
        regex = /\(\+([1-9]?[0-9]) hp\)/;
        match = regex.exec(health);
        if (match) {
            item.health_potato = match[1];
        }


        // Defense
        let defense = getField(lore, 'defense');

        // Defense
        regex = /^\+([0-9]+)/;
        match = regex.exec(defense);
        if (match) {
            item.defense = match[1];
        }

        // Defense reforge
        regex = /[a-z]+ \+([0-9]+)/;
        match = regex.exec(defense);
        if (match) {
            item.defense_reforge = match[1];
        }

        // Defense potato (extracted from defense)
        regex = /\(\+([1-9]?[0-9])\)/;
        match = regex.exec(defense);
        if (match) {
            item.defense_potato = match[1];
        }


        // Intelligence
        let intelligence = getField(lore, 'intelligence');
        regex = /^\+([0-9]+)/;
        match = regex.exec(intelligence);
        if (match) {
            item.intelligence = match[1];
        }


        // Speed
        let speed = getField(lore, 'speed');
        regex = /^\+([0-9]+)/;
        match = regex.exec(speed);
        if (match) {
            item.speed = match[1];
        }


        // Attack speed
        let attackSpeed = getField(lore, 'bonus attack speed');
        regex = /^\+([0-9]+\%)/;
        match = regex.exec(attackSpeed);
        if (match) {
            item.attack_speed = match[1];
        }
    });


    return items;
}

function getField(lore, field) {
    for (let line of lore.split('\n')) {
        if (line.startsWith(field)) {
            return line.substring(field.length + 2);
        }
    }
    return '';
}

function parseArguments(args) {

    program
        .option('-e, --enchantment', 'Search for an enchantment book that contains the phrase')
        .option('-p, --pet', 'Search for a pet')
        .option('-r, --reforge <reforge>', 'Only include items with the reforge')
        .option('-s, --stars <stars>', 'Only include items with the star count')
        .option('-t, --tier <tier>', 'Only include items in the tier level (eg comm, unco, rare, epic, lege)')
        .option('-x, --extra <string...>', 'Include extra metadata containing all the match values')

        .option('-l, --limit <limit>', 'Limit output to the first N items', 30)
        .option('-a, --all', 'Remove default limit so all matches are returned')

        .option('-n, --no-notifications', 'Remove slack notifications')

        .addHelpText('after', `

Watch for auctions meeting the criteria defined in watch.yaml (loops):
  $ auc

Find strong dragon boot auctions:
  $ auc "strong dragon boots"
  $ auc "strong dragon boots" -l 50                    # limit output to the 50 cheapest items
  $ auc "strong dragon boots" -a                       # do not limit the output
  $ auc "strong dragon boots" -t lege                  # find legendary boots
  $ auc "strong dragon boots" -t lege -s5              # find 5 star legendary boots
  $ auc "strong dragon boots" -t lege -s5 -r fierce    # find 5 star legendary fierce boots

Find boots that have protection and growth enchantments
  $ auc boots -x protection growth

Find pet auctions:
  $ auc -p "wither skeleton"

Find enchantment books:
  $ auc -e sharpness
  $ auc -e one-for-all
  $ auc "enchantment book" -x protection growth        # A composite enchantment book
`)
        .parse(args);


    let options = program.opts();

    if (program.args[0]) {
        options.query = program.args[0].toLowerCase();
    }

    // Remove the limit default if the user wants all matches
    if (options.all) {
        delete options.limit;
    }

    if (options.stars) {
        options.stars = parseInt(options.stars);
    }

    // If -p (pet), append "pet" to the search criteria
    if (options.pet && !options.query.includes(' pet')) {
        options.query = options.query + ' pet';
    }

    // If -W (watch) or -R (retrieve) remove all other flags
    if (!options.query) {
        delete options.book;
        delete options.pet;
        delete options.reforge;
        delete options.tier;
        delete options.stars;
        delete options.extra;
        delete options.limit;
        delete options.all;
    }

    // p4(options);

    return options;
}
