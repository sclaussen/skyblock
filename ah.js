'use strict';
// process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const _ = require('lodash');
const fs = require('fs');

const YAML = require('yaml');
const program = require('commander');
const moment = require('moment');
const { parse, writeUncompressed } = require('prismarine-nbt')

const createAuctionObject = require('./lib/ahlib').createAuctionObject;

const userlib = require('./lib/user');

const slack = require('./lib/slack').slack;

const format = require('./lib/util').format;
const sleep = require('./lib/util').sleep;
const table = require('./lib/util').table;
const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;
const getenv = require('./lib/util').getenv;

const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);

const curl = require('./lib/curl');



const cacheFile = './.auction-items';
const watchFile = './dat/ah-' + process.env.SKYBLOCK_USER + '.yaml';



var user;
var uuid;
var criteria;



ah(process.argv);


async function ah(args) {


    // Parse the command line options
    criteria = await parseArguments(args);


    // Use the criteria from the command line to search for matches
    // across the auctions cached by the "looping ah" command
    if (criteria.query) {
        let auctions = JSON.parse(fs.readFileSync(cacheFile));
        console.log(print(limit(sort(filterByCriteria(auctions, criteria)))));
        process.exit(0);
    }


    // Use the criteria from the watch definitions
    while (true) {

        // Handle page 1
        console.log('\n\nRetrieving the latest set of auctions...');
        let body = (await curl.get('https://api.hypixel.net/skyblock/auctions')).body;
        let auctionsFromPage = await transformAndFilterAuctions(body.auctions);
        let matchedAuctionsFromPage = await filterByCriteriaSets(auctionsFromPage)
        if (matchedAuctionsFromPage.length > 0) {
            await printFlips(matchedAuctionsFromPage);
        }
        let auctions = auctionsFromPage;


        // Handle pages 2-N
        for (let page = 1; page < body.totalPages; page++) {
            process.stdout.write(' ' + page);
            body = (await curl.get('https://api.hypixel.net/skyblock/auctions?page=' + page)).body;
            auctionsFromPage = await transformAndFilterAuctions(body.auctions);
            let matchedAuctionsFromPage = await filterByCriteriaSets(auctionsFromPage)
            if (matchedAuctionsFromPage.length > 0) {
                await printFlips(matchedAuctionsFromPage);
            }
            auctions = auctions.concat(auctionsFromPage);
        }

        // Here we cache all the auctions so the command line variant
        // of "ah" can do queries across the cached options
        cacheAuctions(auctions);
    }
}


async function filterByCriteriaSets(auctions) {
    let matches = [];
    for (let criteria of _.values(loadCriteriaSets())) {
        matches.push(filterByCriteria(auctions, criteria));
    }
    matches = sort(_.flatten(matches));
    return matches;
}


function filterByCriteria(auctions, criteria) {

    // Find the auctions containing the user specified query
    return _.filter(auctions, function(o) {

        // Match the name
        if (!o.name.includes(criteria.query)) {
            return false;
        }

        // Do not match anything the user running this has for sale
        if (o.seller === uuid) {
            return false;
        }

        // Match the tier
        if (criteria.tier && !o.tier.includes(criteria.tier)) {
            return false;
        }

        // // Match the seller
        // if (criteria.seller && !o.seller.includes(criteria.seller)) {
        //     return false;
        // }

        // Match the reforge
        if (criteria.reforge && !o.reforge.includes(criteria.reforge)) {
            return false;
        }

        // Match only enchanted book phrases if -e was provided
        if (criteria.enchantment && !o.name.includes('enchanted book')) {
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


async function transformAndFilterAuctions(auctions) {
    let filteredAuctions = _.filter(auctions, function(auction) {

        // Skip claimed auctions, we only want auctions we can buy
        if (auction.claimed) {
            return false;
        }

        // Skip any auctions that are not of the "Buy It Now" type
        if (!auction.bin) {
            return false;
        }

        return true;
    });

    let modifiedAuctions = [];
    for (let auction of filteredAuctions) {
        let o = await createAuctionObject(auction);
        modifiedAuctions.push(o);
    }

    return modifiedAuctions;
}


function cacheAuctions(auctions) {
    console.log('\nCaching ' + _.keys(auctions).length + ' auctions.');
    fs.rmSync(cacheFile, { force: true });
    fs.writeFileSync(cacheFile, JSON.stringify(auctions, null, 4));
}


function loadCriteriaSets() {
    let criteriaSets = YAML.parse(fs.readFileSync(watchFile, 'utf8'), { prettyErrors: true });
    for (let criteriaKey of _.keys(criteriaSets)) {
        let criteria = criteriaSets[criteriaKey];
        if (!criteria.query) {
            criteria.query = criteriaKey.replaceAll('_', ' ');
        }

        if (!criteria.action) {
            criteria.action = 'flip';
        }
    }

    return criteriaSets;
}


function sort(auctionItems) {
    return _.sortBy(auctionItems, [ 'name', 'cost' ]);
}


function limit(auctions) {
    if (!criteria.limit) {
        return auctions;
    }

    return auctions.slice(0, criteria.limit);
}


async function printFlips(auctions) {
    // let auctionFlips = _.filter(auctions, function(o) { return o.action === 'flip' });
    if (process.env.SKYBLOCK_SLACK) {
        await sendSlackMessage(auctions);
    }
    console.log();
    process.stdout.write(print(auctions));
}


async function sendSlackMessage(auctions) {
    let auctionCopies = [];
    for (let auction of auctions) {
        auctionCopies.push(JSON.parse(JSON.stringify(auction)));
    }

    let now = moment().format('hh:mm:ss');
    let slackMessage = print(sort(auctionCopies));
    await slack('```' + now + '\n' + slackMessage + '```');
}


function print(auctions, max, highlight) {
    auctions = augmentNames(auctions);
    return table(auctions, [
        {
            name: 'cost',
            width: 7,
            format: { mix2: true },
            extra_spaces: 1
        },
        // {
        //     name: 'seller',
        //     width: -20,
        // },
        {
            name: 'name',
            width: -55,
        },
        {
            name: 'enchantments',
            width: -40,
        },
    ], highlight, false);
}


function augmentNames(auctions) {
    // Augment the name field with tier, reforge, and pet level
    _.map(auctions, function(item, key, coll) {
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

    return auctions;
}


// function getField(lore, field) {
//     for (let line of lore.split('\n')) {
//         if (line.startsWith(field)) {
//             return line.substring(field.length + 2);
//         }
//     }
//     return '';
// }


async function parseArguments(args) {

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
        .option('-N, --no-header', 'Do not output a header')

        .addHelpText('after', `

Watch for auctions meeting the criteria defined in watch.yaml (loops):
  $ node ah

Find strong dragon boot auctions:
  $ node ah "strong dragon boots"
  $ node ah "strong dragon boots" -l 50                    # limit output to the 50 cheapest items
  $ node ah "strong dragon boots" -a                       # do not limit the output
  $ node ah "strong dragon boots" -t lege                  # find legendary boots
  $ node ah "strong dragon boots" -t lege -s5              # find 5 star legendary boots
  $ node ah "strong dragon boots" -t lege -s5 -r fierce    # find 5 star legendary fierce boots

Find boots that have protection and growth enchantments
  $ node ah boots -x protection growth

Find pet auctions:
  $ node ah -p "wither skeleton"

Find enchantment books:
  $ node ah -e sharpness
  $ node ah -e one-for-all
  $ node ah "enchantment book" -x protection growth        # A composite enchantment book
`)
        .parse(args);


    let criteria = program.opts();

    if (program.args[0]) {
        criteria.query = program.args[0].toLowerCase();
    }

    // Remove the limit default if the user wants all matches
    if (criteria.all) {
        delete criteria.limit;
    }

    if (criteria.stars) {
        criteria.stars = parseInt(criteria.stars);
    }

    // If -p (pet), append "pet" to the search criteria
    if (criteria.pet && !criteria.query.includes(' pet')) {
        criteria.query = criteria.query + ' pet';
    }

    // If -W (watch) or -R (retrieve) remove all other flags
    if (!criteria.query) {
        delete criteria.book;
        delete criteria.pet;
        delete criteria.reforge;
        delete criteria.tier;
        delete criteria.stars;
        delete criteria.extra;
        delete criteria.limit;
        delete criteria.all;
    }

    // Get the environment variables
    criteria.user = userlib.getUser();
    criteria.uuid = await userlib.getUuid();
    criteria.profile = userlib.getProfile();
    criteria.key = userlib.getKey();

    p4(criteria);

    return criteria;
}
