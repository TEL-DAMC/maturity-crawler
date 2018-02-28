#!/usr/local/bin/node

/* LIBS */
const puppeteer = require('puppeteer');

/* KEYS TO CHECK */
var dl_keys = {
  'user': false
};

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
                this.check_gtm(req.url, lp, sc);
            }

            // get GA
            if (req.url.indexOf('/collect') > -1) {
                if (this.get_param_name('t', req.url) == 'pageview') {
                    this.check_ua(req.url, lp, sc);
                }
            }
        }
    });

    // handling error
    page.on('error', msg => { browser.close(); });
    page.on('pageerror', msg => { browser.close(); });

    // go to env
    const rsp = await page.goto(lp.endpoint, {waitUntil: 'networkidle0'});
    await browser.close();
}

methods.check_gtm = function(url, lp, sc) {
    // should improve
    //prop[page].GTM.push({
    //    'id': this.get_param_name('id', url),
    //    'datalayer': this.get_param_name('l', url)
    //});
}

methods.check_ua = function(url, lp, sc) {
    // should improve
    //prop[page].GA.push(this.get_param_name('tid', url));
}

// export methods
module.exports = methods;
