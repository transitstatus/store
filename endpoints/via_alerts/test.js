const fs = require('fs');

fetch("https://www.viarail.ca/en/plan/service-status", {
  "credentials": "include",
  "headers": {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "CSRF-Token": "undefined",
    "Content-Type": "text/plain;charset=UTF-8",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Priority": "u=0",
    "Pragma": "no-cache",
    "Cache-Control": "no-cache"
  },
  "referrer": "https://www.amtrak.com/home.html",
  "body": "{}",
  "method": "POST",
  "mode": "cors"
})
  .then((res) => res.text())
  .then((firstFetchData) => {
    const startOfOuterBlock = firstFetchData.indexOf('<!-- main content -->');
    const startOfScriptBlock = firstFetchData.indexOf('window.__INITIAL_STATE__ = ', startOfOuterBlock);
    const endOfScriptBlock = firstFetchData.indexOf('</script>', startOfScriptBlock);

    const scriptBlockOuter = firstFetchData.substring(startOfScriptBlock, endOfScriptBlock).replace('window.__INITIAL_STATE__ = ', '');
    const scriptBlockParsed = new Function('return ' + scriptBlockOuter)();
    console.log(scriptBlockParsed)

    fs.writeFileSync('./endpoints/via_alerts/data.json', JSON.stringify(scriptBlockParsed, null, 2), { encoding: 'utf8' });
  })