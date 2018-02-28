gapi = require('googleapis');
privatekey = require('./key.json');

// configure a JWT auth client
jwt = new gapi.google.auth.JWT(
       privatekey.client_email,
       null,
       privatekey.private_key,
       ['https://www.googleapis.com/auth/spreadsheets']);
//authenticate request
jwt.authorize(function (err, tokens) {
 if (err) {
   console.log(err);
   return;
 } else {
   console.log("Successfully connected!");
 }
});

//Google Sheets API
spreadsheetId = '1gqiL4o8bWz1NloxgRQ7bQfZB-N4DtvrpvK2vgijZZzk';
sheetName = 'maturity!A2:B'
sheets = gapi.google.sheets('v4');

// READ
sheets.spreadsheets.values.get({
   auth: jwt,
   spreadsheetId: spreadsheetId,
   range: sheetName
}, function (err, response) {
   if (err) {
       console.log('The API returned an error: ' + err);
   } else {
       console.log('List URLs:');
       console.log(response.data.values);
   }
});

// WRITE
sheets.spreadsheets.values.append({
    auth: jwt,
    spreadsheetId: spreadsheetId,
    range: 'maturity!C2:D',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [ ['Void', 'Canvas'], ['Paul', 'Shan'] ]
    }
  }, (err, response) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    } else {
        console.log("Appended");
    }
});

console.log('IT WORKS MDF!!!');
