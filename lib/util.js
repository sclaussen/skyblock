'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const moment = require('moment');
const colors = require('colors');

const casey = require('./casey');
const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);
const e = require('./pr').e(d);


function format(n, options) {

    if (n && options.shorten) {
        if (n.length > options.shorten) {
            n = n.substring(0, options.shorten) + options.shorten_append;
        }
        return n;
    }

    if (options.hide_zero && n === 0) {
        return '';
    }

    if (options.percent) {
        return Number.parseFloat(n * 100).toFixed(0);
    }

    if (options.decimal) {
        return Number.parseFloat(n).toFixed(1);
    }

    if (options.integer) {
        return Number(Number.parseFloat(n).toFixed(0)).toLocaleString();
    }

    if (options.thousands) {
        n = (n / 1000).toFixed(1);
        let s = Number.parseFloat(n).toFixed(1) + 'K';
        // if (s === '1,000K') {
        //     return '1M';
        // }
        return s;
    }

    if (options.millions) {
        n = (n / 1000000).toFixed(1);
        return Number.parseFloat(n).toFixed(1) + 'M';
    }

    if (options.mix) {

        // < 1,000
        if (n < 1000) {
            return Number(Number.parseFloat(n).toFixed(0)).toLocaleString();
        }

        // < 1M
        if (n < 1000000) {
            let s = Number(Number.parseFloat(n / 1000).toFixed(0)).toLocaleString() + 'K';
            if (s === '1,000K') {
                return '1M';
            }
            return s;
        }

        // < 20M
        if (n < 20000000) {
            return Number(Number.parseFloat(n / 1000000).toFixed(1)).toLocaleString() + 'M';
        }

        // > 20M
        return Number(Number.parseFloat(n / 1000000).toFixed(0)).toLocaleString() + 'M';
    }

    console.log('ERROR: Unknown format option: ' + JSON.stringify(options));
    process.exit(1);
}

function table(items, stanzas, max) {

    let limit = false;
    if (max) {
        max = parseInt(max);
        limit =  true;
    }

    let output = '';

    // Print out the header for each field
    console.log();
    for (let stanza of stanzas) {

        let stanzaName = stanza.name;
        if (stanza.alias) {
            stanzaName = stanza.alias;
        }

        // Negative width means left justify
        if (stanza.width < 0) {
            output += lj(stanzaName, 0 - stanza.width) + ' ';
            continue;
        }

        // Positive width means right justify
        output += rj(stanzaName, stanza.width) + ' ';

        if (stanza.extra_spaces) {
            output += rj(' ', stanza.extra_spaces);
        }
    }
    console.log(output);


    // For each item, print each stanza according to the stanza metadata
    let count = 1;
    for (let item of items) {

        output = '';
        for (let stanza of stanzas) {

            let value = item[stanza.name];
            if (stanza.format) {
                value = format(value, stanza.format);
            }

            if (stanza.number) {
                value = number(value);
            }
            let width = stanza.width;

            if (stanza.number) {
                value = number(value, stanza.number);
            }


            if (width < 0) {
                // Negative width means left justify
                output += highlight(stanza, lj(value, 0 - width)) + ' ';
            } else {
                // Positive width means right justify
                output += highlight(stanza, rj(value, width))+ ' ';
            }

            if (stanza.extra_spaces) {
                output += rj(' ', stanza.extra_spaces);
            }
        }

        console.log(output);

        if (limit) {
            count++;
            if (count > max) {
                return;
            }
        }
    }
}

function sleep(n) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n * 1000);
}

// Right justify
function rj(s, n) {
    if (!s) {
        s = ' ';
    }
    return s.toString().padStart(n, ' ');
}

// Left justify
function lj(s, n) {
    if (!s) {
        s = ' ';
    }
    return s.toString().padEnd(n, ' ');
}

function round(n) {
    return Math.round(n / 100) * 100;
}

function getCategory(category) {
    let categoryAlias = {
        weapon: '1-weap',
        armor: '2-armo',
        accessories: '3-acce',
        misc: '4-misc',
        blocks: '5-bloc',
        consumables: '6-cons',
    };
    category = categoryAlias[category];
    if (!category) {
        console.log('Unknown category: ' + category);
    }
    return category;
}

function getTier(tier) {
    let tierAlias = {
        common: '1-comm',
        uncommon: '2-unco',
        rare: '3-rare',
        epic: '4-epic',
        legendary: '5-lege',
        mythic: '6-myth',
        supreme: '7-supr',
        special: '8-spec',
        very_special: '9-vspe'
    };
    tier = tierAlias[tier];
    if (!tier) {
        console.log('ERROR: Unknown tier: ' + tier);
        process.exit(1);
    }
    return tier;
}

function highlight(stanza, value) {

    if (stanza.highlight_green_above && parseInt(value) >= stanza.highlight_green_above) {
        return value.toString().brightYellow;
    }

    if (stanza.highlight_green_below && parseInt(value) <= stanza.highlight_green_below) {
        return value.toString().brightYellow;
    }

    if (stanza.highlight_red_above && parseInt(value) >= stanza.highlight_red_above) {
        return value.toString().red;
    }

    if (stanza.highlight_red_below && parseInt(value) <= stanza.highlight_red_below) {
        return value.toString().red;
    }

    return value.toString().white;
}


function getTrackerUrl(itemName) {
    let url = {
        enchanted_endstone: 'enchanted_end_stone'
    };

    let baseUrl = itemName.toLowerCase();
    if (url[baseUrl]) {
        baseUrl = url[baseUrl];
    }

    return 'https://bazaartracker.com/product/' + baseUrl;
}

function getFandomUrl(itemName) {
    let url = {
        Enchanted_Slime_Ball: 'Enchanted_Slimeball',
        Pork: 'Raw_Porkchop',
        Hay_Block: 'Hay_Bale',
    };

    let capitalizedWithSpaces = casey(itemName.toLowerCase()).capitalizedWithSpaces;
    let baseUrl = casey(capitalizedWithSpaces).capitalizedWithUnderscores;
    if (url[baseUrl]) {
        baseUrl = url[baseUrl];
    }

    return 'https://hypixel-skyblock.fandom.com/wiki/' + baseUrl + '#Obtaining';
}

function number(n, options) {
    if (!options) {
        options = {};
    }

    let s = '';
    if (n === 0) {
        return s;
    }

    if (options.thousands) {
        s = 'K';
        n = (n / 1000).toFixed(0);
    } else {

        if (n < 100000) {
            // s = 'K';
            // n = (n / 1000).toFixed(1);
            n = (n * 1).toFixed(0);
        } else if (n < 1000000) {
            s = 'K';
            n = (n / 1000).toFixed(0);
        } else {
            s = 'M';
            n = (n / 1000000).toFixed(1);
        }
    }

    return (n.toLocaleString("en-US") + s);
}

function timeFromNow(n) {
    let datetime = moment(n);
    return datetime.fromNow();
}

module.exports.sleep = sleep;
module.exports.rj = rj;
module.exports.lj = lj;
module.exports.getTrackerUrl = getTrackerUrl;
module.exports.getFandomUrl = getFandomUrl;
module.exports.number = number;
module.exports.timeFromNow = timeFromNow;
module.exports.table = table;
module.exports.round = round;
module.exports.getTier = getTier;
module.exports.getCategory = getCategory;
module.exports.format = format;
