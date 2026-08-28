const csv = require("@fast-csv/parse");
const zlib = require("node:zlib");
const { Readable } = require("node:stream");
require("dotenv").config();

const venues = {
  ZFr9jZe1vk: { name: "Wrigley Field", rel_mlb: "17", rel_espn: "16" },
  KovZpaFPJe: { name: "Rate Field", rel_mlb: "4", rel_espn: "4" },
  KovZpZAF6tIA: { name: "Soldier Field", rel_espn: "3933" },
  KovZ917AI5F: { name: "The Salt Shed Indoors (Shed)" },
  KovZ917Amf0: { name: "The Salt Shed Outdoors (Fairgrounds)" },
  KovZpZAEAIlA: { name: "House of Blues Chicago" },
  KovZpZAF6alA: { name: "Apollos Theater" },
  KovZpZA6AJ6A: { name: "The Chicago Theatre" },
  KovZpZAEA7IA: { name: "Huntington Bank Pavilion at Northerly Island" },
  KovZ917A2S0: { name: "Wintrust Arena", rel_espn: "5427" },
  KovZpa2M7e: { name: "United Center", rel_espn: "1847" },
  ZFr9jZeeFF: { name: "Navy Pier" }
};
const venueIDs = Object.keys(venues);

const updateFeed = async () => {
  try {
    const now = Date.now();

    const feeds = await fetch(
      `https://app.ticketmaster.com/discovery-feed/v2/events?apikey=${process.env.TICKETMASTER_CONSUMER_KEY}`
    ).then((res) => res.json());

    if (feeds.countries?.US?.CSV) {
      const obj = feeds.countries?.US?.CSV;

      const streamRes = await fetch(obj.uri);

      if (!streamRes.ok || !streamRes.body) {
        return false;
      }

      const nodeStream = Readable.fromWeb(streamRes.body);

      let rawEvents = [];

      return new Promise((resolve, reject) => {
        nodeStream
          .pipe(zlib.createGunzip())
          .pipe(
            csv.parse({
              headers: (headers) => {
                const seen = {};
                return headers.map((header) => {
                  if (!header) return "unnamed";

                  // Track occurrences of the header name
                  if (seen[header] === undefined) {
                    seen[header] = 0;
                    return header;
                  }

                  seen[header]++;
                  return `${header}_${seen[header]}`; // e.g., "Email_1", "Email_2"
                });
              }
            })
          )
          .on("error", (error) => {
            console.log("Tickemaster parsing error:", error);
            reject(false);
          })
          .on("data", (row) => {
            if (
              row.VENUE_STATE_CODE == "IL" &&
              //row.VENUE_CITY == "Chicago" &&
              new Date(row.EVENT_START_DATETIME).valueOf() < now + 1000 * 60 * 60 * 24 * 31 &&
              venueIDs.includes(row.VENUE_ID)
            ) {
              rawEvents.push({ ...row, RELATIONS: venues[row.VENUE_ID] });
            }
          })
          .on("end", (rowCount) => {
            console.log(`Successfully parsed ${rowCount} rows from ticketmaster.`);
            resolve({ events: rawEvents });
          });
      });
    }
    return false;
  } catch (e) {
    console.log(e);
    return { events: [] };
  }
};

exports.update = updateFeed;
