var d = require('debug')('skyblock');

var _ = require('lodash');
var _s = require('underscore.string');
var plural = require('pluralize').plural;


// Assumes the incoming name is lower snake cased
function casey(name) {

    if (name) {
        name = name.trim();
    }

    if (!name) {
        return {
            snakeCased: '',
            dashCased: '',
            camelCased: '',
            capitalized: '',
            capitalizedWithSpaces: '',
            capitalizedWithUnderscores: '',
            upperSnakeCased: '',
            upperCasedWithSpaces: '',

            snakeCasedPlural: '',
            dashCasedPlural: '',
            camelCasedPlural: '',
            capitalizedPlural: '',
            capitalizedWithSpacesPlural: '',
            upperSnakeCasedPlural: '',
            upperCasedWithSpacesPlural: '',

            dashCasedId: '',
            dashCasedName: '',
            dashCasedVersion: '',
            camelCasedName: '',
            camelCasedVersion: '',

            dashCasedCurlied: '',
            camelCasedCurlied: '',
            dashCasedIdOrNameCurlied: '',
            camelCasedIdOrNameCurlied: '',
            dashCasedIdCurlied: '',
            dashCasedNameCurlied: '',
            dashCasedVersionCurlied: '',
            camelCasedNameCurlied: '',
            camelCasedVersionCurlied: '',
        };
    }

    let pluralName = plural(name);

    return {
        snakeCased: name,
        dashCased: _s.dasherize(name),
        camelCased: acronym(_s.camelize(name), 0),
        capitalized: acronym(_s.classify(name)),
        capitalizedWithSpaces: acronym(_.startCase(name)),
        capitalizedWithUnderscores: acronym(_.startCase(name)).replaceAll(' ', '_'),
        upperSnakeCased: _.toUpper(name),
        upperCasedWithSpaces: _.upperCase(name),

        snakeCasedPlural: pluralName,
        dashCasedPlural: _s.dasherize(pluralName),
        camelCasedPlural: acronym(_s.camelize(pluralName), 0),
        capitalizedPlural: acronym(_s.classify(pluralName)),
        capitalizedWithSpacesPlural: acronym(_.startCase(pluralName)),
        upperSnakeCasedPlural: _.toUpper(pluralName),
        upperCasedWithSpacesPlural: _.upperCase(pluralName),

        dashCasedId: _s.dasherize(name) + '-id',
        dashCasedName: _s.dasherize(name) + '-name',
        dashCasedVersion: _s.dasherize(name) + '-version',

        camelCasedId: acronym(_s.camelize(name), 0) + 'Id',
        camelCasedName: acronym(_s.camelize(name), 0) + 'Name',
        camelCasedVersion: acronym(_s.camelize(name), 0) + 'Version',

        dashCasedCurlied: '{' + _s.dasherize(name) + '}',
        camelCasedCurlied: '{' + acronym(_s.camelize(name)) + '}',

        dashCasedIdOrNameCurlied: '{' + _s.dasherize(name) + '-id-or-name' + '}',
        camelCasedIdOrNameCurlied: '{' + acronym(_s.camelize(name)) + 'IdOrName' + '}',

        dashCasedIdCurlied: '{' + _s.dasherize(name) + '-id' + '}',
        dashCasedNameCurlied: '{' + _s.dasherize(name) + '-name' + '}',
        dashCasedVersionCurlied: '{' + _s.dasherize(name) + '-version' + '}',

        camelCasedIdCurlied: '{' + acronym(_s.camelize(name), 0) + 'Id' + '}',
        camelCasedNameCurlied: '{' + acronym(_s.camelize(name), 0) + 'Name' + '}',
        camelCasedVersionCurlied: '{' + acronym(_s.camelize(name), 0) + 'Version' + '}',
    };
}


function acronym(name, start) {
    if (start === undefined) {
        start = -1;
    }

    if (name.indexOf('api') > start) {
        return name.replace('api', 'API');
    }
    if (name.indexOf('snmp') > start) {
        return name.replace('snmp', 'SNMP');
    }
    if (name.indexOf('tls') > start) {
        return name.replace('tls', 'TLS');
    }
    if (name.indexOf('Api') > start) {
        return name.replace('Api', 'API');
    }

    return name;
}


module.exports = casey;
