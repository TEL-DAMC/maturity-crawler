const GoogleSheets = {
  clearRange (range, GoogleSheetsConfig) {
    return new Promise((resolve, reject) => {
      GoogleSheetsConfig.sheets.spreadsheets.values.clear({
        auth: GoogleSheetsConfig.auth,
        spreadsheetId: GoogleSheetsConfig.spreadsheetId,
        range: range
      }, function (err, response) {
        if (err) {
          console.log('The API returned an error cleaning cells: ' + err)
          reject(err)
        } else {
          console.log('Cells cleaned')
          resolve(response)
        }
      })
    })
  },
  readLandingPagesConfigInfo (GoogleSheetsConfig) {
    return new Promise((resolve, reject) => {
      GoogleSheetsConfig.sheets.spreadsheets.values.get({
        auth: GoogleSheetsConfig.auth,
        spreadsheetId: GoogleSheetsConfig.spreadsheetId,
        range: 'maturity!B2:G'
      }, function (err, response) {
        if (err) {
          console.log('The API returned an error retrieving infos: ' + err)
          reject(err)
        } else {
          const lps = response.data.values.map((row, i) => ({
            row: parseInt(i) + 2,
            endpoint: row[0],
            gtms: row[1].split(','),
            uas: row[2].split(','),
            data_layers: row[3].split(','),
            keys: row[4] ? row[4].split(',') : [],
            cookies: row[5] ? row[5].split(';') : []
          }))
          console.log('List URLs:')
          lps.forEach(lp => console.log(lp.endpoint))
          resolve(lps)
        }
      })
    })
  }
}

module.exports = GoogleSheets
