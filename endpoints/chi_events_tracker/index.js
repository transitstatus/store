const SAMPLE_EVENT_FOOTBALL = {
  id: "sample_event123",
  name: "Sample Event",
  start_date: "2026-08-28T18:20:00Z",
  category: "Sports",
  genre: "Football",
  sub_genre: "NFL",
  teams_list: null,
  image_url: "https://piemadd.com/chicago/01.jpg",
  venue: { id: "sample_venue123", name: "Sample Venue", lat: 41.853055349497915, lon: -87.61216533804074 },
  attendance: null,
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
  teams_list: null,
  image_url: "https://piemadd.com/chicago/01.jpg",
  venue: { id: "sample_venue123", name: "Sample Venue", lat: 41.853055349497915, lon: -87.61216533804074 },
  attendance: null,
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

const espnsLeagueStrings = { football: [["NFL", "nfl"]], baseball: [["MLB", "mlb"]], soccer: [["MLS", "usa.1"]] };

let allevents = {};

const fetchTicketmaster = async () => {
  const TICKETMASTER_URL = 'http://localhost:3000/chi_events_tracker_ticketmaster_parsing/events';
  //const TICKETMASTER_URL = "https://store.transitstat.us/chi_events_tracker_ticketmaster_parsing/events";

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
          teams_list: null, // getting this from
          image_url: event.EVENT_IMAGE_URL,
          venue: {
            id: event.VENUE_ID,
            name: event.VENUE_NAME,
            lat: parseFloat(event.VENUE_LATITUDE),
            lon: parseFloat(event.VENUE_LONGITUDE)
          },
          attendance: null,
          score: null,
          additionalVenueInfo: { espn: event.RELATIONS?.rel_espn, mlb: event.RELATIONS?.rel_mlb }
        };
      default:
        return {
          id: event.EVENT_ID,
          name: event.EVENT_NAME,
          start_date: event.EVENT_START_DATETIME,
          category: event.CLASSIFICATION_SEGMENT,
          genre: event.CLASSIFICATION_GENRE,
          sub_genre: event.CLASSIFICATION_SUB_GENRE,
          teams_list: null,
          image_url: event.EVENT_IMAGE_URL,
          venue: {
            id: event.VENUE_ID,
            name: event.VENUE_NAME,
            lat: parseFloat(event.VENUE_LATITUDE),
            lon: parseFloat(event.VENUE_LONGITUDE)
          },
          attendance: null,
          score: null,
          additionalVenueInfo: {}
        };
    }
  });
};

const fetchESPNFootball = async (league) => {
  const eventsList = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/${league[1]}/events`).then(
    (res) => res.json()
  );

  const finalEvents = await Promise.all(
    eventsList.events.map(async (event) => {
      const eventDetails = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/${league[1]}/summary?event=${event.id}`
      ).then((res) => res.json());

      let competitorsObj = {};

      return {
        id: event.id,
        name: event.name,
        start_date: event.date,
        category: "Sports",
        genre: "Football",
        sub_genre: league[0],
        teams_list: event.competitors.map((team) => {
          competitorsObj[team.homeAway] = { name: team.displayName, code: team.abbreviation, logo: team.logoDark };
          return { name: team.displayName, code: team.abbreviation, logo: team.logoDark };
        }),
        image_url: null,
        venue: {
          id: eventDetails.gameInfo?.venue?.id,
          name: eventDetails.gameInfo?.venue?.fullName,
          lat: null,
          lon: null
        },
        attendance: eventDetails.gameInfo?.attendance,
        score:
          event.fullStatus && eventDetails.drives?.current
            ? {
                type: "football",
                home: eventDetails.scoringPlays ? eventDetails.scoringPlays.at(-1).homeScore : 0,
                away: eventDetails.scoringPlays ? eventDetails.scoringPlays.at(-1).awayScore : 0,
                ball: eventDetails.drives.current.team.abbreviation,
                quarter: event.fullStatus.period,
                timeLeft: event.fullStatus.displayClock,
                downAnd: eventDetails.drives.current.plays.at(-1).start.shortDownDistanceText,
                positionSide: (eventDetails.drives?.current?.end?.text ?? `${eventDetails.drives.current.team.abbreviation} `).split(" ")[0],
                yardNumber: Math.abs((eventDetails.drives?.current?.end?.yardLine ?? 100) - 50),
                gameComplete: false,
                gameStarted: true
              }
            : eventDetails.drives?.previous
              ? {
                  type: "football",
                  home: eventDetails.scoringPlays ? eventDetails.scoringPlays.at(-1).homeScore : 0,
                  away: eventDetails.scoringPlays ? eventDetails.scoringPlays.at(-1).awayScore : 0,
                  ball: competitorsObj['home'].abbreviation,
                  quarter: event.fullStatus.period,
                  timeLeft: event.fullStatus.displayClock,
                  downAnd: null,
                  positionSide: null,
                  yardNumber: null,
                  gameComplete: true,
                  gameStarted: true
                }
              : {
                  type: "football",
                  home: 0,
                  away: 0,
                  ball: competitorsObj['home'].abbreviation,
                  quarter: 1,
                  timeLeft: "15:00",
                  downAnd: "1st & 20",
                  positionSide: event.competitors[0].abbreviation,
                  yardNumber: 50,
                  gameComplete: false,
                  gameStarted: false
                },
        additionalVenueInfo: null
      };
    })
  );

  return finalEvents;
};

const fetchESPNBaseball = async (league) => {
  const eventsList = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/${league[1]}/events`).then(
    (res) => res.json()
  );

  const finalEvents = await Promise.all(
    eventsList.events.map(async (event) => {
      const eventDetails = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/${league[1]}/summary?event=${event.id}`
      ).then((res) => res.json());

      const thisInningPlays =
        eventDetails.plays?.length > 0
          ? eventDetails.plays.filter(
              (play) =>
                event.fullStatus?.periodPrefix == play.period.type && event.fullStatus?.period == play.period.number
            )
          : null;
      const mostRecentPlay = eventDetails.plays?.length > 0 ? eventDetails.plays.at(-1) : null;

      return {
        id: event.id,
        name: event.name,
        start_date: event.date,
        category: "Sports",
        genre: "Baseball",
        sub_genre: league[0],
        teams_list: event.competitors.map((team) => {
          return { name: team.displayName, code: team.abbreviation, logo: team.logoDark };
        }),
        image_url: null,
        venue: {
          id: eventDetails.gameInfo?.venue?.id,
          name: eventDetails.gameInfo?.venue?.fullName,
          lat: null,
          lon: null
        },
        attendance: eventDetails.gameInfo?.attendance,
        score:
          event.fullStatus?.type?.state == "in"
            ? {
                type: "baseball",
                home: parseInt(event.competitors.find((team) => team.homeAway == "home").score),
                away: parseInt(event.competitors.find((team) => team.homeAway == "away").score),
                atBat: event.fullStatus?.periodPrefix == "Top" ? "away" : "home",
                inning: event.fullStatus?.period,
                topOfInning: event.fullStatus?.periodPrefix == "Top", // away is batting
                thisInning: {
                  runs: thisInningPlays ? thisInningPlays.filter((play) => play.type.text).length : 0,
                  balls: eventDetails.situation.balls,
                  strikes: eventDetails.situation.strikes,
                  outs: eventDetails.situation.outs
                },
                gameComplete: false,
                gameStarted: true
              }
            : event.fullStatus?.type?.completed == true
              ? {
                  type: "baseball",
                  home: parseInt(event.competitors.find((team) => team.homeAway == "home").score),
                  away: parseInt(event.competitors.find((team) => team.homeAway == "away").score),
                  atBat: event.fullStatus?.periodPrefix == "Top" ? "away" : "home",
                  inning: event.fullStatus?.period,
                  topOfInning: event.fullStatus?.periodPrefix == "Top", // away is batting
                  thisInning: {
                    runs: thisInningPlays ? thisInningPlays.filter((play) => play.type.text).length : 0,
                    balls: null,
                    strikes: null,
                    outs: null
                  },
                  gameComplete: true,
                  gameStarted: true
                }
              : {
                  type: "baseball",
                  home: 0,
                  away: 0,
                  atBat: "away",
                  inning: 1,
                  topOfInning: true, // away is batting
                  thisInning: { runs: 0, balls: 0, strikes: 0, outs: 0 },
                  gameComplete: false,
                  gameStarted: false
                },
        additionalVenueInfo: null
      };
    })
  );

  return finalEvents;
};

const updateFeed = async () => {
  try {
    const now = Date.now();

    let finalEventsNonSports = {};
    let finalEventsSports = {};
    let eventsForComparison = [];

    //ticketmaster
    const ticketmasterEvents = await fetchTicketmaster();

    ticketmasterEvents.forEach((event) => {
      if (event.category == "Sports") {
        finalEventsSports[event.id] = event;
      } else {
        finalEventsNonSports[event.id] = event;
      }
      eventsForComparison.push({
        ticketmasterId: event.id,
        name: event.name,
        genre: event.genre, // Football for sports
        sub_genre: event.sub_genre, // NFL for sports
        date: new Date(event.start_date).toISOString()
      });
    });

    const integrateEspnData = async (genre, leagueStrings, fetchFunction) => {
      for (let i = 0; i < leagueStrings.length; i++) {
        const league = leagueStrings[i];
        const espnEvents = await fetchFunction(league);

        espnEvents.forEach((espnEvent) => {
          const possibleMatchingEvents = eventsForComparison
            .filter((ticketmasterEvent) => {
              if (ticketmasterEvent.genre != genre || ticketmasterEvent.sub_genre != league[[0]]) return false;
              if (!ticketmasterEvent.name.includes(espnEvent.teams_list[0].name)) return false;
              if (!ticketmasterEvent.name.includes(espnEvent.teams_list[1].name)) return false;
              if (ticketmasterEvent.date.split("T")[0] != new Date(espnEvent.start_date).toISOString().split("T")[0])
                return false;
              return true;
            })
            .sort((a, b) => {
              const aNum = new Date(a.date).valueOf();
              const bNum = new Date(b.date).valueOf();

              return bNum - aNum;
            });

          // if we have a best match, use it
          if (possibleMatchingEvents.length > 0) {
            const bestMatch = possibleMatchingEvents[0];

            const newTicketmasterEvent = {
              ...finalEventsSports[bestMatch.ticketmasterId],
              name: espnEvent.name,
              start_date: espnEvent.start_date,
              teams_list: espnEvent.teams_list,
              attendance: espnEvent.attendance,
              score: espnEvent.score
            };

            finalEventsSports[bestMatch.ticketmasterId] = newTicketmasterEvent;
          } else {
            finalEventsSports[`espn_${espnEvent.id}`] = { ...espnEvent, id: `espn_${espnEvent.id}` };
          }
        });
      }
    };

    await integrateEspnData("Football", espnsLeagueStrings.football, fetchESPNFootball);
    await integrateEspnData("Baseball", espnsLeagueStrings.baseball, fetchESPNBaseball);

    return {
      events: [...Object.values(finalEventsNonSports), ...Object.values(finalEventsSports)].sort((a, b) => {
        const aNum = new Date(a.start_date).valueOf();
        const bNum = new Date(b.start_date).valueOf();

        return aNum - bNum;
      })
    };
  } catch (e) {
    console.log(e);
    return false;
  }
};

exports.update = updateFeed;
