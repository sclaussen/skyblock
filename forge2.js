'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const _ = require('lodash');

const YAML = require('yaml');
var program = require('commander');

const table = require('./lib/util').table;
const getBazaarItems = require('./lib/bzlib').getBazaarItems;

const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);



forge2(process.argv);



async function forge2(args) {
    options = parse(args);


    stanzas = YAML.parse(fs.readFileSync('./dat/forge.yaml', 'utf8'), { prettyErrors: true });


    let forgeItems = [];
    for (let stanzaName of _.keys(stanzas)) {
        if (options.query && !stanzaName.includes(options.query)) {
            continue;
        }

        let forgeItem = getForgeItem(stanzaName);
        forgeItems.push(forgeItem);
        // y4(forgeItems);
    }
}



function getForgeItem(stanzaName) {
    let stanza = stanzas[stanzaName];
    let alias = stanza.alias || stanza.name;

    let forgeItem = {
        name: stanzaName,
        alias: alias,
        source: 'forge',
        order: stanza.order,
        duration: money(stanza.duration),
        count: 1,
        breaking_power: stanza.breaking_power,
        speed: stanza.speed,
        fortune: stanza.fortune,
        materials: [],
        forges: [],
    };
    forgeItem.forges = updateForges(forgeItem.forges, stanzaName, alias, 1, stanza.order);

    for (let material of _.keys(stanza.materials)) {

        let count = stanza.materials[material];
        let source;
        let cost;


        let materialAcquisitionSource = await getMaterialAcquisitionSource(material);
        switch (materialAcquisitionSource) {

        case 'purse':
            source = 'purse';
            cost = count;
            break;

        case 'bazaar':
            source = 'bazaar';
            cost = await getBazaarItemCost(material);
            break;

        case 'auction':
            source = 'auction';
            cost = await getAuctionPrice(material);
            break;

        case 'forge':
            source = 'forge';
            let forgedMaterial = await getForgeItem(material);
            cost = forgedMaterial.cost;
            let materialStanza = stanzas[material];
            material = materialStanza.alias || materialStanza.name;

            forgeItem.duration += forgedMaterial.duration;

            for (let descendentMaterial of forgedMaterial.materials) {
                forgeItem.materials = updateMaterials(forgeItem.materials, descendentMaterial.alias, descendentMaterial.source, descendentMaterial.count * count, descendentMaterial.cost);
            }

            for (let descendentForge of forgedMaterial.forges) {
                forgeItem.forges = updateForges(forgeItem.forges, descendentForge.name, descendentForge.alias, descendentForge.count * count, descendentForge.order);
            }

            break;
        }

        forgeItem.cost += money(cost * count);

        if (source !== 'forge') {
            forgeItem.materials = updateMaterials(forgeItem.materials, material, source, count, cost);
        }
    }

    forgeItem.forges = _.sortBy(forgeItem.forges, [ 'order' ]);
    // y4(forgeItem);
    return forgeItem;
}


function parse(args) {
    program
        .option('-m, --materials', 'Show the required raw materials')
        .addHelpText('after', `
examples here
`)
        .parse(args);

    let options = program.opts();

    if (program.args[0]) {
        options.query = program.args[0].toLowerCase();
    }

    // p4(options);

    return options;
}
