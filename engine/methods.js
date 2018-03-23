/* LIBS */
const puppeteer = require('puppeteer')
const URLLib = require('url').URL
const pMap = require('p-map')

/* VARS */
const pageTestResults = {}

/* METHODS */
const methods = {}

let globalBrowserInstance

function prepareResultsObject (landingPages) {
  for (let i in landingPages) {
    if (landingPages.hasOwnProperty(i)) {
      pageTestResults[landingPages[i].endpoint] = {
        endpoint: landingPages[i].endpoint,
        gtms: [], // GTM IDs
        gtms_ok: false,
        uas: [], // UA Tracking IDs
        uas_ok: false,
        data_layers: [], // GTM dataLayer object names
        data_layers_ok: false,
        keys_log: [],
        gtm_position: '-'
      }
    }
  }
}

// asyncFetchAndCheck pages
methods.asyncCheckLandingPages = async function (landingPages, googleSheetsConfig) {
  globalBrowserInstance = await puppeteer.launch({headless: false})

  prepareResultsObject(landingPages)

  const mapper = lp => methods.asyncFetchAndCheck(lp, googleSheetsConfig, globalBrowserInstance)
    .catch(e => console.warn('asyncFetchAndCheck error:', lp, e))
  await pMap(landingPages, mapper, {concurrency: 5})

  globalBrowserInstance.close()
}

methods.asyncFetchAndCheck = async function (lp, spreadsheet, globalBrowserInstance) {
  // open browser
  const chromeBrowserInstance = globalBrowserInstance

  if (!lp || !lp.endpoint) return
  const chomeTab = await chromeBrowserInstance.newPage()

  if (lp.cookies.length) {
    console.log('hey,', lp.endpoint, '! we have cookies for you!')
    await chomeTab.goto(lp.endpoint, {waitUntil: 'networkidle2'})

    console.log('hey,', lp.endpoint, '! let us set some cookies!')
    lp.cookies.forEach(async cookieString => {
      if (!cookieString) return
      let cookieArray = cookieString.split('=')
      console.log(cookieArray)
      await chomeTab.setCookie({
        name: cookieArray[0],
        value: cookieArray[1],
        path: '/',
        domain: (new URLLib(lp.endpoint)).hostname
      })
    })
  }

  // activate the sniffer
  chomeTab.on('response', response => {
    let url = response.url()

    if (url) {
      // to see all network requests
      // console.log(req.url);
      // get gtm
      if (url.indexOf('gtm.js') > -1) {
        let gtmInfo = this.getGtmInfoFromUrl(url)

        pageTestResults[lp.endpoint].gtms.push(gtmInfo.gtmId)
        pageTestResults[lp.endpoint].data_layers.push(gtmInfo.dataLayerObjectName)
      } else if (url.indexOf('/collect') > -1 && this.getUrlParamValueFromName(url, 't') === 'pageview') {
        pageTestResults[lp.endpoint].uas.push(this.getGoogleAnalyticsTrackingId(url))
      }
    }
  })

  // handling error
  chomeTab.on('error', msg => {
    console.warn('browser error', lp.endpoint, msg)
  })

  chomeTab.on('pageerror', msg => {
    console.warn('page js error', lp.endpoint, msg)
  })

  console.log('going to endpoint:', lp.endpoint)
  await chomeTab.goto(lp.endpoint, {waitUntil: 'networkidle0'}).catch(e => {
    console.error('error on ', lp.endpoint, ':', e.message)
  })
  console.log('passou')

  // html content analysis
  const PageHTML = await chomeTab.content()
  console.log('html length:', PageHTML.length)

  pageTestResults[lp.endpoint].gtm_position = methods.checkGtmPositionStatus(PageHTML)

  const PageDataLayer = await methods.asyncGetDataLayerObject(chomeTab, pageTestResults[lp.endpoint].data_layers[0])

  pageTestResults[lp.endpoint].keys_log.concat(methods.filterDataLayerObjectKeysFound(lp, JSON.stringify(PageDataLayer)))
  pageTestResults[lp.endpoint].checkGtmIds = methods.checkGtmIds(lp)
  pageTestResults[lp.endpoint].uas_ok = methods.checkGoogleAnalyticsTackingIds(lp)
  pageTestResults[lp.endpoint].checkDataLayerIds = methods.checkDataLayerIds(lp)

  await chomeTab.close()

  methods.asyncWriteSpreadsheet(lp, spreadsheet)
}

// get parameter name
methods.getUrlParamValueFromName = function (url, name) {
  name = name.replace(/[[\]]/g, '\\$&')
  let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  let results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

methods.asyncGetDataLayerObject = async function (chromeTab, dataLayerName) {
  return chromeTab.evaluate((GtmDataLayerName) => {
    return window[GtmDataLayerName]
  }, dataLayerName)
}

/**
 * Returns GTM's dataLayer name and id from its url
 * @param gtmUrl GTM js URL
 * @returns {{dataLayerObjectName: string, gtmId: string}}
 */
methods.getGtmInfoFromUrl = function (gtmUrl) {
  return {
    dataLayerObjectName: methods.getUrlParamValueFromName(gtmUrl, 'l'),
    gtmId: methods.getUrlParamValueFromName(gtmUrl, 'id')
  }
}

/**
 * Returns Google Analytics Tracking ID from the url
 * @param ganalyticsUrl
 * @returns {string} Tracking Id
 */
methods.getGoogleAnalyticsTrackingId = function (ganalyticsUrl) {
  return this.getUrlParamValueFromName(ganalyticsUrl, 'tid')
}

methods.checkGtmPositionStatus = function (pageHtml) {
  let gtmPositionStatus

  const gtmPositionIndexOnPage = pageHtml.indexOf('gtm.js?') // TODO: Check more than one GTM on the same page

  if (gtmPositionIndexOnPage === -1) {
    gtmPositionStatus = 'not found'
  } else if (gtmPositionIndexOnPage < pageHtml.indexOf('</head')) {
    gtmPositionStatus = 'header'
  } else if (gtmPositionIndexOnPage > pageHtml.indexOf('<body')) {
    const distanceToStart = Math.abs(pageHtml.indexOf('<body') - gtmPositionIndexOnPage)
    const distanceToEnd = pageHtml.indexOf('</body') - gtmPositionIndexOnPage
    if (distanceToStart > distanceToEnd) {
      gtmPositionStatus = 'body bottom'
    } else {
      gtmPositionStatus = 'body init'
    }
  }
  return gtmPositionStatus
}

methods.checkGtmIds = function (lp) {
  return lp.gtms.sort().join(',') === pageTestResults[lp.endpoint].gtms.sort().join(',')
}

methods.checkGoogleAnalyticsTackingIds = function (lp) {
  return lp.uas.sort().join(',') === pageTestResults[lp.endpoint].uas.sort().join(',')
}

methods.checkDataLayerIds = function (lp) {
  return lp.data_layers.sort().join(',') === pageTestResults[lp.endpoint].data_layers.sort().join(',')
}

methods.filterDataLayerObjectKeysFound = function (lp, json) {
  if (!json) return []
  // todo: dangerous implementation of key check on stringified JSON
  return lp.keys.filter(key => json.indexOf(key) < 0)
}

methods.asyncWriteSpreadsheet = function (landingpageInfo, spreadsheetConfig) {
  return new Promise((resolve, reject) => {
    spreadsheetConfig.sheets.spreadsheets.values.append({
      auth: spreadsheetConfig.auth,
      spreadsheetId: spreadsheetConfig.spreadsheetId,
      range: 'maturity!H' + landingpageInfo.row.toString() + ':N' + landingpageInfo.row.toString(),
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          pageTestResults[landingpageInfo.endpoint].gtms.join(','),
          pageTestResults[landingpageInfo.endpoint].gtm_position,
          pageTestResults[landingpageInfo.endpoint].checkGtmIds,
          pageTestResults[landingpageInfo.endpoint].uas.join(','),
          pageTestResults[landingpageInfo.endpoint].uas_ok,
          pageTestResults[landingpageInfo.endpoint].data_layers.join(','),
          pageTestResults[landingpageInfo.endpoint].keys_log.join(',')
        ]]
      }
    }, (err, response) => {
      if (err) {
        console.log('The API returned an error inserting value of ' + landingpageInfo.endpoint + ':' + err)
        reject(err, landingpageInfo.endpoint)
      } else {
        console.log('Success: ' + landingpageInfo.endpoint)
        resolve(landingpageInfo.endpoint, response)
      }
    })
  })
}

// export methods
module.exports = methods
