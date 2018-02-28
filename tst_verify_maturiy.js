#!/usr/local/bin/node

const puppeteer = require('puppeteer');

// parse args
const args = require('minimist')(process.argv.slice(2));
if (!('env' in args)) {
  console.log('There is no env. Please use "node verify_maturity.js --env example.com"');
  process.exit();
}
// close args

// utils
function getParameterByName(name, url) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}
// close utils

// set standards
std_dl = {
  'user': false
};
has_gtm = false;
has_ga = false;
gtm_position = undefined;
// close standards

(async () => {
  // open browser
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // activate the sniffer
  page.on('response', response => {
      const req = response.request();

      // get gtm
      // need to be improved to handle two or more GTMs
      if (req.url.indexOf('gtm.js') > -1) {
           gtm_id = getParameterByName('id', req.url);
           gtm_datalayer = getParameterByName('l', req.url);
           has_gtm = true;
      }

      // get GA
      // need to be improved to handle two or more UAs
      if (req.url.indexOf('/collect') > -1) {
           ga_ht_type = getParameterByName('t', req.url);
           if (ga_ht_type == 'pageview') {
             ga_ua = getParameterByName('tid', req.url);
             has_ga = true;
           }
      }
  });

  // go to env
  await page.goto(args.env);

  // get datalayer
  pg_datalayer = await page.evaluate((gtm_datalayer) => window[gtm_datalayer], (gtm_datalayer));

  pg_html = await page.content();

  // rule to decide gtm position
  if (has_gtm) {
      if (pg_html.indexOf('gtm.js?') < pg_html.indexOf('</head')) gtm_position='head';
      if (pg_html.indexOf('gtm.js?') > pg_html.indexOf('<body')) {
          to_s = Math.abs(pg_html.indexOf('<body') - pg_html.indexOf('gtm.js?'));
          to_e = pg_html.indexOf('</body') - pg_html.indexOf('gtm.js?');
          if (to_e > to_s) {
              gtm_position = 'body bottom';
          } else {
              gtm_position = 'body init';
          }
      }
  }

  // verify datalayer
  for (var key in std_dl) {
      for (var i = 0; i < pg_datalayer.length; i++) {
        if (pg_datalayer[i].hasOwnProperty(key)) {
            std_dl[key] = true;
        };
      }
  }

  // test output
  console.log('Does GTM exist? ' + has_gtm);
  console.log('Does GA exist? ' + has_ga);
  if (has_gtm) console.log('GTM: '+gtm_id+' DataLayer Name: '+gtm_datalayer+' DataLayer Position: '+gtm_position);
  if (has_ga) console.log('GA: '+ga_ua);
  console.log('DataLayer Keys: ');
  console.log(std_dl);
  // close output

  // close browser
  await browser.close();
})();
