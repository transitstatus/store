const stationsMetaArray = require("./stations.json");
const along = require("@turf/along").default;
const length = require("@turf/length").default;
const { lineString } = require("@turf/helpers");

const update = async () => {
  const now = new Date();

  let stationsMetaDict = {};
  let gtfsToStationID = {};
  stationsMetaArray.features.forEach((feature) => {
    gtfsToStationID[feature.properties.gtfs_stop_id] =
      feature.properties.station_id;

    if (!stationsMetaDict[feature.properties.station_id]) {
      stationsMetaDict[feature.properties.station_id] = {
        ...feature.properties,
        position: feature.geometry.coordinates,
        allGtfsIds: [feature.properties.gtfs_stop_id],
      };
    } else {
      stationsMetaDict[feature.properties.station_id].allGtfsIds.push(
        feature.properties.gtfs_stop_id,
      );
    }
  });

  try {
    const [staticStopsData, staticRoutesData, staticSegmentsData, heliumData] =
      await Promise.all(
        [
          "https://gtfs.piemadd.com/data/nyct_subway/stops.json",
          "https://gtfs.piemadd.com/data/nyct_subway/routes.json",
          "https://gtfs.piemadd.com/data/nyct_subway/segments.json",
          "https://helium-prod.mylirr.org/v1/subway/trips",
        ].map((url) => fetch(url).then((res) => res.json())),
      );

    let tsv1 = {
      trains: {},
      stations: {},
      lines: {},
      alerts: [],
    };

    const findMatchingSegmentFromStationId = (
      firstStationId,
      secondStationId,
    ) => {
      let allSegmentKeyPossibilities = [];
      stationsMetaDict[firstStationId].allGtfsIds.forEach((firstId) => {
        stationsMetaDict[secondStationId].allGtfsIds.forEach((secondId) => {
          allSegmentKeyPossibilities.push(`${firstId}_${secondId}`);
        });
      });

      return allSegmentKeyPossibilities.find(
        (key) => staticSegmentsData.segments[key],
      );
    };

    const findMatchingSegment = (trip, lastDepartedLocationIndex) => {
      return findMatchingSegmentFromStationId(
        trip.stops[lastDepartedLocationIndex].stationId,
        trip.stops[lastDepartedLocationIndex + 1].stationId,
      );
    };

    // calculating fake positions
    let positionsDict = {};
    heliumData.trips.forEach((trip) => {
      if (trip.estimatedLongitude && trip.estimatedLatitude) {
        // official data from the MTA will likely be the best data...i hope
        positionsDict[trip.tripId] = [
          trip.estimatedLongitude,
          trip.estimatedLatitude,
        ];
        return;
      }

      const atStationLocation = trip.stops.find(
        (stop) => stop.stopStatus == "AT_STATION",
      );
      const lastDepartedLocationIndex = trip.stops.findLastIndex((stop) =>
        stop.stopStatus.includes("DEPARTED"),
      );

      if (trip.stops[0].stopStatus == "EN_ROUTE") {
        positionsDict[trip.tripId] =
          stationsMetaDict[trip.stops[0].stationId].position;
      } else if (
        trip.stops[trip.stops.length - 1].stopStatus.includes("DEPARTED")
      ) {
        positionsDict[trip.tripId] =
          stationsMetaDict[
            trip.stops[trip.stops.length - 1].stationId
          ].position;
      } else if (atStationLocation) {
        positionsDict[trip.tripId] =
          stationsMetaDict[atStationLocation.stationId].position;
      } else if (lastDepartedLocationIndex > -1) {
        const segmentKey = findMatchingSegment(trip, lastDepartedLocationIndex);
        let segment = null;

        if (!segmentKey) {
          // we are in a god-awful stupid state where there is some cursed skip-stop pattern going on that isnt in the regular gtfs
          // thankfully, the trip object *does* have an array of segments we can use to make one megasegment to use
          // massive pain in the ass? absolutely. better than nothing? also yes.

          // first, we need to find the segment that has the "last departed" stop as the beginning
          // as well as the last segment that has the next "en route" station as the ending
          const firstSegmentIndex = trip.shapeSegmentIds.findIndex(
            (segmentKey) =>
              segmentKey.startsWith(
                trip.stops[lastDepartedLocationIndex].stationId,
              ),
          );
          const lastSegmentIndex = trip.shapeSegmentIds.findIndex(
            (segmentKey, i) => {
              if (i < firstSegmentIndex) return false;
              return segmentKey.endsWith(
                trip.stops[lastDepartedLocationIndex + 1].stationId,
              );
            },
          );

          let allSegments = [];
          for (let i = firstSegmentIndex; i <= lastSegmentIndex; i++) {
            allSegments.push(trip.shapeSegmentIds[i]);
          }

          const allSegmentsConverted = allSegments
            .map((segment) => {
              return findMatchingSegmentFromStationId(...segment.split("-"));
            })
            .map((key) => staticSegmentsData.segments[key]);

          let finalSegment = {
            seconds: 0,
            meters: 0,
            shape: [],
          };

          allSegmentsConverted.forEach((segment, i) => {
            if (i == 0) finalSegment.shape.push(...segment.shape);
            else finalSegment.shape.push(...segment.shape.slice(1));

            finalSegment.seconds += segment.seconds;
            finalSegment.meters += segment.meters;
          });
          segment = finalSegment;
        } else {
          segment = staticSegmentsData.segments[segmentKey];
        }

        // overwriting the segment time using the difference in ETAs because why not
        const dep = trip.stops[lastDepartedLocationIndex].estArriveAt;
        const arr = trip.stops[lastDepartedLocationIndex + 1].estArriveAt;

        segment.seconds = arr - dep;

        // actually
        const nowTime = trip.updatedAt;

        const percentAlong = Math.min(
          Math.max((nowTime - dep) / (arr - dep), 0),
          1,
        );

        if (percentAlong == 0)
          positionsDict[trip.tripId] =
            stationsMetaDict[
              trip.stops[lastDepartedLocationIndex].stationId
            ].position;
        else if (percentAlong == 0)
          positionsDict[trip.tripId] =
            stationsMetaDict[
              trip.stops[lastDepartedLocationIndex + 1].stationId
            ].position;
        else {
          const segmentGeoJSON = lineString(segment.shape);

          const position = along(
            segmentGeoJSON,
            length(segmentGeoJSON, { units: "meters" }) * percentAlong,
            { units: "meters" },
          );
          positionsDict[trip.tripId] = position.geometry.coordinates;
        }
      }
    });

    stationsMetaArray.features.forEach((stop) => {
      const northDirectionLabel =
        stop.properties.north_direction_label == "Last Stop"
          ? stop.properties.stop_name
          : stop.properties.north_direction_label;
      const southDirectionLabel =
        stop.properties.south_direction_label == "Last Stop"
          ? stop.properties.stop_name
          : stop.properties.south_direction_label;

      //adding stations to tsv1 object
      tsv1.stations[stop.properties.station_id] = {
        stationID: stop.properties.station_id,
        stationName: stop.properties.stop_name,
        lat: stop.geometry.coordinates[1],
        lon: stop.geometry.coordinates[0],
        destinations: {
          [northDirectionLabel]: { trains: [] },
          [southDirectionLabel]: { trains: [] },
        },
        directionLabels: {
          NORTH: northDirectionLabel,
          SOUTH: southDirectionLabel,
        },
      };
    });

    //adding lines to tsv1 object
    Object.values(staticRoutesData).forEach((route) => {
      tsv1.lines[route.routeID] = {
        lineCode: route.routeID,
        lineNameShort: route.routeShortName,
        lineNameLong: route.routeLongName,
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: route.routeStations.map((gtfsCode) => gtfsToStationID[gtfsCode]),
        hasActiveTrains: false,
      };
    });

    //adding trains to tsv1 object
    heliumData.trips.forEach((trip) => {
      const runNumber = trip.tripId.replaceAll(" ", "_").replaceAll('/', '_');

      if (trip.routeId == "SI") {
        if (trip.direction == "WEST") trip.direction = "NORTH";
        if (trip.direction == "EAST") trip.direction = "SOUTH";
      }

      const position = positionsDict[trip.tripId];

      let finalTrain = {
        lat: position[1],
        lon: position[0],
        heading: 0,
        realTime: trip.isAssigned,
        deadMileage: false,
        line: staticRoutesData[trip.routeId].routeLongName,
        lineCode: trip.routeId,
        lineColor: staticRoutesData[trip.routeId].routeColor,
        lineTextColor: staticRoutesData[trip.routeId].routeTextColor,
        dest: trip.headsign,
        predictions: [],
        type: "train",
        extra: {
          holidayChristmas: false,
          consist: trip.consist,
        },
      };

      trip.stops.forEach((stop) => {
        const thisStop = tsv1.stations[stop.stationId];

        //if (thisStop.stationId == '25' || thisStop.stationId == '174') console.log(trip.direction, thisStop.stationId, stop.sectionId, stop.platformEdges[0])

        finalTrain.predictions.push({
          stationID: stop.stationId,
          stationName: thisStop.stationName,
          actualETA: stop.estArriveAt * 1000,
          noETA: false,
          realTime: trip.isAssigned,
        });

        tsv1.stations[stop.stationId].destinations[
          thisStop.directionLabels[trip.direction]
        ].trains.push({
          runNumber: runNumber,
          actualETA: stop.estArriveAt * 1000,
          noETA: false,
          realTime: trip.isAssigned,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          destination: finalTrain.dest,
          extra: {
            holidayChristmas: false,
            consist: [],
          },
        });
      });

      tsv1.lines[finalTrain.lineCode].hasActiveTrains = true;

      tsv1.trains[runNumber] = finalTrain;
    });

    const lastUpdated = now.toISOString();

    tsv1.lastUpdated = lastUpdated;

    return {
      tsv1,
      lastUpdated: lastUpdated,
    };
  } catch (e) {
    console.log(e);
    return false;
  }
};

exports.update = update;
