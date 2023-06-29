const fetch = require('node-fetch');
const { XMLParser } = require("fast-xml-parser");

const endpoint = 'https://schedule.wendellaboats.com/';

const parser = new XMLParser();

const recursivelyParseObjectValuesIntoString = (obj) => {
  if (typeof obj === 'string') {
    if (obj === '') {
      return [];
    }

    return [obj];
  }

  const keys = Object.keys(obj);
  const values = Object.values(obj);

  let final = [];

  for (let i = 0; i < keys.length; i++) {
    if (typeof values[i] === 'object') {
      final.push(recursivelyParseObjectValuesIntoString(values[i]));
    } else {
      if (values[i] === '') {
        continue;
      }
      final.push(values[i]);
    }
  }

  return final;
}

const update = (async () => {
  const res = await fetch(endpoint, {
    "credentials": "include",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache"
    },
    "method": "GET",
  });

  const text = await res.text();
  const parsed = parser.parse(text.split('<table class="table table-sm table-striped table-bordered table-hover text-center">')[1].split('</table>')[0]);

  const outData = parsed.tbody.tr.map((row) => {
    const final = {
      boatLocation: row.td[0],
      boat: row.td[1],
      tourType: row.td[2],
      occupancy: row.td[3],
      departureDock: row.td[4],
      departureTime: row.td[5],
      arrivalTime: row.td[6],
      arrivalDock: row.td[7],
      specialInstructions: recursivelyParseObjectValuesIntoString(row.td[8]).flatMap((x) => x),
      groups: recursivelyParseObjectValuesIntoString(row.td[9]).flatMap((x) => x),
    }
    //console.log(final)
    return final;
  })

  return outData;
})

exports.update = update;