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
