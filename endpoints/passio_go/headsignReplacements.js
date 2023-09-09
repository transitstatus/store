const headsignReplacements = {
  rutgers: {
    "4056": {
      nameShort: "penn",
      replacements: {
        '10066': 'Newark Penn',
        '10057': 'Newark Penn',
        '10079': 'Newark Penn',
        '10054': 'Newark Penn',
        '10033': 'Newark Penn',
        '10090': 'Newark Penn',
        '10027': 'Newark Penn',
        '10053': 'Newark Penn',
        '10098': 'Hospital Campus'
      }
    },
    "4063": {
      nameShort: "connect",
      replacements: {
        '10055': 'Newark Main Campus',
        '10053': 'Newark Main Campus',
        '10093': 'Newark Main Campus',
        '10058': 'Broad Street Station',
        '10074': 'Broad Street Station',
        '10076': 'Hospital Campus',
        '10050': 'Hospital Campus',
        '10047': 'Hospital Campus',
        '10056': 'Hospital Campus',
        '10090': 'Hospital Campus',
        '10033': 'Hospital Campus',
      }
    },
    "4067": {
      nameShort: "c",
      replacements: {
        '10039': 'Stadium West Lot',
        '21050': 'Stadium West Lot',
        '10060': 'Allison Road Classrooms',
        '10034': 'Allison Road Classrooms',
      }
    },
    "4088": {
      nameShort: "ccexp",
      replacements: {
        '10056': 'Hospital Campus',
        '10053': 'Newark Main Campus',
        '10058': 'Broad Street Station',
        '10074': 'Broad Street Station',
      }
    },
    "4098": {
      nameShort: "pennexpr",
      replacements: {
        '10066': 'Newark Penn',
        '10053': 'Newark Penn',
        '10098': 'Hospital Campus'
      }
    },
    "26280": {
      nameShort: "on1",
      replacements: {
        '10035': 'Busch Campus',
        '27767': 'Busch Campus',
        '10038': 'Busch Campus',
        '10034': 'Livingston Campus',
        '10041': 'Livingston Campus',
        '10052': 'Livingston Campus',
        '10071': 'College Ave Campus',
        '10029': 'College Ave Campus',
        '10065': 'College Ave Campus',
        '12913': 'Cook/Douglass Campus',
        '10037': 'College Ave Campus',
        '10059': 'College Ave Campus',
        '10042': 'College Ave Campus',
        '10026': 'College Ave Campus',
        '10061': 'College Ave Campus',
        '10036': 'College Ave Campus',
        '62662': 'College Ave Campus',
      }
    },
    "26281": {
      nameShort: "on2",
      replacements: {
        '10035': 'Cook/Douglass Campus',
        '27767': 'Cook/Douglass Campus',
        '10075': 'Cook/Douglass Campus',
        '10037': 'College Ave Campus',
        '10059': 'College Ave Campus',
        '10042': 'College Ave Campus',
        '10026': 'College Ave Campus',
        '10061': 'College Ave Campus',
        '10036': 'College Ave Campus',
        '10038': 'Livingston Campus',
        '10071': 'Busch Campus',
        '10029': 'Busch Campus',
        '10065': 'Busch Campus',
        '10052': 'College Ave Campus',
        '10039': 'College Ave Campus',
        '21050': 'College Ave Campus',
      }
    },
    "26435": {
      nameShort: "wknd1",
      replacements: {
        '10035': 'Busch Campus',
        '27767': 'Busch Campus',
        '10038': 'Busch Campus',
        '10034': 'Livingston Campus',
        '10041': 'Livingston Campus',
        '10052': 'Livingston Campus',
        '10071': 'College Ave Campus',
        '10029': 'College Ave Campus',
        '10065': 'College Ave Campus',
        '12913': 'Cook/Douglass Campus',
        '10037': 'College Ave Campus',
        '10059': 'College Ave Campus',
        '10042': 'College Ave Campus',
        '10026': 'College Ave Campus',
        '10061': 'College Ave Campus',
        '10036': 'College Ave Campus',
        '62662': 'College Ave Campus',
      }
    },
    "26436": {
      nameShort: "wknd2",
      replacements: {
        '10035': 'Cook/Douglass Campus',
        '27767': 'Cook/Douglass Campus',
        '10075': 'Cook/Douglass Campus',
        '10037': 'College Ave Campus',
        '10059': 'College Ave Campus',
        '10042': 'College Ave Campus',
        '10026': 'College Ave Campus',
        '10061': 'College Ave Campus',
        '10036': 'College Ave Campus',
        '10038': 'Livingston Campus',
        '10071': 'Busch Campus',
        '10029': 'Busch Campus',
        '10065': 'Busch Campus',
        '10052': 'College Ave Campus',
        '10039': 'College Ave Campus',
        '21050': 'College Ave Campus',
      }
    },
    "37199": {
      nameShort: "allcamp",
      replacements: {
        '10035': 'Busch Campus',
        '27767': 'Busch Campus',
        '10038': 'Busch Campus',
        '10034': 'Livingston Campus',
        '10041': 'Livingston Campus',
        '10052': 'Livingston Campus',
        '10071': 'College Ave Campus',
        '10029': 'College Ave Campus',
        '10065': 'College Ave Campus',
        '12913': 'Cook/Douglass Campus',
        '10037': 'College Ave Campus',
        '10059': 'College Ave Campus',
        '10042': 'College Ave Campus',
        '10026': 'College Ave Campus',
        '10061': 'College Ave Campus',
        '10036': 'College Ave Campus',
        '62662': 'College Ave Campus',
      }
    },
    "41231": {
      nameShort: "Cam",
      replacements: {
        '22107': 'Camden',
        '22103': 'Camden',
        '22104': 'Camden',
        '23404': 'Camden',
        '22105': 'Camden',
        '22106': 'Camden',
      }
    },
    "43397": {
      nameShort: "bhe",
      replacements: {
        '10029': 'Busch Campus',
        '10065': 'Busch Campus',
        '10096': 'Busch Campus',
        '10052': 'Livingston Campus',
        '10039': 'Livingston Campus',
        '10034': 'Livingston Campus',
        '10071': 'Busch Campus',
      }
    },
    "43398": {
      nameShort: "lx",
      replacements: {
        '10035': 'Livingston Campus',
        '27767': 'Livingston Campus',
        '10038': 'Livingston Campus',
        '10071': 'College Ave Campus',
        '10029': 'College Ave Campus',
        '10065': 'College Ave Campus',
      }
    },
    "43430": {
      nameShort: "a",
      replacements: {
        '10035': 'Busch Campus',
        '27767': 'Busch Campus',
        '10038': 'Busch Campus',
        '10060': 'College Ave Campus',
        '10034': 'College Ave Campus',
        '10041': 'College Ave Campus',
        '10052': 'College Ave Campus',
        '10089': 'College Ave Campus',
      }
    },
    "43431": {
      nameShort: "ee",
      replacements: {
        '10035': 'Cook/Douglass Campus',
        '27767': 'Cook/Douglass Campus',
        '10075': 'Cook/Douglass Campus',
        '10037': 'College Ave Campus',
        '10059': 'College Ave Campus',
        '10042': 'College Ave Campus',
        '10026': 'College Ave Campus',
        '10061': 'College Ave Campus',
        '10036': 'College Ave Campus',
        '62662': 'College Ave Campus',
        '10038': 'Cook/Douglass Campus',
      },
    },
    "43440": {
      nameShort: "h",
      replacements: {
        '10035': 'Busch Campus',
        '27767': 'Busch Campus',
        '10038': 'Busch Campus',
        '10089': 'College Ave Campus',
        '10052': 'College Ave Campus',
        '10039': 'College Ave Campus',
        '21050': 'College Ave Campus',
        '10060': 'College Ave Campus',
      },
    },
    "43441": {
      nameShort: "rexl",
      replacements: {
        '10037': 'Livingston Campus',
        '10059': 'Livingston Campus',
        '10036': 'Livingston Campus',
        '10071': 'Cook/Douglass Campus',
        '10029': 'Cook/Douglass Campus',
      }
    },
    "43711": {
      nameShort: "rexb",
      replacements: {
        '10037': 'Busch Campus',
        '10059': 'Busch Campus',
        '10036': 'Busch Campus',
        '10034': 'Cook/Douglass Campus',
        '10039': 'Cook/Douglass Campus',
        '21050': 'Cook/Douglass Campus',
      },
    },
    "43973": {
      nameShort: "b",
      replacements: {
        '10029': 'Busch Campus',
        '10065': 'Busch Campus',
        '10034': 'Livingston Campus',
        '10041': 'Livingston Campus',
        '10052': 'Livingston Campus',
        '10071': 'Busch Campus',
      }
    },
    "43974": {
      nameShort: "f",
      replacements: {
        '10037': 'College Ave Campus',
        '10059': 'College Ave Campus',
        '10036': 'College Ave Campus',
        '10038': 'Cook/Douglass Campus',
        '27767': 'Cook/Douglass Campus',
      }
    }
  }
};

module.exports = headsignReplacements;