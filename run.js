const GoogleAPIs = require('googleapis')
const PrivateKey = require('./key.json')
const GlobalMethods = require('./engine/methods.js')

// Google Sheets Configs
const GoogleSheetsConfig = {
  spreadsheetId: '1gqiL4o8bWz1NloxgRQ7bQfZB-N4DtvrpvK2vgijZZzk',
  sheets: GoogleAPIs.google.sheets('v4'),
  auth: undefined
}

const lps = []

// configure a JWT auth client
const JwtClient = new GoogleAPIs.google.auth.JWT(
  PrivateKey.client_email,
  null,
  PrivateKey.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
)

// authenticate request
JwtClient.authorize(function (err) {
  if (err) {
    console.log('The API returned an error in authentication: ' + err)
  } else {
    console.log('Successfully connected in spreadsheets!')
  }
})
GoogleSheetsConfig.auth = JwtClient

// clear
GoogleSheetsConfig.sheets.spreadsheets.values.clear({
  auth: GoogleSheetsConfig.auth,
  spreadsheetId: GoogleSheetsConfig.spreadsheetId,
  range: 'maturity!G2:M'
}, function (err, response) {
  if (err) {
    console.log('The API returned an error cleaning cells: ' + err)
  } else {
    console.log('Cells cleaned')
  }
})

// reading landings
GoogleSheetsConfig.sheets.spreadsheets.values.get({
  auth: GoogleSheetsConfig.auth,
  spreadsheetId: GoogleSheetsConfig.spreadsheetId,
  range: 'maturity!B2:F'
}, function (err, response) {
  if (err) {
    console.log('The API returned an error retrieving infos: ' + err)
  } else {
    console.log('List URLs:')
    for (let i in response.data.values) {
      if (response.data.values.hasOwnProperty(i)) {
        console.log(response.data.values[i][0])
        lps.push({
          row: parseInt(i) + 2,
          endpoint: response.data.values[i][0],
          gtms: response.data.values[i][1].split(','),
          uas: response.data.values[i][2].split(','),
          data_layers: response.data.values[i][3].split(','),
          keys: response.data.values[i][4].split(',')
        })
      }
    }

    GlobalMethods.checkLandingPages(lps, GoogleSheetsConfig)
  }
})
