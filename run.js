const GoogleAPIs = require('googleapis')
const PrivateKey = require('./key.json')
const GlobalMethods = require('./engine/methods.js')
const GoogleSheets = require('./engine/google-sheets')

// Google Sheets Configs
const GoogleSheetsConfig = {
  spreadsheetId: '1gqiL4o8bWz1NloxgRQ7bQfZB-N4DtvrpvK2vgijZZzk',
  sheets: GoogleAPIs.google.sheets('v4')
}

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

;(async (gsc) => {
  // clear
  await GoogleSheets.clearRange('maturity!H2:N', gsc)
  const landingPagesConfigInfo = await GoogleSheets.readLandingPagesConfigInfo(gsc)
  await GlobalMethods.asyncCheckLandingPages(landingPagesConfigInfo, gsc)
})(GoogleSheetsConfig)
