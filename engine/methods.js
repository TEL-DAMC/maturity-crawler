#!/usr/local/bin/node

/* LIBS */
const puppeteer = require('puppeteer');

/* VARS */
var prop = {};

/* METHODS */
methods = {}

// check arguments (useless?)
methods.check_args = function(p_args, t_chk) {
    var args = require('minimist')(p_args);
    if (!(t_chk in args)) {
      console.log('There is no env. Please use "node run.js --env example.com"');
      process.exit();
    }
}

// get parameter name
methods.get_param_name = function(name, url) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// fetch pages
methods.get_lps = function(lps, sc){
    for (var i in lps) {
        prop[lps[i].endpoint] = {
            endpoint: lps[i].endpoint,
            gtms: [],
            gtms_ok: false,
            uas: [],
            uas_ok: false,
            data_layers: [],
            data_layers_ok: false,
            keys_log: [],
            gtm_position: '-'
        };
        this.fetch(lps[i], sc).then(function(){
            console.log(JSON.stringify(prop));
        }).catch(function(e){
            console.log(e);
        });
    }
}

methods.fetch = async function(lp, sc) {
    // open browser
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // activate the sniffer
    page.on('response', response => {
        req = response.request();

        if (req.hasOwnProperty('url')) {
            // to see all network requests
            // console.log(req.url);

            // get gtm
            if (req.url.indexOf('gtm.js') > -1) {
                this.check_gtm(req.url, lp);
            }

            // get GA
            if (req.url.indexOf('/collect') > -1) {
                if (this.get_param_name('t', req.url) == 'pageview') {
                    this.check_ua(req.url, lp);
                }
            }
        }
    });

    // handling error
    page.on('error', msg => { browser.close(); });
    page.on('pageerror', msg => { browser.close(); });

    // go to env
    const rsp = await page.goto(lp.endpoint, {waitUntil: 'networkidle0'});

    // html content analysis
    pg_html = await page.content();
    this.check_gtm_position(lp, pg_html);

    // check DataLayer
    pg_data_layer = await page.evaluate((gtm_dl) => window[gtm_dl], (prop[lp.endpoint].data_layers[0]));
    this.check_keys(lp, JSON.stringify(pg_data_layer));

    await browser.close();

    this.gtms_ok(lp);
    this.uas_ok(lp);
    this.data_layers_ok(lp);

    this.write_sheet(lp, sc);
}

methods.check_gtm = function(url, lp) {
    prop[lp.endpoint].gtms.push(this.get_param_name('id', url));
    prop[lp.endpoint].data_layers.push(this.get_param_name('l', url));
}

methods.check_ua = function(url, lp) {
    prop[lp.endpoint].uas.push(this.get_param_name('tid', url));
}

methods.check_gtm_position = function(lp, pg_html) {
    pg_gtm = pg_html.indexOf('gtm.js?');

    if (pg_gtm > -1) {
        if (pg_gtm < pg_html.indexOf('</head')) prop[lp.endpoint].gtm_position = 'header';
        if (pg_gtm > pg_html.indexOf('<body')) {
            to_s = Math.abs(pg_html.indexOf('<body') - pg_gtm);
            to_e = pg_html.indexOf('</body') - pg_gtm;
            if (to_e > to_s) {
                prop[lp.endpoint].gtm_position = 'body bottom';
            } else {
                prop[lp.endpoint].gtm_position = 'body init';
            }
        }
    }
}

methods.gtms_ok = function(lp) {
    // check gtms
    if (lp.gtms.sort().join(',') == prop[lp.endpoint].gtms.sort().join(',')) {
        prop[lp.endpoint].gtms_ok = true;
    } else {
        prop[lp.endpoint].gtms_ok = false;
    }
}

methods.uas_ok = function(lp) {
    // check uas
    if (lp.uas.sort().join(',') == prop[lp.endpoint].uas.sort().join(',')) {
        prop[lp.endpoint].uas_ok = true;
    } else {
        prop[lp.endpoint].uas_ok = false;
    }
}

methods.data_layers_ok = function(lp) {
    // check data_layers
    if (lp.data_layers.sort().join(',') == prop[lp.endpoint].data_layers.sort().join(',')) {
        prop[lp.endpoint].data_layers_ok = true;
    } else {
        prop[lp.endpoint].data_layers_ok = false;
    }
}

methods.check_keys = function(lp, json) {
    for (k of lp.keys) {
        if (json.indexOf(k) < 0) {
            prop[lp.endpoint].keys_log.push(k);
        }
    }
}

methods.write_sheet = function(lp, sc) {
  sc.sheets.spreadsheets.values.append({
      auth: sc.auth,
      spreadsheetId: sc.spreadsheet_id,
      range: 'maturity!G' + lp.row.toString() + ':M'+ lp.row.toString(),
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [ [
              prop[lp.endpoint].gtms.join(','), // G
              prop[lp.endpoint].gtm_position, // H
              prop[lp.endpoint].gtms_ok, // I
              prop[lp.endpoint].uas.join(','), // J
              prop[lp.endpoint].uas_ok, // K
              prop[lp.endpoint].data_layers.join(','), // L
              prop[lp.endpoint].keys_log.join(',') // M
              ] ]
      }
    }, (err, response) => {
      if (err) {
        console.log('The API returned an error inserting value of ' + lp.endpoint + ':'+ err);
        return;
      } else {
          console.log('Success: ' + lp.endpoint);
      }
  });
}

// export methods
module.exports = methods;
