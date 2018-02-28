#!/usr/local/bin/node

var gapi = require('googleapis');
var privatekey = require('./key.json');
var mtd = require('./engine/methods.js');

// Google Sheets Configs

var sheets_config = {
    spreadsheet_id: '1gqiL4o8bWz1NloxgRQ7bQfZB-N4DtvrpvK2vgijZZzk',
    sheets: gapi.google.sheets('v4'),
    auth: undefined
}

var lps = {};

// configure a JWT auth client
jwt = new gapi.google.auth.JWT(
    privatekey.client_email,
    null,
    privatekey.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
);

// authenticate request
jwt.authorize(function (err, tokens) {
    if (err) {
        console.log('The API returned an error in authentication: ' + err);
        return;
    } else {
        console.log('Successfully connected in spreadsheets!');
    }
});
sheets_config.auth = jwt;


// reading landings
sheets_config.sheets.spreadsheets.values.get({
    auth: sheets_config.auth,
    spreadsheetId: sheets_config.spreadsheet_id,
    range: 'maturity!B2:F'
}, function (err, response) {
   if (err) {
       console.log('The API returned an error retrieving infos: ' + err);
   } else {
       console.log('List URLs:');
       for (var i in response.data.values) {
            console.log(response.data.values[i][0]);
            lps[response.data.values[i][0]] = {
                row: parseInt(i)+1,
                endpoint: response.data.values[i][0],
                gtms: response.data.values[i][1].split(','),
                uas: response.data.values[i][2].split(','),
                data_layer: response.data.values[i][3],
                keys: response.data.values[i][4].split(',')
            };
       }

       burn(lps, sheets_config);
   }
});

var burn = function (landings, sc) {
    mtd.get_lps(landings, sc);
}
