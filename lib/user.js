'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const _ = require('lodash');

const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);
const y4 = require('./pr').y4(d);

const curl = require('./curl');



function getUser() {
    if (!process.env.SKYBLOCK_USER) {
        console.log('The SKYBLOCK_USER environment variable must be set.');
        process.exit(1);
    }

    return process.env.SKYBLOCK_USER;
}


function getProfile() {
    if (!process.env.SKYBLOCK_PROFILE) {
        console.log('The SKYBLOCK_PROFILE environment variable must be set.');
        process.exit(1);
    }

    return process.env.SKYBLOCK_PROFILE;
}


function getKey() {
    if (!process.env.SKYBLOCK_KEY) {
        console.log('The SKYBLOCK_KEY environment variable must be set.');
        process.exit(1);
    }

    return process.env.SKYBLOCK_KEY;
}


async function getUuid() {
    if (!process.env.SKYBLOCK_UUID) {
        console.log('The SKYBLOCK_UUID environment variable must be set.');
        process.exit(1);
    }

    return process.env.SKYBLOCK_UUID;

    // return await userToUuid(getUser());
}


async function userToUuid(user) {
    let body = (await curl.get('https://api.mojang.com/user/profiles/minecraft/' + user)).body;
    p4(body);
    return body.id;
}


async function uuidToUser(uuid) {
    let body = (await curl.get('https://api.mojang.com/user/profiles/' + uuid + '/names')).body;
    if (!body[body.length - 1]) {
        console.log('WARNING: Missing body for uuid: ' + uuid);
        y4(body);
        return '';
    }
    return body[body.length - 1].name.toLowerCase();
}


module.exports.getUser = getUser;
module.exports.getProfile = getProfile;
module.exports.getUuid = getUuid;
module.exports.getKey = getKey;

module.exports.uuidToUser = uuidToUser;
module.exports.userToUuid = userToUuid;
