'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const _ = require('lodash');
const fs = require('fs');

const YAML = require('yaml');
const program = require('commander');

const writeAuctionItemsCache = require('./lib/auclib').writeAuctionItemsCache;
const readAuctionItemsCache = require('./lib/auclib').readAuctionItemsCache;
const print = require('./lib/auclib').print;
const removeSpecialCharacters = require('./lib/auclib').removeSpecialCharacters;

const sleep = require('./lib/util').sleep;
const table = require('./lib/util').table;
const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;
const coins = require('./lib/util').coins;

const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);


auc(process.argv);


var options;


async function auc(args) {

    // Parse the options
    options = parse(args);

    if (options.retrieve) {
        while (true) {
            await writeAuctionItemsCache();
            sleep(10);
        }
    }

    if (options.watch) {
        while (true) {
            console.log('Reading watch definitions...');
            let watchDefinitions = YAML.parse(fs.readFileSync('./watch.yaml', 'utf8'), { prettyErrors: true });

            console.log('Reading auction cache...');
            let auctionItems = await readAuctionItemsCache();

            let matches = sort(findMatches(auctionItems, watchDefinitions));

            console.clear();
            console.log('-- Wish --');
            print(_.filter(matches, function(o) { return o.type === 'wish' && o.active !== false; }));

            console.log('\n-- Watch --');
            print(_.filter(matches, function(o) { return o.type === 'watch' && o.active !== false; }));

            console.log('\n-- Flip --');
            print(_.filter(matches, function(o) { return o.type !== 'wish' && o.type !== 'watch' && o.active !== false; }));

            console.log();
            sleep(15);
        }
    }

    let auctionItems = await readAuctionItemsCache();
    let filtered = filter(auctionItems, options);
    print(sort(filtered));


    let item = filtered[0];
    let lore = removeSpecialCharacters(item.lore);
    p(lore);
    getField(lore, 'strength');
    getField(lore, 'crit chance');
    getField(lore, 'crit damage');
    getField(lore, 'health');
    getField(lore, 'defense');
    getField(lore, 'speed');
    getField(lore, 'attack speed');
}

function getField(lore, field) {
    for (let line of lore.split('\n')) {
        if (line.startsWith(field)) {
            p('line: ' + line.substring(field.length + 1));
        }
    }
}

function findMatches(auctionItems, watchDefinitions) {
    let matches = [];
    let recordLowCostFound = false;
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
        p4(watchDefinition);


        // Find the auction items that match the watchDefinition criteria
        let results = filter(auctionItems, watchDefinition);


        // Three things:
        // - Add sell field from watchDefinition into match results
        // - Add active field from watchDefinition into match results
        // - Create a margin field in the match results
        // - Check to see if there's a new low cost
        _.map(results, function(match, key, coll) {

            match.type = 'deal';
            if ('type' in watchDefinition) {
                match.type = watchDefinition.type;
            }

            match.sell = 0;
            if ('sell' in watchDefinition) {
                match.sell = watchDefinition.sell;
            }

            match.margin = 0;
            if (watchDefinition.sell) {
                match.margin = (match.sell - match.cost) / match.cost;
            }

            match.active = true;
            if ('active' in watchDefinition) {
                match.active = watchDefinition.active;
            }

            if (!watchDefinition.low || match.cost < watchDefinition.low) {
                recordLowCostFound = true;
                watchDefinition.low = match.cost;
                logLowCost(match, watchDefinition, watchDefinitionKey);
            }
        });


        matches.push(results);
    }


    // If any new record low auction item costs were found
    // re-serialize the watch.yaml file
    if (recordLowCostFound) {
        serializeWatchDefinitions(watchDefinitions);
    }


    // Remove any active=false matches so they aren't displayed
    matches = _.filter(_.flatten(matches), function(match) {
        if ('active' in match) {
            return match.active;
        }
        return true;
    });

    return matches;
}

function filter(auctionItems, criteria) {

    let count = 1;

    // Find the auctions containing the user specified query
    return _.filter(auctionItems, function(o) {

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

        // Potentially limit the number of returned items
        if (criteria.limit && count > criteria.limit) {
            return false;
        }
        count++;

        return true;
    });
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
    fs.appendFileSync('./lows.yaml', s, 'utf-8');
}

function serializeWatchDefinitions(watchDefinitions) {
    // Reset the watchDefinition back to its initial values so the augmented
    // values don't get serialized into the definitions file.
    _.map(watchDefinitions, function(watchDefinition) {

        if (watchDefinition.query2) {
            watchDefinition.query = watchDefinition.query_saved;
            delete watchDefinition.query_saved;
        }

        if (watchDefinition.query_added) {
            delete watchDefinition.query_added;
            delete watchDefinition.query;
        }
    });

    fs.writeFileSync('./watch.yaml', YAML.stringify(watchDefinitions), 'utf8');
}

function parse(args) {

    program
        .option('-e, --enchantment', 'Search for an enchantment book that contains the phrase')
        .option('-p, --pet', 'Search for a pet')
        .option('-r, --reforge <reforge>', 'Only include items with the reforge')
        .option('-s, --stars <stars>', 'Only include items with the star count')
        .option('-t, --tier <tier>', 'Only include items in the tier level (eg comm, unco, rare, epic, lege)')
        .option('-x, --extra <string...>', 'Include extra metadata containing all the match values')

        .option('-l, --limit <limit>', 'Limit output to the first N items', 30)
        .option('-L, --limit-none', 'Remove default limit so all matches are returned')

        .option('-R, --retrieve', 'Refresh the local auction cache using the skyblock API')
        .option('-W, --watch', 'Watch for auctions meeting the criteria in watch.yaml')
        .addHelpText('after', `

Retrieve the latest auctions from skyblock (loops):
  $ auc -R

Watch for auctions meeting the criteria defined in watch.yaml (loops):
  $ auc -W

Find strong dragon boot auctions:
  $ auc "strong dragon boots"
  $ auc "strong dragon boots" -l 50                    # limit output to the 50 cheapest items
  $ auc "strong dragon boots" -L                       # do not limit the output
  $ auc "strong dragon boots" -t lege                  # find legendary boots
  $ auc "strong dragon boots" -t lege -s5              # find 5 star legendary boots
  $ auc "strong dragon boots" -t lege -s5 -r fierce    # find 5 star legendary fierce boots

Find boots that have protection and growth enchantments
  $ auc boots -x protection growth

Pet auctions:
  $ auc -p "wither skeleton"

Enchantment books:
  $ auc -e smite
  $ auc -e one-for-all
  $ auc "enchantment book" -x protection growth        # A composite enchantment book
`)
        .parse(args);


    let options = program.opts();

    if (program.args[0]) {
        options.query = program.args[0].toLowerCase();
    }

    // If -p (pet), append "pet" to the search criteria
    if (options.pet && !options.query.includes(' pet')) {
        options.query = options.query + ' pet';
    }

    // Remove the limit default if the user wants all matches
    if (options.limitNone) {
        delete options.limit;
    }

    if (options.stars) {
        options.stars = parseInt(options.stars);
    }

    // If -M (watch) or -R (retrieve) remove all other flags
    if (options.watch || options.retrieve) {
        delete options.book;
        delete options.pet;
        delete options.reforge;
        delete options.tier;
        delete options.stars;
        delete options.extra;
        delete options.limit;
        delete options.limitNone;
        delete options.query;
    }

    if (!options.watch && !options.retrieve && !options.query) {
        console.log('Try mon --help');
        process.exit(1);
    }

    p4(options);

    return options;
}
