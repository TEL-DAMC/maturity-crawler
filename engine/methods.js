/* LIBS */
const puppeteer = require('puppeteer')

/* VARS */
const pageTestResults = {}

/* METHODS */
const methods = {}

let globalBrowserInstance

// get parameter name
methods.getUrlParamValueFromName = function (url, name) {
  name = name.replace(/[\[\]]/g, '\\$&')
  let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  let results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

// fetch pages
methods.checkLandingPages = async function (landingPages, googleSheetsConfig) {
  globalBrowserInstance = await puppeteer.launch({headless: false})
  let currentlyRunning = 0
  ;(async function loop (i) {
    if (currentlyRunning < 8) {
      currentlyRunning++
      methods.fetch(landingPages[i], googleSheetsConfig).catch(e => console.warn('fetch error:', landingPages[i], e))
    } else {
      await methods.fetch(landingPages[i], googleSheetsConfig).catch(e => console.warn('fetch error:', landingPages[i], e))
      currentlyRunning = (await globalBrowserInstance.pages()).length
    }
    i++
    await loop(i)
  })(0)

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

methods.fetch = async function (lp, sc) {
  // open browser
  const chromeBrowserInstance = globalBrowserInstance

  if (!lp || !lp.endpoint) return
  const chomeTab = await chromeBrowserInstance.newPage()

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
        pageTestResults[lp.endpoint].uas.push(this.getUaTid(url))
      }
    }
  })

  // handling error
  chomeTab.on('error', msg => {
    console.warn('browser error', lp.endpoint)
  })

  chomeTab.on('pageerror', msg => {
    console.warn('page js error', lp.endpoint)
  })

  console.log('endpoint:', lp.endpoint)
  await chomeTab.goto(lp.endpoint, {waitUntil: 'networkidle0'}).catch(e => {
    console.error('error on ', lp.endpoint, ':', e.message)
  })

  // html content analysis
  const PageHTML = await chomeTab.content()
  console.log('html length:', PageHTML.length)

  pageTestResults[lp.endpoint].gtm_position = methods.checkGtmPositionStatus(PageHTML)

  console.log(pageTestResults[lp.endpoint].data_layers)
  const PageDataLayer = await methods.getDataLayerObject(chomeTab, pageTestResults[lp.endpoint].data_layers[0])

  methods.checkObjectKeys(lp, JSON.stringify(PageDataLayer))

  if ((await chromeBrowserInstance.pages()).length > 2) await chomeTab.close()

  pageTestResults[lp.endpoint].gtms_ok = methods.gtms_ok(lp)
  methods.uas_ok(lp)
  methods.dataLayersOk(lp)

  methods.writeSpreadsheet(lp, sc)
}

methods.getDataLayerObject = async function (chromeTab, dataLayerName) {
  return chromeTab.evaluate((GtmDataLayerName) => {
    return window[GtmDataLayerName]
  }, dataLayerName)
}
/**
 * Returns GTM's dataLayer name and id from its url
 * @param url GTM js URL
 * @returns {{dataLayerObjectName: string, gtmId: string}}
 */
methods.getGtmInfoFromUrl = function (url) {
  return {
    dataLayerObjectName: methods.getUrlParamValueFromName(url, 'l'),
    gtmId: methods.getUrlParamValueFromName(url, 'id')
  }
}

/**
 * Returns Google Analytics Tracking ID from the url
 * @param url
 * @returns {string} Tracking Id
 */
methods.getUaTid = function (url) {
  return this.getUrlParamValueFromName(url, 'tid')
}

methods.checkGtmPositionStatus = function (pageHtml) {
  let gtmPositionStatus

  const gtmPositionIndexOnPage = pageHtml.indexOf('gtm.js?') // TODO: Check more than one GTM on the same page

  if (gtmPositionIndexOnPage <= -1) {
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

methods.gtms_ok = function (lp) {
  // check gtms
  return lp.gtms.sort().join(',') === pageTestResults[lp.endpoint].gtms.sort().join(',')
}

methods.uas_ok = function (lp) {
  // check uas
  pageTestResults[lp.endpoint].uas_ok = lp.uas.sort().join(',') === pageTestResults[lp.endpoint].uas.sort().join(',')
}

methods.dataLayersOk = function (lp) {
  // check data_layers
  pageTestResults[lp.endpoint].dataLayersOk = lp.data_layers.sort().join(',') === pageTestResults[lp.endpoint].data_layers.sort().join(',')
}

methods.checkObjectKeys = function (lp, json) {
  for (let key of lp.keys) {
    if (json.indexOf(key) < 0) { // todo: dangerous implementation of key check on stringified JSON
      pageTestResults[lp.endpoint].keys_log.push(key)
    }
  }
}

methods.writeSpreadsheet = function (lp, sc) {
  sc.sheets.spreadsheets.values.append({
    auth: sc.auth,
    spreadsheetId: sc.spreadsheetId,
    range: 'maturity!G' + lp.row.toString() + ':M' + lp.row.toString(),
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[
        pageTestResults[lp.endpoint].gtms.join(','), // G
        pageTestResults[lp.endpoint].gtm_position, // H
        pageTestResults[lp.endpoint].gtms_ok, // I
        pageTestResults[lp.endpoint].uas.join(','), // J
        pageTestResults[lp.endpoint].uas_ok, // K
        pageTestResults[lp.endpoint].data_layers.join(','), // L
        pageTestResults[lp.endpoint].keys_log.join(',') // M
      ]]
    }
  }, (err, response) => {
    if (err) {
      console.log('The API returned an error inserting value of ' + lp.endpoint + ':' + err)
    } else {
      console.log('Success: ' + lp.endpoint)
    }
  })
}

// export methods
module.exports = methods
