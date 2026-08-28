const SAMPLE_EVENT_FOOTBALL = {
  id: "sample_event123",
  name: "Sample Event",
  start_date: "2026-08-28T18:20:00Z",
  category: "Sports",
  genre: "Football",
  sub_genre: "NFL",
  teamsL: ["Chicago Bears", "Minnesota Vikings"],
  image_url: "https://piemadd.com/chicago/01.jpg",
  venue: { id: "sample_venue123", name: "Sample Venue", lat: 41.853055349497915, lon: -87.61216533804074 },
  score: {
    type: "football",
    home: 7,
    away: 3,
    ball: "home",
    quarter: 3,
    timeLeft: "12:34",
    downAnd: "3rd & Goal",
    positionSide: "away",
    yardNumber: 34
  },
  additionalVenueInfo: { espn: "3933" }
};

const SAMPLE_EVENT_BASEBALL = {
  id: "sample_event123",
  name: "Sample Event",
  start_date: "2026-08-28T18:20:00Z",
  category: "Sports",
  genre: "Baseball",
  sub_genre: "MLB",
  teamsL: ["Chicago Cubs", "Cincinnati Reds"],
  image_url: "https://piemadd.com/chicago/01.jpg",
  venue: { id: "sample_venue123", name: "Sample Venue", lat: 41.853055349497915, lon: -87.61216533804074 },
  score: {
    type: "baseball",
    home: 7,
    away: 3,
    atBat: "away",
    inning: 3,
    topOfInning: true, // away is batting
    thisInning: { runs: 0, hits: 0, errors: 0, leftOnBase: 0, balls: 1, strikes: 2, outs: 1 }
  },
  additionalVenueInfo: { espn: "3933", mlb: "123" }
};

let allevents = {};

const fetchTicketmaster = async () => {
  //const TICKETMASTER_URL = 'http://localhost:3000/chi_events_tracker_ticketmaster_parsing/events';
  const TICKETMASTER_URL = "https://store.transitstat.us/chi_events_tracker_ticketmaster_parsing/events";

  const data = await fetch(TICKETMASTER_URL).then((res) => res.json());

  return data.map((event) => {
    switch (event.CLASSIFICATION_GENRE) {
      case "Football":
      case "Baseball":
        return {
          id: event.EVENT_ID,
          name: event.EVENT_NAME,
          start_date: event.EVENT_START_DATETIME,
          category: event.CLASSIFICATION_SEGMENT,
          genre: event.CLASSIFICATION_GENRE,
          sub_genre: event.CLASSIFICATION_SUB_GENRE,
          teamsList: event.ATTRACTION_CLASSIFICATION_SUB_TYPE != "Team" ? event.ATTRACTION_NAME.split("|") : null,
          image_url: event.EVENT_IMAGE_URL,
          venue: {
            id: event.VENUE_ID,
            name: event.VENUE_NAME,
            lat: parseFloat(event.VENUE_LATITUDE),
            lon: parseFloat(event.VENUE_LONGITUDE)
          },
          score: null,
          additionalVenueInfo: { espn: event.RELATIONS.rel_espn, mlb: event.RELATIONS.rel_mlb }
        };
      default:
        //console.log(`No CLASSIFICATION_GENRE "${event.CLASSIFICATION_GENRE}"`);
        return {
          id: event.EVENT_ID,
          name: event.EVENT_NAME,
          start_date: event.EVENT_START_DATETIME,
          category: event.CLASSIFICATION_SEGMENT,
          genre: event.CLASSIFICATION_GENRE,
          sub_genre: event.CLASSIFICATION_SUB_GENRE,
          teamsList: null,
          image_url: event.EVENT_IMAGE_URL,
          venue: {
            id: event.VENUE_ID,
            name: event.VENUE_NAME,
            lat: parseFloat(event.VENUE_LATITUDE),
            lon: parseFloat(event.VENUE_LONGITUDE)
          },
          score: null,
          additionalVenueInfo: {}
        };
    }
  });
};

const fetchESPNFootball = async () => {
  
};

const updateFeed = async (updateConfig) => {
  try {
    const now = Date.now();

    //ticketmaster
    const ticketmasterEvents = fetchTicketmaster();

    return ticketmasterEvents;
  } catch (e) {
    return false;
  }
};

exports.update = updateFeed;
