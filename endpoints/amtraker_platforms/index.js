const updateFeed = async () => {
  try {
    let responseObject = {
      stations: {
        TRE: {},
        PHL: {},
        NYP: {},
        EWR: {},
        MET: {},
        NWK: {},
        ANA: {},
        BUR: {},
        CML: {},
        CWT: {},
        BBK: {},
        FUL: {},
        GDL: {},
        IRV: {},
        LAX: {},
        MPK: {},
        NRG: {},
        OXN: {},
        RIV: {},
        SNC: {},
        SNA: {},
        SIM: {},
        VNC: {},
        BRP: {},
        CRT: {},
        NHV: {},
        NRO: {},
        NYP: {},
        POU: {},
        STM: {},
        STS: {},
        YNY: {},
      },
      stations_w_src: {
        TRE: {},
        PHL: {},
        NYP: {},
        EWR: {},
        MET: {},
        NWK: {},
        ANA: {},
        BUR: {},
        CML: {},
        CWT: {},
        BBK: {},
        FUL: {},
        GDL: {},
        IRV: {},
        LAX: {},
        MPK: {},
        NRG: {},
        OXN: {},
        RIV: {},
        SNC: {},
        SNA: {},
        SIM: {},
        VNC: {},
        BRP: {},
        CRT: {},
        NHV: {},
        NRO: {},
        NYP: {},
        POU: {},
        STM: {},
        STS: {},
        YNY: {},
      },
    };

    //fetching data
    const resultingData = await Promise.all(
      [
        "http://localhost:3000/njt_rail_platforms",
        "http://localhost:3000/nyp_moy_platforms",
        "http://localhost:3000/metrolink_platforms",
        "http://localhost:3000/mnrr/amtrakPlatforms"
      ].map((url) => fetch(url).then((res) => res.json())),
    );

    const sourceNames = ["NJ Transit", "Moynihan Train Hall", "LA Metrolink", "Metro North"];

    resultingData.forEach((source, sourceIndex) => {
      Object.keys(source.stations).forEach((stationCode) => {
        if (!responseObject.stations[stationCode])
          responseObject.stations[stationCode] = {};
        if (!responseObject.stations_w_src[stationCode])
          responseObject.stations_w_src[stationCode] = {};

        Object.keys(source.stations[stationCode]).forEach((trainNumber) => {
          const trainTrack = source.stations[stationCode][trainNumber];

          if (trainTrack.length > 0) {
            responseObject.stations[stationCode][trainNumber] = trainTrack;
            responseObject.stations_w_src[stationCode][trainNumber] = {
              platform: trainTrack,
              source: sourceNames[sourceIndex],
            };
          }
        });
      });
    });

    console.log(`Finished updating All Amtraker Tracks`);
    return responseObject;
  } catch (e) {
    console.log(e);
    return {
      stations: {
        TRE: {},
        PHL: {},
        NYP: {},
        EWR: {},
        MET: {},
        NWK: {},
        ANA: {},
        BUR: {},
        CML: {},
        CWT: {},
        BBK: {},
        FUL: {},
        GDL: {},
        IRV: {},
        LAX: {},
        MPK: {},
        NRG: {},
        OXN: {},
        RIV: {},
        SNC: {},
        SNA: {},
        SIM: {},
        VNC: {},
      },
      stations_w_src: {
        TRE: {},
        PHL: {},
        NYP: {},
        EWR: {},
        MET: {},
        NWK: {},
        ANA: {},
        BUR: {},
        CML: {},
        CWT: {},
        BBK: {},
        FUL: {},
        GDL: {},
        IRV: {},
        LAX: {},
        MPK: {},
        NRG: {},
        OXN: {},
        RIV: {},
        SNC: {},
        SNA: {},
        SIM: {},
        VNC: {},
      },
    };
  }
};

exports.update = updateFeed;
