const fs = require('fs');
const fetch = require('node-fetch');

const defaultHeaders = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Content-Type": "application/json",
  "x-amtrak-trace-id": "",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Pragma": "no-cache",
  "Cache-Control": "no-cache"
};

const updateFeed = async () => {
  try {
    const now = new Date();

    let responseObject = {
      trains: {},
    };

    const setupFetchRes = await fetch("https://www.amtrak.com/eymoNXDNm7bbwqa38ydg/3aO5GVz2f06z3X/XmE7QS8hAQ/WQE8U14D/NEE", {
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
    });

    const idsRes = await fetch('htt')


    console.log(`Finished updating Amtrak Alerts`)
    return responseObject;
  } catch (e) {
    console.log(e);
    return {
      trains: {}
    };
  }
};

exports.update = updateFeed;
