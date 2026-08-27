require("dotenv").config();

const fetchAndParseGz = async (url) => {
  const response = await fetch(url);

  const decompressionStream = new DecompressionStream("gzip");
  const decompressedStream = response.body.pipeThrough(decompressionStream);

  const jsonText = await new Response(decompressedStream).text();

  const data = JSON.parse(jsonText);
  return data;
};

const fetchTicketmaster = async () => {
  console.log(process.env.TICKETMASTER_CONSUMER_KEY)
  const eventsFeed = await fetchAndParseGz(
    `https://app.ticketmaster.com/discovery-feed/v2/events.json?apikey=${process.env.TICKETMASTER_CONSUMER_KEY}&countryCode=US`
  );

  console.log(eventsFeed)
};

const updateFeed = async (updateConfig) => {
  try {
    const now = Date.now();

    //ticketmaster
    const ticketmasterEvents = fetchTicketmaster();
  } catch (e) {
    if (updateConfig.firstUpdate) {
      const initialStateText = await fetch("https://store.transitstat.us/amtrak_fetch_proxy").then((res) => res.text());
      if (initialStateText !== "Not found" && !initialStateText.startsWith("no available server"))
        return JSON.parse(initialStateText);
    }

    return { events: [] };
  }
};

exports.update = updateFeed;
