const fetch = require('node-fetch');
const { XMLParser } = require("fast-xml-parser");

const endpoint = 'https://schedule.wendellaboats.com/';
const regularTourTypes = [
  '45-min River',
  '90-min River',
  'Lake & River'
];

const parser = new XMLParser();

const recursivelyParseObjectValuesIntoString = (obj) => {
  if (typeof obj === 'string') {
    if (obj === '') {
      return [];
    }

    const tempArr = obj.split('. ');
    if (tempArr.length > 1) {
      return tempArr;
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
};

const parseDateFrom24HourTime = (time) => {
  const date = new Date();
  const [hours, minutes] = time.split(':');
  date.setHours(hours);
  date.setMinutes(minutes);
  return date;
};

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

  try {
    const text = await res.text();
    const parsed = parser.parse(text.split('<table class="table table-sm table-striped table-bordered table-hover text-center">')[1].split('</table>')[0]);

    let todayInHistory = [];

    const outData = parsed.tbody.tr.map((row, i, arr) => {
      const previousElements = arr.slice(0, i);
      const previousBoats = previousElements.filter((x) => x.td[1] === row.td[1]);
      const previousBoat = previousBoats[previousBoats.length - 1] ?? null;

      if (!row.td[1] && !row.td[2] && !row.td[4] && !row.td[5]) {
        todayInHistory.push(recursivelyParseObjectValuesIntoString(row.td[8]).flatMap((x) => x));
        return null;
      }

      const final = {
        boatLocation: row.td[0],
        boat: row.td[1],
        tourType: row.td[2],
        occupancy: row.td[3],
        departure: {
          dock: row.td[4].length > 0 ? row.td[4] : row.td[7],
          time: parseDateFrom24HourTime(row.td[5].length > 0 ? row.td[5] : row.td[6]),
        },
        departureDock: row.td[4].length > 0 ? row.td[4] : row.td[7],
        departureTime: row.td[5].length > 0 ? row.td[5] : row.td[6],
        previousArrivalTime: previousBoat?.td[6] ?? previousBoat?.td[5] ?? null,
        arrivalTime: row.td[6].length > 0 ? row.td[6] : row.td[5],
        arrivalDock: row.td[7].length > 0 ? row.td[7] : row.td[4],
        arrival: {
          dock: row.td[7].length > 0 ? row.td[7] : row.td[4],
          time: parseDateFrom24HourTime(row.td[6].length > 0 ? row.td[6] : row.td[5]),
        },
        specialInstructions: recursivelyParseObjectValuesIntoString(row.td[8]).flatMap((x) => x),
        groups: recursivelyParseObjectValuesIntoString(row.td[9]).flatMap((x) => x),
      }
      //console.log(final)
      return final;
    })

    return {
      data: outData.filter(n => n),
      boats: outData.filter(n => n),
      todayInHistory: todayInHistory,
      lastUpdated: new Date().toISOString(),
    }
  } catch (e) {
    console.log(e)
    return {
      data: [],
      boats: [],
      todayInHistory: [],
      lastUpdated: new Date().toISOString(),
    }
  }
})

exports.update = update;