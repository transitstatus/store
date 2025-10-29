var app_name = '';
var app_promo_url = '';
var inited = 0, mapIsReady = 0;
var isIE = false, isMobile = false, isSafari = false, isFirefox = false;;
var map, gmapTrLayer = null, transitLayer = null;
var simplifiedStyle, noStationStyle;
var stopMarkers = [], stopMarkerCluster = null, routePaths = [], busMarkers = [], busMarkersTargets = [], busMarkers2 = [];//test 12082020 routeColor=[];
var suggestionsStops = [], suggestionsStopsAndBuses = [], bounceMarkerTimeout;
var clickMarker = null, myMarker = null, destMarker = null;
var passioBuiltRoutes = null, builtPathPolylines = null; //passio path
var googleBuiltRoutes = null, builtGPathPolylines = null;//google path
var google2BuiltRoutes = null, builtG2PathPolylines = null;//google path to destination
var excludedRoutes = [], excludedRoutesHash = ""
var queryBusesTimer = null;
var routesQueryJson = null;
var lastStopETAjsonObject = null, markerStopETA = null, markerPredictRoute = null;
var busMarkerScale = 1.0;
var minBusQueryInterval = 7000
var getBusesMicrotime = 0.0, getBusesMicrotimeCount = 0;
var bounds;
var routeColors = [];
var systemsJson, routesJson, routesJsonFull, routes, stops, groupRoutes, buses, routePoints, selectedRoutes = [];
var IPcoords = {};
var messaging;
var deviceId = 0;
var Gx = 888, Gy = 999;
var pushTexts = [];
var routeListWasChanged = 0;
var infoWindowWidth = 400/*not 470 client asked smaller 25082020*/, infoWindowHeight = 400, infoWindowPinnedLeft = false;
var infowindow = null, letInfowindowBeClosed = false, infoWindowReopened = false;
var localeKm = true;
var heatmap;
var busIconDefImg, circle_big_w_arrow;
var alertNewIds = [];
var alertAllReadIds = [];
var selectedJSGridrow;
var shownAllRoutesHiddenHint = false;
var timelineIsActive = false;
var askedAgencyOptions = 0, lastAskedAgencyOptions = -1;
var lastZoom = 99;
var unhighlighRouteTimer;
var blinkedStopMarker;
var fastETArefreshInterval;
var mapPanMoratorium = false;
var systemsToggled = false;
var tintCanvas, tintCtx, Canvas, Ctx;
var newRouteUIdimmedOpacity = 0.5;//0.5 since 18032025 Scott asked, was 0.3
let newRouteUIdimmedWeight = 4;//4 since 18032025 Scott asked. Was 2 too few    default active width is 5
let newRouteUIactiveWeight = 6;//6 since 18032025 Scott asked. 5
let stopMarkerZoomVisibilityTreshold = 15  //14 too much 18092021
var kmlLayer;
var wait4Email2bVerified = 0, wait4Email2bVerifiedTimer;
var wait4DeviceAuth2bVerified = 0, wait4DeviceAuth2bVerifiedTimer, pinAuthPublic;
let stopsRR = [], routesRR = [] //11102023 , routeSchedules=[];
//08022022 if ((localStorage.optionNewUI2=="" || localStorage.optionNewUI2==undefined) && localStorage.newRouteUIpromptNever!=1) localStorage.optionNewUI2=1;//by default since Mar 2021
//29122023 var newRouteUI=1//08022022 localStorage.optionNewUI2==1?1:0;//was asking since Sep 2020
var NotifTimer;
let excludedWereAsked = -99999
let alertsWereAsked = -99999
let tabClicks = 0
let rideRequestJO = null, rrTImer = null

function load() {
  if (location.protocol != 'https:' && window.location.href.indexOf("passiogo.com") >= 0)
    location.href = 'https:' + window.location.href.substring(window.location.protocol.length);

  let urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("boldRoutes") > 0) {
    newRouteUIdimmedOpacity = 0.5
    newRouteUIdimmedWeight = 4
  }
  //console.log("load: urlParams=",urlParams,"newRouteUIdimmedOpacity="+newRouteUIdimmedOpacity)

  //set at first cus TOS
  $("#messagesCloseBtn").on('click', function () {
    toggleMessages();
  });
  $("#termsCloseBtn").on('click', function () {
    $("#terms").hide();
  });
  $("#loginCloseBtn").on('click', function () {
    $("#login").hide();
  });
  $("#navigatorCloseBtn").on('click', function () {
    $("#navigator").hide();
  });
  $(".popupDimmer").on('click', function () {
    //close any popups
    $("#navigator").hide();
    $("#terms").hide();
    $("#login").hide();
  });
  $(document).keyup(function (e) {
    //console.log("e.keyCode="+e.keyCode)
    if (e.keyCode == 27) {
      //ESC - close any popups
      $("#navigator").hide();
      $("#terms").hide();
      $("#login").hide();
      if ($("#messages").css("display") != "none") $("#messages").hide()
      if ($("#bottomPanel").hasClass("bottomPanelOpen")) $("#bottomPanel").removeClass("bottomPanelOpen");
      $.noty.closeAll();
    }
    /*if (e.keyCode==83 && (e.ctrlKey)){
        e.preventDefault();
        $('.menu-btn').click()
    }*/
    if (e.keyCode == 9) {
      //detect accessibility needs
      tabClicks++
      if (tabClicks >= 5 && localStorage.optionAccessibilityMode != 1 && localStorage.optionAccessibilityModeAsked != 1 && !$("#noty_center_layout_container").length) {
        tabClicks = 0
        noty({
          force: true, layout: 'center', type: 'warning', timeout: false, modal: true, killer: true,
          text: "Turn on Accessibility mode?<br><br>We noted you are using TAB frequently. If you wish, you may toggle Accessibility mode in Settings",
          buttons: [
            {
              addClass: 'btn btn-default', text: 'Not now', onClick: function ($noty) {
                localStorage.optionAccessibilityModeAsked = 1
              }
            },
            {
              addClass: 'btn btn-danger', text: 'Turn on and reload', onClick: function ($noty) {
                localStorage.optionAccessibilityMode = 1
                setTimeout(function () { location.reload(true); }, 750)
              }
            }],
          callback: { afterShow: function () { $("#noty_center_layout_container").find("button").focus() } },
        })
      }
    } else if (tabClicks > 0) tabClicks-- //*/
  });
  $("#accessibilityHint").tooltip()

  if (localStorageGarbageCollector()) return

  //if (inIframe()) console.log("iframe embedded!");
  $.getJSON(myServer() + "goServices.php?goWebVer=1")
    .done(function (data) {
      console.log("Version " + (data ? data.ver : data))
      var relo = data.ver > (localStorage.softwareVer | 0) && localStorage.softwareVer > 0
      localStorage.softwareVer = data.ver
      if (relo) {
        console.log("Software update, reloading...");
        setTimeout(function () {
          location.reload(true);
          return;
        }, 500);
      } else {
        //25102023 cuz token uses softwareVer
        if (!deviceId && localStorage.softwareVer > 0) savePseudoTokenToServer()
        initFCM();
      }
    });


  getScreenDimens();
  infoWindowWidth = Math.min(infoWindowWidth, Gx * 0.65);
  infoWindowHeight = Math.min(infoWindowHeight, Gy * 0.65);
  $("#map").height(Gy - 47);

  deviceId = +localStorage.deviceId | 0;

  checkIEandAlert() //fills isMobile

  //
  //
  //settings
  //---------checkboxes
  $("input:checkbox").each(function () {
    if ($(this).data("debug") != "disabled") {
      var id = $(this).prop('id');
      var myopt = localStorage.getItem(id) == 1 ? "true" : "";
      $(this).prop('checked', myopt);
      if (id == "timelineIsActive") {
        timelineIsActive = localStorage.getItem(id) == 1;
        //console.log("checkbox init set "+id+" to "+timelineIsActive);
        return;
      }
    }
  });
  $("input:checkbox").unbind();
  $("input:checkbox").change(function () {
    if ($(this).data("debug") != "disabled") {
      var id = $(this).prop('id');
      var checked = $(this).prop("checked");
      localStorage.setItem(id, checked ? 1 : 0);

      if (id == "optionTrafficLayer") {
        refreshGmapsTrafficLayer();
        return;
      }
      if (id == "timelineIsActive") {
        timelineIsActive = checked;
        //mytoast("Please reload the page");
        return;
      }
      /*08022022 if (id=="optionNewUI2"){
          location.reload(true);
          return;
      }*/
      if (id == "optionTransitLayer") {
        if (!checked && transitLayer != null) {
          transitLayer.setMap(null);
          transitLayer = null;
          map.setOptions({ styles: noStationStyle });
        }
        if (checked && mapIsReady) {
          transitLayer = new google.maps.TransitLayer();
          transitLayer.setMap(map);
          map.setOptions({ styles: [] });
        }
        //console.log("refreshGmapsTrafficLayer , refresh map");
        google.maps.event.trigger(map, 'resize');
        //map.fitBounds();
        return;
      }
      if (id == "optionShowStopname" || id == "optionHideStops") {
        drawStopMarkers();
        return;
      }
      if (id == "optionShowBusname") {
        drawBusMarkers();
        return;
      }
      if (id == "optionLocalLayer") {
        toggleKML();
        return;
      }
      if (id == "optionShowOOS") {
        getRoutes();//drawStopMarkers();
        return;
      }
      if (id == "optionAccessibilityMode") {
        setTimeout(function () { location.reload(true); }, 750)
        return;
      }
    } else {
      setTimeout(function (el) {
        $(el).prop("checked", false);
      }, 350, this);
      mytoast("Demo. Will be implemented soon!", false);
      return;
    }
  });
  //---end of settings
  //$("#optionNewUI2").parent().tooltip();

  $("#seachDiv").children("input").on('keyup', function (e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      navbar2search()
    }
  });

  //if (debug) localStorage.alertAllReadIdAmount=0;//RESET READ MSGS
  if (localStorage.alertAllReadIdAmount > 0) {
    for (var i = 0; i < localStorage.alertAllReadIdAmount; i++) {
      alertAllReadIds.push(+localStorage.getItem("alertAllReadIds" + i));
    }
  }
  //console.log("get localStorage.alertAllReadIdAmount="+localStorage.alertAllReadIdAmount+", alertAllReadIds=",alertAllReadIds);

  $(document).on('fullscreenchange', function (e) {
    if (!window.screenTop && !window.screenY) {
      console.log('not fullscreen1');
    } else {
      console.log('fullscreen1');
    }
    /*doesnt work if (document.fullScreenElement && document.fullScreenElement != null) {
        console.log('fullscreen2');
    } else {
        console.log('not fullscreen2');
    }
    */
  });

  if (debugTimeline) {
    $("#timelineSelector").css("display", "flex");
    $("#timelineDatepicker").val(localStorage.timelineDate);
    $("#timelineDatepicker").datepicker({
      dateFormat: 'yy-mm-dd',
      onSelect: function (date) {
        localStorage.timelineDate = $('#timelineDatepicker').val();
      }
    });
    $("#timelineTimepicker").val(localStorage.timelineTime);
    $('#timelineTimepicker').timepicker({ 'timeFormat': 'H:i:s' }); //http://jonthornton.github.io/jquery-timepicker/
    $('#timelineTimepicker').on('changeTime', function () {
      localStorage.timelineTime = $('#timelineTimepicker').val();
    });
    timelineIsActive = localStorage.timelineIsActive == 1;
  } else {
    timelineIsActive = false;
    $("#timelineSelector").remove()
  }
  //console.log("in the beginning timelineIsActive="+timelineIsActive);


  // Try HTML5 geolocation.
  if (localStorage.optionDoNotLocateMe != 1 && !inIframe()) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (position) {
        var pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        saveMyLocation(pos);
        console.log("my location saved", pos);
      }, function () {
        /*var pos = { //Atlanta
              lat:  33.7678358,
              lng: -84.4906436
        };
        saveMyLocation(pos);29082020 Scott*/
        //console.log("my location is forbidden");
      });
    } else {
      /*29082020 Scott var pos = { //Atlanta
            lat:  33.7678358,
            lng: -84.4906436
      };
      saveMyLocation(pos);//*/
      console.log("my location is unknowable");
    }
  }

  var language = navigator.languages && navigator.languages[0] || // Chrome / Firefox
    navigator.language ||   // All browsers
    navigator.userLanguage; // IE <= 10
  if (language && language.endsWith && language.endsWith("US"))
    localeKm = false;
  //console.log("language="+language+", localeKm="+localeKm);

  //http://ned.im/noty/confirmations.html
  $.noty.defaults = {
    layout: 'bottomRight',
    theme: 'metroui', // defaultTheme or relax metroui
    type: 'information', // alert,success, error, warning, information, notification
    text: '', // can be HTML or STRING
    dismissQueue: true, // If you want to use queue feature set this true
    force: false, // adds notification to the beginning of queue when set to true
    maxVisible: 5, // you can set max visible notification count for dismissQueue true option,
    template: '<div class="noty_message" role="alert"><span class="noty_text"></span><div class="noty_close" tabindex="0"></div></div>',
    timeout: 2500, // delay for closing event in milliseconds. Set false for sticky notifications
    animation: {
      open: { height: 'toggle' }, // or Animate.css class names like: 'animated bounceInLeft'
      close: { height: 'toggle' }, // or Animate.css class names like: 'animated bounceOutLeft'
      easing: 'swing',
      speed: 300 // opening & closing animation speed
    },
    closeWith: ['button'], // ['click', 'button', 'hover', 'backdrop'] // backdrop click will close all notifications
    modal: false, // if true adds an overlay
    killer: false, // if true closes all notifications and shows itself
    callback: {
      onShow: function () { },
      afterShow: function () { },
      onClose: function () { },
      afterClose: function () { },
      onCloseClick: function () { },
      onkeydown: function () { },
    },
    buttons: false // an array of buttons, for creating confirmation dialogs.
  };
  // close button function for noty close by pure accessibility
  $(document).on('keydown', function (e) {
    if (e.key === 'Enter') {
      // Find and trigger the click event on the close button of the modal
      $('.noty_close').click();
    }
  });

  if (localStorage.goUserId > 0)
    checkGoUserToken(function (json) { });

  getSystems();

  if (mapIsReady)
    initMap();//rest actions only there!
  inited = 1;

  setInterval(queryAlerts, 300000); //5min since 18092023 queryAlerts()
  setTimeout(function () {
    $("#audioNewEvent").trigger('load');
    $("#audioArrivedEvent").trigger('load');
    $("#audioCancelEvent").trigger('load');
    queryAlerts();
  }, 2000);

  $("#app_promo_menutitle").parent().hide();
  //$("#menu_item_routes").show();
  //$("#menu_item_routes2").hide();
  $("#menu_item_routes").hide();
  $("#menu_item_routes2").show();
  //routesSelector2(); after stops
  //open on start
  /*setTimeout(function(){
      if (!$('body').hasClass("pushy-open-left")){
          $('.menu-btn').click();
          if (!$("#menu_item_routes2").hasClass("pushy-submenu-open"))
              $("#menu_item_routes2 button").click();
      }
  },3000);*/
  $("#menu_item_map").hide();

  /*setTimeout(function(){
      checkMobileFroPromo(0,function(){
          if (isMobile)
              showQRMobilePromo() //actually, it will be called faster in queryAlerts()
      })
  },30000);    */


  if (localStorage.optionAccessibilityMode == 1) {
    //todo load css 
    Append_To_Head('style', 'css/ADA.css?r=' + Math.random());
  }
}
function initFCM(called) {
  if (location.protocol == 'http:') {
    console.log("FCM not supported, emulate...");
    savePseudoTokenToServer();
    return;
  }
  if (!(typeof firebase === "undefined") && !(typeof firebase.initializeApp === "undefined")) {
    //<!-- /* GCM and Map keys set for PassioGo apps of djdenis@passiotech.com account */ -->
    firebase.initializeApp({
      apiKey: "AIzaSyBDFwwM6SttoIXBjhvFfTGhk2RmdzI2eZQ",
      authDomain: "passiogo-3600b.firebaseapp.com",
      databaseURL: "https://passiogo-3600b.firebaseio.com",
      projectId: "passiogo-3600b",
      storageBucket: "passiogo-3600b.appspot.com",
      messagingSenderId: "308279684022",
      appId: "1:308279684022:web:b13eaed9da3b7e94e32f17"
    });
    // https://firebase.google.com/docs/cloud-messaging/js/client?authuser=0
    //console.log("messaging.isSupported()="+firebase.messaging.isSupported());
    if (firebase.messaging.isSupported()) {
      messaging = firebase.messaging();
      messaging.usePublicVapidKey("BPOhXOSD6-bb0rjTR9tNTMVxvehzvg8tJsr9Mrt0gabrZ3YoBge1MrszZ7FqlhHDUbVbrvp4mFJVhND_84-xIMk");
      messaging.onMessage(function (payload) {
        console.log("FCM  Message received. ", payload);
        console.log(payload.data.title);
        console.log(payload.data.body);
        console.log(payload.data.id);
        console.log(payload.data.icon);
        if (payload.data.body.indexOf("//#") > 0)//todo this part
          queryAlerts();
        else {
          pushTexts.push(payload.data);
          var notification = new Notification(payload.data.title, {
            body: payload.data.body,
            icon: payload.data.icon,
          });
          notification.onclick = function () {
            showMessages();
          };
          //always if ($("#messages").css("display")!="none")
          queryAlerts(true);
        }
      });
      messaging.onTokenRefresh(function () {
        console.log("messaging.onTokenRefresh");
        localStorage.deviceId = 0;
        getGCMToken();
      });

      //https://web-push-book.gauntface.com/common-notification-patterns/
      //navigator.serviceWorker.addEventListener('message', (event) => { //IE can't
      navigator.serviceWorker.addEventListener('message', function (event) {
        console.log('Received a message from service worker: ', event.data);
        if (event && event.data && event.data.message == "showMessages")
          showMessages();
      });
    } else {
      console.log("FCM isn't supported, emulate...");
      savePseudoTokenToServer();
    }
  } else if (called < 10)
    setTimeout(function () {
      console.log("FCM scripts didn't load yet, recall(" + called + ")...");
      initFCM((called | 0) + 1);
    }, 300);
  else {
    console.log("FCM scripts failed to load, emulate...");
    savePseudoTokenToServer();
  }
}


function pushyOnESC() {
  unhighlightAll();
}
function saveMyLocation(pos) {
  console.log("saveMyLocation", pos);
  localStorage.mLastLocationLat = pos.lat;
  localStorage.mLastLocationLng = pos.lng;
  /*removed 23102020 to stay on selected agency if (mapIsReady && !mapPanM oratorium && pos){
      console.log("Stored last map center to my location: lat/lng="+pos.lat+"/"+pos.lng+", map.setCenter!");
      map.setCenter(pos);
  }*/
}

function mapSetReady() {
  //console.log("mapSetReady");
  mapIsReady = 1;
  if (inited)
    initMap();
}
function gm_authFailure() {
  mapIsReady = 0;
  console.log("gm_authFailure");
  /*need to see 26092023 if (goSubdomain!=""){
      location.assign('https://'+goSubdomain+'.passiogo.com');
      return;
  }*/
  urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.get("changeKey")) {
    //silently try
    window.location.search += '&changeKey=1';
  } else {
    noty({
      layout: 'center',
      type: 'error', // alert,success, error, warning, information, notification
      text: "Unfortunately, Google Maps doesn't work on this site. We're working on that.<br><br>",
      timeout: false,
      buttons: [
        {
          addClass: 'btn btn-danger', text: 'Try again', onClick: function ($noty) {
            location.reload(true)
          }
        },
      ]
    });
  }
};
function initMap() {
  var lastCenter = localStorage.lastCenter && localStorage.lastCenter != "" ? localStorage.lastCenter.split(",") : [0, 0, 0];//[parseFloat(localStorage.mLastLocationLat),parseFloat(localStorage.mLastLocationLng),10];
  //console.log("initMap, lastCenter=",lastCenter,"("+localStorage.lastCenter+")");
  if (lastCenter && lastCenter[0]) {
    //console.log(" mapPanMoratorium=true;");
    mapPanMoratorium = true;
    setTimeout(function () {
      mapPanMoratorium = false;
      //console.log(" mapPanMoratorium=false;");
    }, 3000);//18092021, was 7s
  }
  noStationStyle =
    [
      {
        "featureType": "transit.station",
        "stylers": [
          {
            "visibility": "off"
          }
        ]
      },
    ];
  if (!simplifiedStyle) {
    simplifiedStyle = new google.maps.StyledMapType(
      [
        {
          featureType: 'all',
          stylers: [
            { saturation: -50 },
            { weight: 0.1 }
          ]
        },
        {
          elementType: 'labels',
          stylers: [{ lightness: 25 },
            //{visibility: 'off'},
          ]
        },//*/
        {
          featureType: "poi.business",
          stylers: [{ visibility: "off" }],
        },
        {
          "featureType": "transit.station",
          "stylers": [
            {
              "visibility": "off"
            }
          ]
        },
      ],
      { name: 'Simplified' }
    );
  }
  //NY 40.6895219,-74.0464578
  let center = { lat: +lastCenter[0], lng: +lastCenter[1] }
  if (!center.lat || +lastCenter.lat == 0)
    center = { lat: initialLatLng[0], lng: initialLatLng[1] }
  if (!center.lat || +lastCenter.lat == 0)
    center = { lat: 33.7678358, lng: -84.4906436/*Atlanta*/ }
  map = new google.maps.Map(document.getElementById('map'), {
    center: center,
    zoom: +lastCenter[2] > 0 ? +lastCenter[2] : initialZoom > 0 ? initialZoom : 10,
    options: {
      gestureHandling: 'greedy',
      useStaticMap: false,//test. dunno if it helps to something? djd 26102020
      //You should use mapId instead of styles in map options. The useStaticMap option will not work unless styles is removed.
    },
    mapTypeControl: true,
    mapTypeControlOptions: {
      style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
      mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain', 'simplified_map', 'osm']
    },
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.LEFT_CENTER,
    },
    streetViewControl: false,//19092021  https://developers.google.com/maps/documentation/javascript/examples/control-positioning?hl=ru#maps_control_positioning-javascript
    styles: localStorage.optionTransitLayer == 1 ? [] : noStationStyle,
  });
  //console.log("initMap, map=",map);
  //Associate the styled map with the MapTypeId and set it to display.
  map.mapTypes.set('simplified_map', simplifiedStyle);

  //Define OSM map type pointing at the OpenStreetMap tile server
  map.mapTypes.set("osm", new google.maps.ImageMapType({
    getTileUrl: function (coord, zoom) {
      // "Wrap" x (longitude) at 180th meridian properly
      // NB: Don't touch coord.x: because coord param is by reference, and changing its x property breaks something in Google's lib
      var tilesPerGlobe = 1 << zoom;
      var x = coord.x % tilesPerGlobe;
      if (x < 0) {
        x = tilesPerGlobe + x;
      }
      // Wrap y (latitude) in a like manner if you want to enable vertical infinite scrolling
      //return "https://tile.openstreetmap.org/" + zoom + "/" + x + "/" + coord.y + ".png";
      return 'https://passio3.com/www/proxyfier.php?OSM=1&z=' + zoom + '&x=' + x + '&y=' + coord.y;
    },
    tileSize: new google.maps.Size(256, 256),
    name: "OSM",
    maxZoom: 19
  }));
  //(c) for  OSM
  let copyrightDiv = document.createElement("div")
  copyrightDiv.id = "map-copyright"
  copyrightDiv.style.fontSize = "10px"
  copyrightDiv.style.fontFamily = "Roboto, Arial, sans-serif"
  copyrightDiv.style.margin = "0 2px 2px 0"
  copyrightDiv.style.whiteSpace = "nowrap"
  map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(copyrightDiv)
  google.maps.event.addListener(map, "maptypeid_changed", onMapTypeIdChanged);//only for copyright change

  map.setMapTypeId('simplified_map');


  //MyLoc
  var controlDiv = document.createElement('div');
  var firstChild = document.createElement('button');
  firstChild.style.backgroundColor = '#fff';
  firstChild.style.border = 'none';
  firstChild.style.outline = 'none';
  firstChild.style.width = '28px';
  firstChild.style.height = '28px';
  firstChild.style.borderRadius = '2px';
  firstChild.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
  firstChild.style.cursor = 'pointer';
  firstChild.style.marginLeft = '10px';
  firstChild.style.padding = '0px';
  firstChild.title = 'My Location. DblClick to show city center';
  controlDiv.appendChild(firstChild);
  var secondChild = document.createElement('div');
  secondChild.style.margin = '5px';
  secondChild.style.width = '18px';
  secondChild.style.height = '18px';
  secondChild.style.backgroundImage = 'url(img/mylocation-sprite-1x.png)';
  secondChild.style.backgroundSize = '180px 18px';
  secondChild.style.backgroundPosition = '0px 0px';
  secondChild.style.backgroundRepeat = 'no-repeat';
  secondChild.id = 'you_location_img';
  firstChild.appendChild(secondChild);

  firstChild.addEventListener('click', function () {
    var imgX = '0';
    var animationInterval = setInterval(function () {
      if (imgX == '-18') imgX = '0';
      else imgX = '-18';
      $('#you_location_img').css('background-position', imgX + 'px 0px');
    }, 500);
    if (navigator.geolocation) {
      //console.log("My Location click navigator.geolocation yes");
      navigator.geolocation.getCurrentPosition(function (position) {
        var coords = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        if (myMarker) {
          myMarker.setMap(null);
          myMarker = null;
        }
        myMarker = new google.maps.Marker({
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            strokeWeight: 3,
            scale: 10,
            fillColor: "#ffffff",
            fillOpacity: 0.75,
            strokeColor: colorPrimary,
            strokeOpacity: 1,
            labelOrigin: new google.maps.Point(0, 1.7)
          },
          animation: google.maps.Animation.DROP,
          position: coords
        });
        map.panTo(coords);
        map.setZoom(18);
        clearInterval(animationInterval);
        $('#you_location_img').css('background-position', '-144px 0px');
      }, function () {
        //console.log("navigator.geolocation forbidden");
        clearInterval(animationInterval);
        noty({ text: "Location is not allowed. Click <i class=\"glyphicon glyphicon-map-marker\"></i> in the address bar", layout: "bottom" });
      });
    } else {
      //console.log("navigator.geolocation no");
      clearInterval(animationInterval);
      $('#you_location_img').css('background-position', '0px 0px');
    }
  });
  firstChild.addEventListener('dblclick', function () {
    console.log("My Location dblclick");
    setTimeout(function () {
      map.panTo(new google.maps.LatLng(localStorage.centerLat, localStorage.centerLng));
      map.setZoom(15);
      setTimeout(function () {
        storeMapCenter()
      }, 300);
    }, 300);
  });
  controlDiv.index = 1;
  map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(controlDiv);
  //end of MyLoc */    

  google.maps.event.addListener(map, 'dragend', function () {
    $('#you_location_img').css('background-position', '0px 0px');
    storeMapCenter();
  });

  google.maps.Polyline.prototype.getBounds = function () {
    var bounds = new google.maps.LatLngBounds();
    this.getPath().forEach(function (item, index) {
      bounds.extend(new google.maps.LatLng(item.lat(), item.lng()));
    });
    return bounds;
  };

  //for fullscreen mode
  var alertRedString = $("#alertRedString");
  map.controls[google.maps.ControlPosition.TOP_CENTER].push(alertRedString[0]);
  alertRedString.remove();
  var controlFSdivS = "<div id=\"alertRedPopup\" onClick=\"rightMenuClick();\"></div>";
  var controlFSdiv = $(controlFSdivS);
  controlFSdiv[0].index = 1;
  map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(controlFSdiv[0]);

  $("#map").show();
  initMovingMarker();//separate js

  map.addListener('zoom_changed', function () {
    var z = map.getZoom();
    if (stopMarkers && stopMarkers.length > 0
      && ((z >= stopMarkerZoomVisibilityTreshold && lastZoom < stopMarkerZoomVisibilityTreshold)
        || (z < stopMarkerZoomVisibilityTreshold && lastZoom >= stopMarkerZoomVisibilityTreshold) || lastZoom == 99)) {
      //console.log("map: zoom_changed! "+lastZoom+" -> "+map.getZoom()+", we have "+stopMarkers.length+" stopMarkers");
      lastZoom = z;
      for (var y = 0; y < stopMarkers.length; y++) {
        stopMarkers[y].setVisible(z >= stopMarkerZoomVisibilityTreshold);
      }
    }
  });
  map.addListener('click', function (event) {
    if (!closeAllPanels())
      navigationMenu(event);
  });
  map.addListener('rightclick', function (event) {
    //console.log("on map rightclick! letInfowindowBeClosed="+letInfowindowBeClosed);
    if (!closeAllPanels())
      navigationMenu(event);
  });
  map.addListener('center_changed', function () {
    if (/*lastStopETAjsonObject && */infowindow != null && infoWindowPinnedLeft)
      window.setTimeout(function () {
        if (infowindow)
          infowindow.setPosition(map.getCenter());
      }, 300);
  });

  //extra layers
  setTimeout(function () {
    if (localStorage.optionTrafficLayer == 1) {
      gmapTrLayer = new google.maps.TrafficLayer();
      gmapTrLayer.setMap(map);
      refreshGmapsTrafficLayer();
      setInterval(refreshGmapsTrafficLayer, 160000);
    }
    if (localStorage.optionTransitLayer == 1) {
      transitLayer = new google.maps.TransitLayer();
      transitLayer.setMap(map);
    }
    if (localStorage.optionLocalLayer == 1) {
      toggleKML();
    }
  }, 3000);
  //console.log("Map is created");
}

function closeAllPanels() {
  unhighlightAll();
  $.noty.closeAll();
  if ($("#bottomPanel").hasClass("bottomPanelOpen")) {
    closeBottomPanel();
    return true
  }
  if ($('body').hasClass("pushy-open-left")) {
    $('.menu-btn').click()
    return true
  }
  if (letInfowindowBeClosed) {//clustermarker propagate clicks anyway
    closeInfoWindow();
    return true
  }
}
function onMapTypeIdChanged() {
  let newMapType = map.getMapTypeId();
  let copyrightDiv = document.getElementById("map-copyright");
  if (copyrightDiv) {
    let copyrights = {}
    copyrights["OSM"] = "<a target=\"_blank\" href=\"http://www.openstreetmap.org/\">Â© OpenStreetMap</a> contributors"
    if (newMapType in copyrights)
      copyrightDiv.innerHTML = copyrights[newMapType]
    else
      copyrightDiv.innerHTML = ""
  }
}
function storeMapCenter() {
  localStorage.lastCenter = map.getCenter().lat() + "," + map.getCenter().lng() + "," + map.getZoom();
  //console.log("Stored last map center to "+localStorage.lastCenter);
}
function navigationMenuBtn(el) {
  //console.log("navigationMenuBtn: el=",el);
  clickMarker = null;
  navigationMenu({ latLng: { lat: +$(el).data("lat"), lng: +$(el).data("lng") } });
}
function navigationMenu(event) {
  //console.log("navigationMenu: event=",event,"localStorage.goRoutePlannerEnabled=",localStorage.goRoutePlannerEnabled);
  if (localStorage.goRoutePlannerEnabled != 1 && !debug) {
    //console.log("navigationMenu imm ret");
    return;
  }
  var latLng = null;
  if (clickMarker != null) {
    latLng = clickMarker.position;
    clickMarker.setMap(null);
    clickMarker = null;
    if (event.latLng)
      return;
  }
  if (event.latLng) {
    //console.log("navigationMenu toggle, event.latLng=",event.latLng);
    var s = "<div style='font-size:20px;'><center style='font-weight:bold'>Select an action</center><div style='text-align:left;margin-top:15px;'>"
      + "<div><button onClick='navigationMenu(2);' style='cursor:pointer; margin:5px; background:none; border:none; padding:0;' tabindex='1' aria-label='Set as Start Point'><img src='img/ic_person.svg'> Set as Start Point</button></div>"
      + "<div><button onClick='navigationMenu(3);' style='cursor:pointer; margin:5px; background:none; border:none; padding:0;' tabindex='1' aria-label='Set as Destination'><img src='img/ic_finish.svg'> Set as Destination</button></div>";
    /*if (debug){
        s+="<div onClick='navigationMenu(50);' style='cursor:pointer; margin:5px;'><img src='img/ic_finish.svg'> Pick me up here</div>";
    }*/
    s += "</div></div>";
    if (infowindow) infowindow.close();
    infowindow = new google.maps.InfoWindow({
      content: s
    });
    clickMarker = new google.maps.Marker({
      position: event.latLng,
      icon: {
        url: 'img/ic_crosshair.svg',
        anchor: new google.maps.Point(12, 12),
      },
      map: map
    });
    infowindow.open(map, clickMarker);
    return;
  }
  //console.log("navigationMenu selected "+event+", latLng="+latLng);
  if (event == 2 || event == 5) {
    if (myMarker != null) {
      myMarker.setMap(null);
      myMarker = null;
    }
    if (event == 5)
      return;

    localStorage.mLastLocationLat = latLng.lat();
    localStorage.mLastLocationLng = latLng.lng();
    //console.log("navigationMenu: saved lat/lng="+latLng.lat()+"/"+latLng.lng());

    myMarker = new google.maps.Marker({
      position: latLng,
      draggable: true,
      animation: google.maps.Animation.DROP,
      icon: {
        url: 'img/ic_person.svg',
        size: new google.maps.Size(50, 50),
        anchor: new google.maps.Point(25, 45),
      },
      map: map
    });
    myMarker.addListener('click', function () {
      navigationMenu(21);
    });
    if (destMarker != null) {
      navigationMenu(21);
    }
  } else if (event == 3 || event == 4) {
    if (destMarker != null) {
      destMarker.setMap(null);
      destMarker = null;
    }
    if (event == 4)
      return;
    addDestMarker(latLng);

    if (myMarker != null) {
      navigationMenu(31);
    }
  } else if (event == 21 || event == 31) {
    var s = "<div id='navigationInfoWindow' style='font-size:25px;'>"
      + (myMarker != null && destMarker != null ? "<div><button onClick='navigationMenu(1);' style='cursor:pointer; margin:15px; background:none; border:none; padding:0;'><img src='img/ic_navigation.svg'> Run Navigation</button></div>" : "")
      + "<div><button onClick='navigationMenu(" + (event == 21 ? 5 : 4) + ");' style='cursor:pointer; margin:15px; background:none; border:none; padding:0;' aria-label='Delete Marker'><img src='img/ic_delete.svg'> Delete Marker</button></div>";
    //https://developers.google.com/maps/documentation/urls/guide
    if (myMarker != null && destMarker != null)
      s += "<br><a href='https://www.google.com/maps/dir/?api=1"
        + "&origin=" + myMarker.position.lat() + "," + myMarker.position.lng()
        + "&destination=" + destMarker.position.lat() + "," + destMarker.position.lng() + "' target=_NEW);' class='btn btn-link' style='color:#5876A5 !important;' >Start navigation in Google Maps</a>";

    s += "</div>";
    if (infowindow) infowindow.close();
    infowindow = new google.maps.InfoWindow({
      content: s
    });
    infowindow.open(map, event == 21 ? myMarker : destMarker);
  } else if (event == 1) {
    buildRouteFromStartToEndPoint();
  }
}
function addDestMarker(latLng) {
  if (destMarker != null) {
    destMarker.setMap(null);
    destMarker = null;
  }
  destMarker = new google.maps.Marker({
    position: latLng,
    draggable: true,
    animation: google.maps.Animation.DROP,
    icon: {
      url: 'img/ic_finish.svg',
      size: new google.maps.Size(50, 50),
      anchor: new google.maps.Point(20, 50),
    },
    map: map
  });
  destMarker.addListener('click', function () {
    navigationMenu(31);
  });

}


function buildRouteFromStartToEndPoint(mode) {
  if (myMarker == null || destMarker == null) {
    mytoast("Set start and end markers", false);
    return;
  }
  //console.log("buildRouteFromStartToEndPoint! myMarker.position="+myMarker.position);
  $("#navigationInfoWindow").html("Building path...<br><img src='img/loader.gif' style='margin:50px;'>");

  var optionsJson = JSON.parse('{}');
  if (!routesJson || routesJson === undefined || routesJson == null || Object.keys(routesJson).length == 0) { } else {
    var amount = 0;
    var systems = JSON.parse('{}');
    for (var ki = 0; ki < localStorage.length; ki++) {
      var key = localStorage.key(ki);
      var val = localStorage.getItem(key);
      if (key.indexOf("system") == 0 && val == 1) {
        systems["systemSelected" + amount] = key.substr(6);
        amount++;
      }
    };
    systems.amount = amount;
    optionsJson.systems = systems;

    var routesAmount = 0;
    var routes = JSON.parse('{}');
    $.each(routesJson, function (key, val) {
      if (localStorage.getItem('route' + val.myid) == 1) {
        atLeastOneSelected = 1;
        routes["routeSelected" + routesAmount] = val.myid;
        routesAmount++;
      }
    });
    routes.amount = routesAmount;
    optionsJson.routes = routes;
  }
  var sP = JSON.parse('{}');
  sP.lat = myMarker.position.lat();
  sP.lng = myMarker.position.lng();
  var eP = JSON.parse('{}');
  eP.lat = destMarker.position.lat();
  eP.lng = destMarker.position.lng();
  var points = JSON.parse('[]');
  points[points.length] = sP;
  points[points.length] = eP;
  optionsJson.points = points;
  optionsJson.mode = mode ? mode : "transit";

  var s1 = myServer() + "mapGetData.php?walk=" + (debug ? 4 : 2) + "&deviceId=" + deviceId;
  $.postJSON(s1, optionsJson).done(function (data) {
    passioBuiltRoutes = data && data.bestPath ? data.bestPath : null;
    googleBuiltRoutes = data && data.paths && data.paths.status && data.paths.status != "ZERO_RESULTS" ? data.paths : null;
    google2BuiltRoutes = data && data.paths2 && data.paths2.status && data.paths2.status != "ZERO_RESULTS" ? data.paths2 : null;

    //console.log("buildRouteFromStartToEndPoint: google instructions, googleBuiltRoutes is null ?"+(googleBuiltRoutes==null));
    //console.log("buildRouteFromStartToEndPoint: passio instructions, passioBuiltRoutes is null ?"+(passioBuiltRoutes==null));
    //console.log("buildRouteFromStartToEndPoint: google2 instructions, google2BuiltRoutes is null ?"+(google2BuiltRoutes==null));

    var s = "";
    if (!passioBuiltRoutes) {
      var available_travel_modes = data.paths ? data.paths["available_travel_modes"] : null;
      if (!available_travel_modes) {
        s = "Failed to build a navigation path";
      } else {
        s = "<div style='margin:10px; text-align:center'><b>Unfortunately, no bus within walking distance</b><br><br>"
          + "Select from available travel modes:<br><br>";
        $.each(available_travel_modes, function (key, val) {
          s += "<span onClick='buildRouteFromStartToEndPoint(\"" + val + "\");' class='btn btn-default'>" + val + "</span>";
        });
        //s+="<br><br><span class='btn btn-link'>Let Google Maps decide!</span>";
        //https://developers.google.com/maps/documentation/urls/guide
        s += "<br><br><a href='https://www.google.com/maps/dir/?api=1"
          + "&origin=" + myMarker.position.lat() + "," + myMarker.position.lng()
          + "&destination=" + destMarker.position.lat() + "," + destMarker.position.lng() + "' target=_NEW);' class='btn btn-link'>Let Google decides!</a>";
        s += "</div>";
      }
      return;
    }
    if (s != "")
      $("#navigationInfoWindow").html(s);
    else
      closeInfoWindow();

    $(".gm-style-iw").next().click();//close all infowindows
    drawOrListPaths();
  })
    .fail(function (data, msg) {
      console.log("buildRouteFromStartToEndPoint error: " + msg + "," + JSON.stringify(data));
      $("#navigationInfoWindow").html("Error in navigation data");
    });
}


//function drawListAndPathForJson(builtRoutes,builtPolylinesCase){}
//now in drawNavigationPath.js
function drawOrListPaths() {
  if (builtGPathPolylines != null) {
    $.each(builtGPathPolylines, function (key, val) {
      val.setMap(null);
    });
  }
  builtGPathPolylines = [];

  if (builtPathPolylines != null) {
    $.each(builtPathPolylines, function (key, val) {
      val.setMap(null);
    });
  }
  builtPathPolylines = [];

  if (builtG2PathPolylines != null) {
    $.each(builtG2PathPolylines, function (key, val) {
      val.setMap(null);
    });
  }
  builtG2PathPolylines = [];

  if (passioBuiltRoutes == null && googleBuiltRoutes == null) {
    //mytoast("No valid navigation data",false);
    return false;
  }

  //-------------------------------Instructions
  var instr = [];
  //var regex = /(<([^>]+)>)/ig
  var fromS = googleBuiltRoutes && googleBuiltRoutes.routes && googleBuiltRoutes.routes.length && googleBuiltRoutes.routes[0].legs[0]["start_address"]
    ? "From " + googleBuiltRoutes.routes[0].legs[0]["start_address"] : "";

  var toS = google2BuiltRoutes && google2BuiltRoutes.routes && google2BuiltRoutes.routes.length && google2BuiltRoutes.routes[0].legs[0]["end_address"]
    ? google2BuiltRoutes.routes[0].legs[0]["end_address"] : "";
  if (toS == "" && passioBuiltRoutes && passioBuiltRoutes.routes && passioBuiltRoutes.routes.length > 0) {
    var passioPathJAsize = passioBuiltRoutes.routes[passioBuiltRoutes.routes.length - 1].legs.length;
    if (passioPathJAsize > 0)
      toS = passioBuiltRoutes.routes[passioBuiltRoutes.routes.length - 1].legs[passioPathJAsize - 1].stopName
    else
      toS = passioBuiltRoutes.routes[passioBuiltRoutes.routes.length - 1].name;
  }
  if (toS == "") {
    if (googleBuiltRoutes && googleBuiltRoutes.routes.length && googleBuiltRoutes.routes)
      toS = googleBuiltRoutes.routes[0].legs[0]["end_address"];
  }
  if (toS != "") toS = "To " + toS
  instr.push("<br>");

  //console.log("google instructions, builtGPathPolylines is null ?"+(builtGPathPolylines==null));
  instr = instr.concat(drawListAndPathForJson(googleBuiltRoutes, -1, 12, 1));

  //console.log("passio instructions, builtPathPolylines is null ?"+(builtPathPolylines==null));
  instr = instr.concat(drawListAndPathForJson(passioBuiltRoutes, 0, 12, 1));

  //console.log("google2 instructions, builtG2PathPolylines is null ?"+(builtG2PathPolylines==null));
  instr = instr.concat(drawListAndPathForJson(google2BuiltRoutes, 1, 12, 1));

  var s = "<div style='font-size:18px;'>";
  s += (fromS != "" ? fromS + "<br>" : "") + (toS != "" ? toS + "<br>" : "");
  $.each(instr, function (key, val) {
    s += val;
  });
  s += "</div>"  //+"<button class='btn btn-danger btn-sm' onClick='stopNavigation();'>Stop navigation</button>";
  $("#navigatorView").html(s);
  $("#rightMenuNavigator").show();
}
function stopNavigation() {
  if (myMarker != null) {
    myMarker.setMap(null);
    myMarker = null;
  }
  if (destMarker != null) {
    destMarker.setMap(null);
    destMarker = null;
  }
  passioBuiltRoutes = null;
  googleBuiltRoutes = null;
  google2BuiltRoutes = null;
  drawOrListPaths();

  if ($("#navigator").css("display") != "none")
    $("#navigator").hide();
}
function refreshGmapsTrafficLayer() {
  if (!mapIsReady) {
    return;
  }
  if (localStorage.optionTrafficLayer != 1) {
    if (gmapTrLayer != null) {
      gmapTrLayer.setMap(null);
      gmapTrLayer = null;
    }
  } else {
    //console.log("refreshGmapsTrafficLayer turn on and refresh");
    //if (gmapTrLayer!=null)
    //    gmapTrLayer.setMap(null);
    if (gmapTrLayer == null) {
      console.log("refreshGmapsTrafficLayer , oh, created!");
      gmapTrLayer = new google.maps.TrafficLayer();
      gmapTrLayer.setMap(map);
    }
    //console.log("refreshGmapsTrafficLayer , refresh map");
    google.maps.event.trigger(map, 'resize');
    //map.fitBounds();
  }
}

function toggleAllTitleActions(show) {
  //console.log("closeTitleActions: show="+show);
  if (show) {
    //reset to default map view
    $("#favDropdown").show();
    $("#seachDiv").show();
    $("#seachDiv input").val("");
    $("#seachDiv input").attr("placeholder", "Search a Stop or Bus...");
    $("#rightMenuMessages").show();
    $("#dotMenuDropdown").hide();
    if ($("#messages").css("display") != "none") {
      toggleMessages();
    }
  } else {
    $('#rightMenuPanel').children('button').each(function () {
      $(this).hide();
    });
    $("#favDropdown").hide();
    $("#seachDiv").hide();
  }
}
function pushyOnBeforeToggle(el) {
  //console.log("pushyOnBeforeToggle: systemsToggled?"+systemsToggled);
  var allowToToggle = true;
  var opened = ($('body').hasClass('pushy-open-left') || $('body').hasClass('pushy-open-right'));
  //console.log("pushyOnBeforeToggle: pushy opened="+opened+", allowToToggle="+allowToToggle);
  toggleAllTitleActions(true);//reset,show defaults

  //in new UI systems are just hover screen with back btn
  if (!el || ($("#systemSelector").css("display") != "none" && $(".hamburger").hasClass("is-active"))) {
    $(".hamburger").removeClass("is-active");
    $("#systemSelector").hide('slide', { direction: 'left' }, 150);
    if (systemsToggled) {//firsttime routesactualized notactualized resetroutes resetsystems
      systemsToggled = false
      busesWereQueried = -1
      excludedWereAsked = -99999
      alertsWereAsked = -99999
      gotBusesTime = -99999
      app_name = "";
      app_promo_url = "";
      localStorage.lastCenter = ""; //console.log("Stored center was reset");
      //console.log("pushyOnBeforeToggle calls checkAtLeastOneSystemIsSelected");
      checkAtLeastOneSystemIsSelected();
      queryAlerts();
      updateUI(false);
      //WTF?13032024 wsBusIds=[]//reset and resubscribe!
    } else
      updateUI(true);
    allowToToggle = false;
  }
  return allowToToggle;
}
function pushyOnToggle(el) {
  //console.log("pushyOnToggle: systemsToggled?"+systemsToggled);
  var id = el ? $(el).prop('id') : 0;
  var opened = ($('body').hasClass('pushy-open-left') || $('body').hasClass('pushy-open-right'));
  //console.log("pushyOnToggle: pushy opened="+opened+",  id="+id);

  $(".pushy_wider").removeClass("pushy_wider");
  $(".pushy-open-left_wider").removeClass("pushy-open-left_wider");
  opened ? $(".hamburger").addClass("is-active") : $(".hamburger").removeClass("is-active");
  /*dzntwrk, use tabindex if (opened) { //accessibility
      //$("#menu_item_routes2").find("button").attr("tabIndex", "1")
      $("#menu_item_routes2").find("button").focus()
  }*/
  //console.log("menu_item_routes2 button",$("#menu_item_routes2").find("button").length)

  if (!opened && el && el != undefined && el != null) {
    toggleAllTitleActions(true);//reset,show defaults

    if ($("#systemSelector").css("display") != "none") {
      $("#systemSelector").hide('slide', { direction: 'left' }, 150);
    }
    if ($("#routeSelector").css("display") != "none") {
      $("#routeSelector").hide('slide', { direction: 'left' }, 150);
      if (routeListWasChanged) {
        getRoutes();
      }
    }
    $("#headerTitle").html(app_name);

    //harmless popups w/o fullscreen
    if ($(el).data("debug") == "disabled") {
      mytoast("Demo. Will be implemented soon!", true);
      return;
    } else if (id == "menu_item_messages") {
      showMessages();
      return;
    } else if (id == "menu_item_terms") {
      openTerms();
      return;
    } else if (id == "menu_item_login") {
      openLogin();
      return;
    } else if (id == "menu_item_feedback") {
      openFeedback();
      return;
    } else if (id == "menu_item_report") {
      openEmail();
      return;
    }

    //Finally, fullscreens
    if (id == "menu_item_agencies") {
      menu_item_agencies();
    } else if (id == "menu_item_routes") {
      toggleAllTitleActions(false);//hide all
      routesSelector();
    } else {
      //map
      setTimeout(function () {
        fillSuggestionsStops();
      }, 300);
    }
  }
}
function pushyOnToggleSub(el) {
  var id = el ? $(el).prop('id') : 0;
  var subOpened = $(el).hasClass("pushy-submenu-open");
  $(".pushy_wider").removeClass("pushy_wider");
  $(".pushy-open-left_wider").removeClass("pushy-open-left_wider");
  //console.log("pushyOnToggle: subOpened="+subOpened+", id="+id);
  if (subOpened && el && el != undefined && el != null) {
    if (id == "menu_item_routes2") {
      if (subOpened)
        setTimeout(function () {
          if (!$(".pushy").hasClass("pushy_wider")) {
            $(".pushy").addClass("pushy_wider");
            $(".site-header").addClass("pushy-open-left_wider");
          }
        }, 150);// */
      //routesSelector2(); 
    }
  }
}
function fillSuggestionsStops() {
  if (!suggestionsStops.length && stops) {
    //console.log("fillSuggestionsStops will sort stops",Object.keys(stops).length)
    $.each(stops, function (key, stop) {
      suggestionsStops.push({
        label: stop.name + " (" + stop.routeName + ")",
        value: stop.name,
        lat: stop.latitude,
        lng: stop.longitude,
        id: stop.id,
        type: "stop"
      });
    });
    suggestionsStops.sort(function (a, b) {
      if (a.value > b.value) return 1;
      if (a.value < b.value) return -1;
      return 0;
    })
    //console.log("fillSuggestionsStops done")
  } else if (!stops) console.error("fillSuggestionsStops no stops!", stops)//debug
  //if (!suggestionsStops.length) return
  //console.log("fillSuggestionsStops: suggestionsStops=",suggestionsStops);
  fillSuggestionsStopsAndBuses()
}
function fillSuggestionsStopsAndBuses() {
  suggestionsStopsAndBuses = suggestionsStops.map(a => ({ ...a })) //suggestionsStopsAndBuses=suggestionsStops
  if (buses)
    $.each(buses, function (deviceId, bus) {
      if (bus[0].busId)
        suggestionsStopsAndBuses.push({
          label: "Bus " + bus[0].busName,
          value: bus[0].busName,
          lat: bus[0].latitude,
          lng: bus[0].longitude,
          id: bus[0].busId,
          type: "bus"
        });
    })
  //console.log("fillSuggestionsStopsAndBuses recalc: "+suggestionsStops.length+" vs "+suggestionsStopsAndBuses.length+" (stops "+(stops?Object.keys(stops).length:0)+", buses "+(buses?Object.keys(buses).length:0)+")",suggestionsStopsAndBuses)


  //https://api.jqueryui.com/autocomplete/
  $("#seachDiv input").autocomplete({
    source: suggestionsStopsAndBuses,
    autoFocus: true,
    minLength: 0,
    /*classes: {
      "ui-autocomplete": "ui-autocomplete-z-order"
    },//*/
    select: function (event, ui) {
      //console.log("suggestionsStopsAndBuses selected: ",ui.item,"this=",this);
      //$(this).val(ui.item.label);
      //$('#cleaning2address').data("id",ui.item.id);
      searchBusStopFound(ui.item)
    }
  }).on('focus', function (event) {
    //console.log("suggestionsStopsAndBuses focus");
    if (suggestionsStopsAndBuses.length < 50) $(this).autocomplete("search", "");
  }).on('click', function (event) {
    // console.log("suggestionsStopsAndBuses click");
    if (suggestionsStopsAndBuses.length < 50) $(this).autocomplete('search', "");
  });
}
function navbar2search(reset) {
  if (!reset) {
    $('#seachDiv').find("i.glyphicon-search").hide();
    $('#seachDiv').find("i.glyphicon-remove").show();
  } else {
    $('#seachDiv input').val("");
    $('#seachDiv').find("i.glyphicon-search").show();
    $('#seachDiv').find("i.glyphicon-remove").hide();
    if (selectedJSGridrow)
      selectedJSGridrow.removeClass("highlight");
    return;
  }
  var val = $.trim($('#seachDiv input').val()).toLowerCase() //strtolower strlow
  if ($("#systemSelector").css("display") != "none") {
    $.each($("#systemSelectorGrid").jsGrid("option", "data"), function (key, obj) {
      if (obj["fullname"] && obj["fullname"].toLowerCase().indexOf(val) >= 0) {
        //var page=Math.floor(key/20)+1;
        //$(tablename).jsGrid("openPage",page);
        var args = {};
        args.item = obj;
        args.dontClick = 1;
        $("#systemSelectorGrid").jsGrid("rowClick", args);
        if (selectedJSGridrow && $(selectedJSGridrow) && $(selectedJSGridrow)[0]) {
          //$(selectedJSGridrow)[0].scrollIntoView({block: "start", inline: "nearest", behavior:"smooth"});
          $(selectedJSGridrow)[0].scrollIntoViewIfNeeded(true);
          $(selectedJSGridrow).effect("shake");
        }
        return false;//break
      }
    });
  } else {
    let found = false
    $.each(suggestionsStopsAndBuses, function (key, item) {
      if (item.label.indexOf(val) >= 0 || (item.value && item.value.indexOf(val) >= 0)) {
        found = true
        searchBusStopFound(item)
        return false//break
      }
    })
    if (!found && val.length > 1 && val.length < 10)
      mytoast("Not found<br><br><span onclick='whereIsMyBus()' style='color:#8080ff; font-size:12px; opacity:0.75; cursor:pointer;' title='Search deeper and explain why it is not shown (experimental)'>Where is my bus " + val + "?</span>", true, true)
  }
}
function searchBusStopFound(item) {
  $('#seachDiv').find("i.glyphicon-search").hide();
  $('#seachDiv').find("i.glyphicon-remove").show();
  if (item.type == "stop") {
    zoomToStop(null, item.id);
  } else if (item.type == "bus" && buses) {
    $.each(buses, function (deviceId, bus) {
      if (bus[0].busId == item.id) {
        map.setZoom(18);//animateMapZoomTo(map,16); 
        map.panTo(new google.maps.LatLng(+bus[0].latitude, +bus[0].longitude));
        return false//break
      }
    })
  } else {
    map.setZoom(19);//animateMapZoomTo(map,16); 
    map.panTo(new google.maps.LatLng(+item.lat, +item.lng));
  }
}
function whereIsMyBus() {
  var s = myServer() + "mapGetData.php?getBuses=2&search=" + $.trim($('#seachDiv input').val())
  $.postJSON(s, routesQueryJson).always(function (data) {
    s = !data || !data.search ? "Server error" : data.error ? data.error : data.search.text ? data.search.text : "We have no answer..."
    mytoast(s, true, true, 15000)
    if (data && data.search && data.search.lat) {
      map.setZoom(19);//animateMapZoomTo(map,16); 
      map.panTo(new google.maps.LatLng(+data.search.lat, +data.search.lng));
    }
  })
}


function openFeedback() {
  if (!localStorage.systemSelectedUsername0 || localStorage.systemSelectedUsername0 == "") {
    mytoast("No agency selected", true);
    return;
  }
  if (isMobile) {
    window.open("https://" + passiohost + "/busBuzz/" + localStorage.systemSelectedUsername0)
    return
  }
  if (Modernizr.flexbox)
    $("#terms").fadeIn("fast").css("display", "flex");
  else
    $("#terms").show();//*/
  //$("#terms").css("display","flex");

  $("#termsView").html("<iframe src='https://" + passiohost
    //+"/busBuzz/"
    + "/www/goRedirect.php?busBuzz="
    + localStorage.systemSelectedUsername0 + "' width=100% height=75% style='border:0;"
    + "height: " + $("#termsView").height() + "px;"
    + "margin-top: 50px;'></iframe>");
}
function openEmail() {
  //You have no default email client installed!"

  var agencyEmail = localStorage.agencyEmail && localStorage.agencyEmail != "" ? localStorage.agencyEmail : "support@passiotech.com";
  var browserInfo = getBrowserInfo();
  var s = "Please describe your problem:\n\n\n------------\nDo not remove this line!\nAgency " + localStorage.systemSelectedUsername0 + ", " + browserInfo;
  s = 'mailto:' + agencyEmail + '?subject=' + encodeURI("Question from passiogo.com") + '&body=' + encodeURI(s);
  window.open(s);
}
function getBrowserInfo() {
  var ua = navigator.userAgent, tem,
    M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
  if (/trident/i.test(M[1])) {
    tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
    return 'IE ' + (tem[1] || '');
  }
  if (M[1] === 'Chrome') {
    tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
    if (tem != null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
  }
  M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
  if ((tem = ua.match(/version\/(\d+)/i)) != null)
    M.splice(1, 1, tem[1]);
  return M.join(' ');
}
function openTerms() {
  if (Modernizr.flexbox)
    $("#terms").fadeIn("fast").css("display", "flex");
  else
    $("#terms").show();
  $("#termsView").html("<iframe src='https://" + passiohost + "/www/mapGetData.php?terms=1' style='border:0;width:100%;height:49vh;/*a bit less than min-height of parent*/'></iframe>");
}
function openLogin(called) {
  //console.log("openLogin("+called+") typeof showLogin="+typeof showLogin);
  if (typeof showLogin === "undefined") {
    if (!called) {
      Append_To_Head('style', 'css/materialInput.css?r=' + Math.random());
      Append_To_Head('style', 'css/login.css?r=' + Math.random());
      Append_To_Head('script', 'js/login.js?r=' + Math.random());
      Append_To_Head('script', 'js/sha256.js');
    }
    setTimeout(function () {
      openLogin(1);
    }, 250);
    return;
  }
  showLogin();
}

function toggleMessages() {
  if ($("#messages").css("display") == "none") {
    showMessages();
  } else {
    $("#messages").hide("slide", { direction: "right" }, 250);//.hide();
  }
}
function showMessages() {//open window
  if (Modernizr.flexbox)
    $("#messages").show("slide", { direction: "right" }, 300);//.fadeIn("fast");//.css("display","flex");
  else
    $("#messages").show();

  if (alertNewIds.length > 0) {
    for (var i = 0; i < alertNewIds.length; i++)
      alertAllReadIds.push(alertNewIds[i]);
    alertNewIds = [];
  }
  localStorage.alertAllReadIdAmount = alertAllReadIds.length;
  if (localStorage.alertAllReadIdAmount > 0) {
    for (var i = 0; i < localStorage.alertAllReadIdAmount; i++) {
      localStorage.setItem("alertAllReadIds" + i, alertAllReadIds[i]);
    }
  }
  //console.log("save localStorage.alertAllReadIdAmount="+localStorage.alertAllReadIdAmount+", alertAllReadIds=",alertAllReadIds);
  queryAlerts(true);

  $("#rightMenuMessages").removeClass("blink");
  $("#alertRedString").hide();
  $("#alertRedPopup").hide();
  if (document.fullscreenElement === null) {//09112023 these two false in accesibility mode! !window.screenTop && !window.screenY) {
    //console.log('showMessages not fullscreen1');
  } else {
    //console.log('showMessages fullscreen1',document.fullscreenElement);
    if (document.exitFullscreen) document.exitFullscreen();
  }
}
function queryAlerts(refresh) {//loadsystemoptions
  var json = {}
  var amount = 0;
  for (var ki = 0; ki < localStorage.length; ki++) {
    var key = localStorage.key(ki);
    var val = localStorage.getItem(key);
    if (key.indexOf("system") == 0 && val == 1) {
      if (amount == 0) {
        if (lastAskedAgencyOptions == key.substr(6))
          askedAgencyOptions = 1;//dont ask for emails etc
        else {
          askedAgencyOptions = 0; //query them
          lastAskedAgencyOptions = key.substr(6);
        }
      }
      json["systemSelected" + amount] = key.substr(6);
      amount++;
    }
  };
  var routesAmount = 0;
  for (var ki = 0; ki < localStorage.length; ki++) {
    var key = localStorage.key(ki);
    var val = localStorage.getItem(key);
    if (key.indexOf("route") == 0 && val == 1) {
      //console.log("queryAlerts: \"routeSelected\"+amount = "+("routeSelected"+amount)+", key="+key);
      json["routeSelected" + routesAmount] = key.substr(5);
      routesAmount++;
    }
  };
  //console.log("queryAlerts: amount="+amount+", askedAgencyOptions="+askedAgencyOptions);
  if (amount > 0) {
    var s1 = myServer() + "goServices.php?getAlertMessages=1&deviceId=" + deviceId
      + "&alertCRC=" + (refresh ? "na" : localStorage.alertCRC)
      + "&buildNo=" + localStorage.softwareVer
      + (debug ? "&debug2=1" : "")
    if (askedAgencyOptions)
      s1 += "&noOptions=1";
    else
      s1 += "&embedded=" + (inIframe() ? 1 : 0)//+(isMobile || debug?"&isMobile=1":"");
    json.amount = amount;
    json.routesAmount = routesAmount;
    //console.log("queryAlerts: "+s1+"&json=",json);
    if (timelineIsActive) {
      json.timelineIsActive = timelineIsActive;
      json.timelineDatetime = localStorage.timelineDate + " " + localStorage.timelineTime;
    }
    //if (isMobile)  alert(s1)
    $.postJSON(s1, json).done(function (data) {
      if (!askedAgencyOptions) {
        //if (isMobile)  alert("b="+data.fullname)
        localStorage.fullname = data.fullname;//new
        localStorage.homepage = data.homepage;//new
        setLogo(0, data.logoUrl);//localStorage.logoUrl=data.logoUrl;//new
        localStorage.agencyEmail = data.agencyEmail;
        localStorage.agencyPhone = data.agencyPhone
        localStorage.goRoutePlannerEnabled = data.goRoutePlannerEnabled;
        localStorage.goEtaReportEnabled = data.goEtaReportEnabled;
        localStorage.goEtaEnabled = data.goEtaEnabled;
        localStorage.goRideRequestEnabled = data.goRideRequestEnabled;
        localStorage.goBusNamedAsRoute = data.goBusNamedAsRoute //bus is titled on server, but busclick popup - not.
        //?? systemSelectedUsername0
        localStorage.links = JSON.stringify(data.links ? data.links : []);
        localStorage.goColor = data.goColor;
        localStorage.busBuzz = data.busBuzz;
        localStorage.username = data.username;
        localStorage.centerLat = +data.center.latitude;
        localStorage.centerLng = +data.center.longitude;
        //dont!! local! localStorage.testMode=data.goTestMode;
        localStorage.goOsm = data.goOsm;
        localStorage.goSharedCode = data.goSharedCode;
        wsUrl = data.wsUrl ? data.wsUrl : "" //3 states

        if (data.tz)
          $("#localTime span").eq(0).html("Timezone " + data.tz + ", " + (data.tzOffset / 3600) + "h")
        updateUI();
        prepareRideRequest()

        $("#mobileAppBadges").children("a").eq(0).attr("href", data.goMobileAndroidUrl)
        $("#mobileAppBadges").children("a").eq(1).attr("href", data.goMobileIosUrl)
        //console.log("queryAlerts: goMobileAndroidUrl="+data.goMobileAndroidUrl);
        showQRMobilePromo()

        //getbuses will do it! startWebsockets();

      }

      //we fill msgs to mem if new or not filled
      //console.log("queryAlerts: alertCRC:  "+localStorage.alertCRC+" vs new "+data.alertCRC);
      //if (isMobile) $("#messagesView").html("msgs="+(data.msgs?data.msgs.length:-1));
      if ((data.alertCRC && data.alertCRC != localStorage.alertCRC) || (data.msgs && data.msgs.length)) {
        localStorage.alertCRC = data.alertCRC;
        //console.log("queryAlerts: ",data.msgs,"pushTexts:",pushTexts);
        var fullscreen = window.screenTop || window.screenY;
        var importantTextS = [];
        var importantTextSfull = [];
        var restText = "";
        var alertNewIdsIncoming = [];
        var wasUnread = false;
        $.each(data.msgs, function (key, val) {
          var id = +val.id;
          //remove from pushTexts same ids
          if (pushTexts.length > 0) {
            for (var i = pushTexts.length - 1; i >= 0; i--) {
              if (pushTexts[i].id == id) {
                //console.log("queryAlerts: removed same id from pushes: ",pushTexts[i]);
                pushTexts.splice(i, 1);
                break;
              }
            }
          }
          alertNewIdsIncoming.push(id);
          //console.log("queryAlerts("+key+"): ",val);
          if (alertAllReadIds.indexOf(id) < 0) {
            wasUnread = true;
            if (alertNewIds.indexOf(id) < 0 && val.important && importantTextS.length <= 3) {
              //unshown
              importantTextS.push(val.name);
              if (fullscreen)
                importantTextSfull.push("<div style=\"font-size:14px;\">" + val.createdF + "</div>" + val.name + "<br>" + val.html);
            }
          }
          restText += createCloud(val.createdF, val.name, val.html, val.id, val.important == 1 ? "red" : "#A64439");
        });
        alertNewIds = alertNewIdsIncoming;

        wasUnread ? $("#rightMenuMessages").addClass("blink") : $("#rightMenuMessages").removeClass("blink")

        //console.log("queryAlerts: alertAllReadIds=",alertAllReadIds,", wasUnread="+wasUnread+", importantTextS=",importantTextS);
        if (importantTextS.length > 0) { //unshown or old
          $("#alertRedString").show();
          $("#alertRedString span").html(importantTextS.join("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"));
          if (localStorage.optionMuteAlerts != 1) {
            //$("#audioNewEvent").trigger('play');
            var promise = $("#audioNewEvent")[0].play();
            /*if (promise !== undefined) {
                promise.then(_ => {
                    console.log('queryAlerts audioNewEvent play!');
                }).catch(error => {
                    console.log('queryAlerts audioNewEvent can`t play');
                });
            }//*///15072021
          }
          if (fullscreen) {
            //console.log('queryAlerts fullscreen1');
            var s = "<div style=\"text-align:center; font-weight:bold; margin-bottom:20px;\">Message" + (alertNewIds.length > 1 ? "s" : "") + " from the Agency:</div>"
              + importantTextSfull.join("<hr>"); //+"</h3>";
            $("#alertRedPopup").html(s);
            $("#alertRedPopup").show("drop", { "direction": "down" });
          }
        } else if (!wasUnread) {
          $("#alertRedString").hide();
          $("#alertRedPopup").hide();
        }

        if (pushTexts.length > 0) {
          //list pushTexts
          for (var i = pushTexts.length - 1; i >= 0; i--) {//counterwise
            restText = createCloud("New push", pushTexts[i].title, pushTexts[i].body, pushTexts[i].id, "#A64439") + restText;
          }
        }
        //if (isMobile) $("#messagesView").html(restText!=""?"ok":"nope");

        if (typeof Notification != "undefined" && Notification.permission != "granted" && localStorage.optionAccessibilityMode != 1)
          restText = "<div><a href=https://support.google.com/chrome/answer/3220216 target=_new>Enable Notifications to receive messages immediately</a></div>" + restText;
        $("#messagesView").html(restText);
      }
    })
      .fail(function (data, msg) {
        console.log("openMessges error: " + msg + "," + JSON.stringify(data));
      });
  } else {
    $("#messagesView").html("Select an agency first!");
    localStorage.agencyEmail = "";
    localStorage.goRoutePlannerEnabled = 0;
    localStorage.goEtaReportEnabled = 1;
    localStorage.goEtaEnabled = 0;
  }
}

function setLogo(id, logoUrl) {
  if (!logoUrl)
    logoUrl = "https://" + passiohost + "/tdb/binary/user/" + id + "/logo";
  localStorage.logoUrl = logoUrl + "?width=150&r=" + Math.random();
  //console.log("setLogo: localStorage.logoUrl:="+localStorage.logoUrl);
}

function createCloud(created, title, body, id, color) {
  var s = "<div class=\"cloud\" tabindex=\"-1\">"
    + "<span class=\"time\" style=\"color:" + color + ";\">" + created + ":</span>"
    + "<h2>" + title + "</h2>"
    + "<div class=\"body\">" + body + "</div>"
    //+ (id=="" ? "" : "<a class=\"catch-iOS\" href=\"inapp://remove?\(id)\">clear</a>")
    + "</div>"
  return s
}
function openUserLocation(lat, lng) {
  if (!map)
    return;
  if ($("#messages").css("display") != "none")
    $("#messages").hide();
  var myLatLng = new google.maps.LatLng(lat, lng);
  addDestMarker(myLatLng);
  console.log("openUserLocation map.setCenter!");
  map.setCenter(myLatLng);
  map.setZoom(15);

}
//get all route contour plus stops
function stopsQuery() {//n queryStops(,n getStops(
  //console.log("stopsQuery");//+routesJson);
  if (!routesJson || routesJson === undefined || routesJson == null || Object.keys(routesJson).length == 0) {
    console.log("No routes loaded! return");
    return;
  }
  var systemsAmount = 0;
  routesQueryJson = {};
  for (var ki = 0; ki < localStorage.length; ki++) {
    var key = localStorage.key(ki);
    var val = localStorage.getItem(key);
    if (key.indexOf("system") == 0 && val == 1) {
      routesQueryJson["s" + systemsAmount] = key.substr(6);
      systemsAmount++;
    }
  };
  routesQueryJson.sA = systemsAmount;

  var atLeastOneSelected = 0;

  var s = myServer() + "mapGetData.php?getStops=2&deviceId=" + deviceId
    + "&withOutdated=1&wBounds=1"
    + "&buildNo=" + localStorage.softwareVer
    + "&showBusInOos=" + (/*20092023 localStorage.optionShowInactive==1 ||*/ atLeastOneSelected == 1 ? 1 : 0);
  if (localStorage.optionDoNotLocateMe != 1)
    s += "&lat=" + localStorage.mLastLocationLat + "&lng=" + localStorage.mLastLocationLng;

  //getStops=2 - 2nd version, returns routePoints as array of array to exclude flight paths
  if (timelineIsActive) {
    routesQueryJson.timelineIsActive = timelineIsActive;
    routesQueryJson.timelineDatetime = localStorage.timelineDate + " " + localStorage.timelineTime;
  } else if (routesQueryJson.timelineIsActive) {
    delete routesQueryJson.timelineIsActive;
    delete routesQueryJson.timelineDatetime;
  }
  $.postJSON(s, routesQueryJson)
    .done(function (data) {
      //console.log("stopsQuery: ",data);
      routes = data.routes ? data.routes : {};
      routePoints = data.routePoints;
      stops = data.stops;
      groupRoutes = data.groupRoutes;

      //routeSchedules = data.routeSchedules ? data.routeSchedules : []  //{26937: "1", 26939: "1", 26940: "1", 
      /*26092023 if (data.routeSchedules) {
          routeSchedules=[];
          for(let key6 in data.routeSchedules)
              if (data.routeSchedules[key6]==1)
                  routeSchedules.push(key6)
      }*/


      //if (data.routesRRdebug) console.log("got routesRRdebug",data.routesRRdebug);
      if (data.routesRR) routesRR = data.routesRR
      if (data.stopsRR) stopsRR = data.stopsRR
      //console.log("stopsQuery: got routesRR: ",data.routesRR);
      //console.log("stopsQuery: got stopsRR: ",data.stopsRR);
      setTimeout(function () {
        prepareRideRequest()
      }, 1500)


      suggestionsStops = [];
      setTimeout(function () {
        fillSuggestionsStops();
      }, 1000);
      routeColors = [];
      var routeColor;
      //let origColors=[] //debug
      $.each(routes, function (keyRoutes, valueRoutes) {
        //origColors[keyRoutes]=valueRoutes[1]+" "+valueRoutes[0];
        routeColor = correctColorFromARGB(valueRoutes[1]);
        routeColors[keyRoutes] = correctColorFromARGB(routeColor);
      });
      //console.log("stopsQuery: origColors=",origColors)
      /*18092021 if (!routes || routes.length==0){
          if (data.center && data.center.latitude && !mapPanMoratori um){
              map.panTo(new google.maps.LatLng(data.center.latitude, data.center.longitude));
              /*dont setTimeout(function(){
                  storeMapCenter();
              },1500);* /
          }
          showAllRoutesHiddenHint();
      } else*/
      drawStopMarkers(data.center);

    })
    .fail(function (data, msg) {
      mytoast("Error loading stops!");
    });
}
function refreshSelectedRoutes() {
  selectedRoutes = [];
  //console.log("refreshSelectedRoutes routesJsonFull=",routesJsonFull)
  if (!routesJsonFull) return
  var routeGroupIDs = [];
  for (var i = 0; i < routesJsonFull.length; i++) {
    //console.log("refreshSelectedRoutes["+i+"] localStorage[route"+routesJsonFull[i].myid+"]="+localStorage.getItem('route'+routesJsonFull[i].myid));
    if (localStorage.getItem('route' + routesJsonFull[i].myid) == 1) {
      selectedRoutes.push(routesJsonFull[i].myid);
      if (routesJsonFull[i].groupId > 0 && routeGroupIDs.indexOf(+routesJsonFull[i].groupId) == -1)
        routeGroupIDs.push(+routesJsonFull[i].groupId);
    }
  }
  //console.log("refreshSelectedRoutes before selectedRoutes=",selectedRoutes,", groupRoutes=",groupRoutes);
  if (routeGroupIDs.length) {
    for (var i = 0; i < routesJsonFull.length; i++) {
      if (routesJsonFull[i].groupId > 0 && routeGroupIDs.indexOf(+routesJsonFull[i].groupId) >= 0 && selectedRoutes.indexOf(routesJsonFull[i].myid) == -1 && selectedRoutes.indexOf(+routesJsonFull[i].myid) == -1)
        selectedRoutes.push(routesJsonFull[i].myid);
    }
  }
  //console.log("refreshSelectedRoutes after selectedRoutes=",selectedRoutes,", routeGroupIDs=",routeGroupIDs);
  busesWereQueried = -1 //refresh WS
}
function drawStopMarkers(center) {
  if (stopMarkerCluster != null) stopMarkerCluster.clearMarkers();
  if (stopMarkers != null) {
    for (var i = 0; i < stopMarkers.length; i++) {
      stopMarkers[i].setMap(null);
    }
  }
  stopMarkers = [];
  if (routePaths != null) {
    for (var i = 0; i < routePaths.length; i++) {
      routePaths[i].setMap(null);
    }
  }
  routePaths = [];
  refreshSelectedRoutes()

  var routeIdx = 0;
  var showStopName = localStorage.optionShowStopname == 1;
  var optionHideStops = localStorage.optionHideStops == 1;
  bounds = null;
  if (center) {
    bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(center.latitude, center.longitude));
    bounds.extend(new google.maps.LatLng(center.latitudeMin, center.longitudeMin));
    bounds.extend(new google.maps.LatLng(center.latitudeMax, center.longitudeMax));
  }

  //draw routes first
  var usedRoutesInGroups = [];
  $.each(routes, function (keyRoutes, routestops) {
    var routeGroupId = 0;
    $.each(groupRoutes, function (thisUserId, thisRoutes) {
      //console.log("drawStopMarkers: routeId["+keyRoutes+"] thisRoutes=",thisRoutes);
      if (thisRoutes[keyRoutes]) {
        routeGroupId = thisRoutes[keyRoutes].id;
        return false;//break
      }
    });
    //console.log("drawStopMarkers: routestops["+keyRoutes+"]=",routestops);
    //dont! they may be different! 20112020if (!routeGroupId || usedRoutesInGroups.indexOf(routeGroupId)<0){
    usedRoutesInGroups.push(routeGroupId);
    var points = [];
    var routeColor =/*outdated && !(localStorage.getItem('route'+keyRoutes)==1)?"#808080":*/correctColorFromARGB(routestops[1]);
    //25092023 var outdated=routestops[2]==1;
    //17022022 draw all! if (!outdated || localStorage.optionShowInactive==1){//01122021
    if (routePoints != null && routePoints[keyRoutes] != null) {
      $.each(routePoints[keyRoutes], function (keyPart, valuePart) {
        points = [];
        $.each(valuePart, function (keytheRoutePoints, valuetheRoutePoints) {
          if (valuetheRoutePoints && valuetheRoutePoints.constructor === String) {
            //polyline segment from Transloc. Draw them separately, the are not linked
            var segmentPoints = google.maps.geometry.encoding.decodePath(valuetheRoutePoints);//.replace(/\\/g, "\\")); //returns Array<LatLng> DONT forget "geometry" in gmap js call
            drawRoutePointsPart(segmentPoints, false, routeColor, keyRoutes, routeGroupId);
            if (!center)
              segmentPoints.forEach(function (myLatLng) {
                if (bounds == null) bounds = new google.maps.LatLngBounds();
                //console.log("drawStopMarkers: extends bounds on myLatLng1",myLatLng);
                bounds.extend(myLatLng);
              });
          } else if (valuetheRoutePoints && valuetheRoutePoints.lat) {
            points.push(new google.maps.LatLng(valuetheRoutePoints.lat, valuetheRoutePoints.lng));
          }
        });
        drawRoutePointsPart(points, false, routeColor, keyRoutes, routeGroupId);
        if (!center)
          points.forEach(function (myLatLng) {
            if (bounds == null) bounds = new google.maps.LatLngBounds();
            //console.log("drawStopMarkers: extends bounds on myLatLng2",myLatLng);
            bounds.extend(myLatLng);
          });
      });
    } else if (routestops.length > 3) {
      //draw routes from stops
      for (i = 3; i < routestops.length; i++) {
        var sID = "ID" + routestops[i][1];
        if (stops != null && stops[sID] != null && stops[sID].latitude != null && !(stops[sID].latitude == 0.0 && stops[sID].longitude == 0.0)) {
          var lastLocation = new google.maps.LatLng(stops[sID].latitude, stops[sID].longitude);
          points.push(lastLocation);
          if (!center) {
            if (bounds == null) bounds = new google.maps.LatLngBounds();
            //console.log("drawStopMarkers: extends bounds on lastLocation",lastLocation);
            bounds.extend(lastLocation);
          }
        }
      }
      drawRoutePointsPart(points, false, routeColor, keyRoutes, routeGroupId);
    }
    routeIdx++;
    //}
  });
  //console.log("drawStopMarkers: drawn "+routeIdx+" routes")
  //if (routeIdx==0) showAllRoutesHiddenHint();

  //draw stops 
  if (stops != null && !optionHideStops) {
    $("#progress").show();
    var usedRoutesInGroups = [];
    $.each(stops, function (key, value) {
      //stops[key].used=0;
      stops[key].routeIDs = null;
    });
    var routeIdx = 0;
    var speed = 10;
    var len = Object.keys(routes).length;
    $.each(routes, function (keyRoutes, routestops) {
      //if (keyRoutes.indexOf("cta")==0) console.log("drawStopMarkers: routeId["+keyRoutes+"]: ",routestops);
      var routeGroupId = 0;
      $.each(groupRoutes, function (thisUserId, thisRoutes) {
        if (thisRoutes[keyRoutes]) {
          routeGroupId = thisRoutes[keyRoutes].id;
          return false;//break
        }
        //if (keyRoutes==10303) console.log("drawStopMarkers: routeId["+keyRoutes+"],routeGroupId="+routeGroupId+", thisRoutes=",thisRoutes);
      });
      //if (keyRoutes==10303) console.log("drawStopMarkers: routeId["+keyRoutes+"] routeGroupId="+routeGroupId+" routestops:",routestops[0]);
      //dont! they may be different! 11012021 if (!routeGroupId || usedRoutesInGroups.indexOf(routeGroupId)<0){
      usedRoutesInGroups.push(routeGroupId);
      /*if (!debug){// /** /
          $('.progress-bar1').css('width', (100*routeIdx/routes.length)+'%');
          addRouteMarkersOnMap(keyRoutes,routestops,showStopName);
      /*}else {*/
      let routeIdx_ = routeIdx;
      setTimeout(function () {
        $('.progress-bar1').css('width', (100 * routeIdx_ / len) + '%');
        addRouteMarkersOnMap(keyRoutes, routestops, routeGroupId, showStopName);
        //if (routeIdx_%10==0 || routeIdx_>=len-1)
        //DON't ! missing!    recreateStopMarkerCluster();
      }, speed * routeIdx_ + 1000);//*/
      //}
      routeIdx++;
      //}
    });
    setTimeout(function () {
      recreateStopMarkerCluster();
      $("#progress").hide();
      //console.log("drawStopMarkers: stop drawing progress 100% ")
    }, speed * routeIdx + 1500);
  }

  //pan to bounds
  //if(mapPanMoratorium) console.log("drawStopMarkers, wants bounds, but mapPanMoratorium! "+mapPanMoratorium);
  if (bounds && !bounds.isEmpty() && !mapPanMoratorium) {
    google.maps.event.addListenerOnce(map, 'bounds_changed', function (event) {
      //console.log("drawStopMarkers: change zoom after bounds_changed, z="+map.getZoom()+" (vs "+stopMarkerZoomVisibilityTreshold+"), localStorage.lastCenter="+localStorage.lastCenter);
      if (!localStorage.lastCenter || localStorage.lastCenter == "") {//18092021
        //console.log("dSM: first time! highlight all routes, then zoom to city hub. initialZoom="+initialZoom+", initialLatLng=",initialLatLng)
        storeMapCenter()

        if (initialLatLng[0] && initialLatLng[0] != 0)
          map.setCenter({ lat: initialLatLng[0], lng: initialLatLng[1] })
        if (initialZoom > 0)
          map.setZoom(initialZoom)
        if (initialZoom > 0 || initialLatLng[0] && initialLatLng[0] != 0)
          return;

        //blink all routes
        for (let i = 0; i <= 5; i++) {
          setTimeout(function () {
            //console.log("drawStopMarkers: blink all routes("+i+")")
            /*dzntwrk! if (i==0 && stopMarkers)
                for (var y = 0; y < stopMarkers.length; y++) 
                    stopMarkers[y].setVisible(true);*/
            if (i == 5) {
              //console.log("drawStopMarkers calls unhighlightAll")
              unhighlightAll()
              let z = map.getZoom()
              let c = map.getCenter()
              //
              if (z < stopMarkerZoomVisibilityTreshold && center && center.hub) {
                //console.log("drawStopMarkers: correct zoom "+z+" to "+stopMarkerZoomVisibilityTreshold+" and move to center.hub ",center.hub)
                map.setCenter(new google.maps.LatLng(+center.hub[0], +center.hub[1]))
                map.setZoom(stopMarkerZoomVisibilityTreshold)
                //check if any stop is visible
                if (stops != null && !optionHideStops) {
                  let stopVisibleInBounds = 0
                  $.each(stops, function (key, value) {
                    if (value && value.latitude && value.latitude != 0) {
                      let lastLocation = new google.maps.LatLng(+value.latitude, +value.longitude);
                      if (map.getBounds().contains(lastLocation)) {
                        stopVisibleInBounds++
                        if (stopVisibleInBounds > 10) return false //break
                      }
                    }
                  });
                  //if guessed base view is empty in forests, unzoom and open side menu
                  if (stopVisibleInBounds < 10) {
                    //console.log("drawStopMarkers: restore zoom "+z+" cuz stopVisibleInBounds="+stopVisibleInBounds)
                    map.setZoom(z)
                    map.setCenter(c)
                    //doRunthroughAllroutes()
                    if (!$('body').hasClass("pushy-open-left"))
                      $('.menu-btn').click();
                    if ($('#menu_item_routes2').hasClass("pushy-submenu-closed"))
                      $('#menu_item_routes2 button').click();
                  } else {
                    //refresh just for the case
                    if (stopMarkers) {
                      //console.log("drawStopMarkers: finally set all "+stopMarkers.length+" stopMarkers visible")
                      for (var y = 0; y < stopMarkers.length; y++)
                        stopMarkers[y].setVisible(true);
                    }
                  }
                }
              }
            } else
              for (var j = routePaths.length - 1; j >= 0; j--) {
                routePaths[j].setOptions({ strokeOpacity: 1 - (i / 20) });
                routePaths[j].setOptions({ strokeWeight: 5 - (i / 3) });
              }
          }, 1500 + (i > 0 ? 1200 : 0) + i * 100)
        }
      }
    });
    map.fitBounds(bounds);//padding works only if one set ,{top:-150,bottom:-150});
    boundsAnimDelay = 1200;//18092021 was 3000
  }

}
function recreateStopMarkerCluster() {//reclsuterize
  //console.log("recreateStopMarkerCluster: stopMarkers.len="+stopMarkers.length);
  stopMarkerCluster = new MarkerClusterer(map, stopMarkers, {
    imagePath: 'img/pie',
    gridSize: 15, //do not increase! Scott, 28062018 due to Tarta horizontal lines
    showMarkerCount: 0,
    pieView: 1,
    pieSize: 20,
    averageCenter: true,
    zoomOnClick: false,//dont or make dont zoom too much
    showTitle: localStorage.optionShowStopname == 1
  });
  google.maps.event.addListener(stopMarkerCluster, "click", onClusterMarkerClick);
  google.maps.event.addListener(stopMarkerCluster, "mouseover", onClusterMarkerHover);
  //???? google.maps.event.addListener(stopMarkerCluster, "mouseout", closeInfoWindowWithDelay);
}
function addRouteMarkersOnMap(keyRoutes, routestops, routeGroupId, showStopName) {
  var z = map.getZoom();
  var routeId = keyRoutes;
  var routeName = routestops[0];
  //var outdated=routestops[2];
  var routeColor =/*outdated && !(localStorage.getItem('route'+keyRoutes)==1)?"#808080":*/correctColorFromARGB(routestops[1]);
  for (i = 3; i < routestops.length; i++) {
    var sID = "ID" + routestops[i][1];
    //if (keyRoutes.indexOf("cta")==0) console.log("addRouteMarkersOnMap["+routeId+"]["+i+"]: "+sID,stops[sID]);
    if (stops[sID] != null && stops[sID].latitude != null && !(stops[sID].latitude == 0.0 && stops[sID].longitude == 0.0)) {
      let theStop = stops[sID];
      if (!theStop.routeIDs || theStop.routeIDs.length == 0) stops[sID].routeIDs = [];
      if (!theStop.routeGroupIDs || theStop.routeGroupIDs.length == 0) stops[sID].routeGroupIDs = [];
      if (stops[sID].routeIDs.indexOf(routeId) < 0 && (!routeGroupId || stops[sID].routeGroupIDs.indexOf(routeGroupId) < 0)) {
        stops[sID].routeIDs.push(routeId);
        stops[sID].routeGroupIDs.push(routeGroupId);

        theStop.position = routestops[i][0];
        theStop.stopId = routestops[i][1];
        theStop.back = routestops[i][2];
        theStop.routeId = routeId;
        theStop.routeName = routeName;
        theStop.routeColor = routeColor;
        theStop.markerId = Math.round(Math.random() * 1000000);
        var lastLocation = new google.maps.LatLng(theStop.latitude, theStop.longitude);
        var marker = new google.maps.Marker({
          position: lastLocation,
          icon: {
            path: 'M-5,0a5,5 0 1,0 10,0a5,5 0 1,0 -10,0',//25012024 glitch in Edge!  : google.maps.SymbolPath.CIRCLE,
            scale: 1.5, //25012024 :7,
            fillColor: "#FFFFFF",
            fillOpacity: 1,
            strokeColor: routeColor,
            strokeOpacity: 1,
            strokeWeight: 3,
            labelOrigin: new google.maps.Point(0, 2)
          },
          visible: z >= stopMarkerZoomVisibilityTreshold,
          zIndex: i,
          stopId: theStop.stopId,
          id: theStop.markerId,
          routeId: routeId,
          //snippet: JSON.stringify(theStop),
          title: theStop.name,
          label: { text: (showStopName ? theStop.name : " "), color: "#0000ffaa", fontSize: "11px" },
        });//*/
        //MarkerWithLabel: https://github.com/PrestonWinstead/markerwithlabel
        /*var marker=new MarkerWithLabel({
                position: lastLocation,
                //map: map,
                icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                                strokeWeight:3,//outdated?1:2,
                        scale: 7,
                                fillColor: "#FFFFFF",
                                fillOpacity: 1,//outdated?0.35:1,
                                strokeColor: routeColor,
                                strokeOpacity: 1,//outdated?0.35:1,
                                anchor: new google.maps.Point(0,0)
                },
                visible:z >= 15,
                zIndex: 0,
                stopId: theStop.stopId,
                id: theStop.markerId,
                routeId: routeId,
                title: theStop.name,
                //for MarkerWithLabel
                labelContent: theStop.name,
                labelAnchor: new google.maps.Point(-13, 13),//abs px from left-top in opp dir
                labelClass: "markerLabel", 
                labelVisible: showStopName,
                //labelStyle: {opacity: 0.75},    
          });//*/
        marker.addListener('click', onMarkerClick);
        marker.addListener('mouseover', onMarkerHover);
        //marker.addListener('mouseout', function() {closeInfoWindow();});
        stopMarkers.push(marker);
      }
    }
  }
  // console.log("addRouteMarkersOnMap for "+keyRoutes+", reused="+reused+", reused2="+reused2);
}
function getRouteArrow(routeColor, opacity) {
  return {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 4,
    strokeColor: "#ffffff",
    strokeWeight: 0.5,
    fillColor: routeColor,
    fillOpacity: opacity * 0.6
  }
}
function drawRoutePointsPart(points, outdated, routeColor, routeId, routeGroupId) {
  //console.log("drawRoutePointsPart(routeId="+routeId+"): outdated="+outdated+", routeColor="+routeColor)
  if (!points || !points.length) return;
  let opacity = getRouteOpacity({ routeId: routeId, routeGroupId: routeGroupId }) * (outdated ? 0.75 : 1.0);//outdated returned 01122021, commented //24092021djd 
  let strokeWeight = opacity == newRouteUIdimmedOpacity ? newRouteUIdimmedWeight : newRouteUIactiveWeight;
  //console.log("drawRoutePointsPart(routeId="+routeId+"), opacity="+opacity+", strokeWeight="+strokeWeight);
  if (points.length > 0) {
    var flightPath = new google.maps.Polyline({
      path: points,
      visible: true,
      geodesic: false,
      clickable: false,
      strokeColor: routeColor,
      strokeOpacity: opacity,
      strokeWeight: strokeWeight,
      routeId: routeId,
      routeGroupId: routeGroupId,
      icons: [{
        icon: getRouteArrow(routeColor, opacity),
        repeat: '200px',
        path: []
      }]
    });
    flightPath.setMap(map);
    routePaths.push(flightPath);
    //console.log("drawStopMarkers: added routeId="+routePaths[routePaths.length-1].routeId);
  }
}
function getRouteOpacity(route) {
  let opacity = 1;
  let isSelected = selectedRoutes.indexOf(route.routeId) >= 0
  if (!isSelected) {
    //check groups
    var routeGroupId = route.routeGroupId;
    if (routeGroupId)
      $.each(groupRoutes, function (thisUserId, thisRoutes) {
        if (thisRoutes[route.routeId]) {
          routeGroupId = thisRoutes[route.routeId].id;
          return false;//break
        }
      });
    if (routeGroupId) {
      $.each(groupRoutes, function (thisUserId, thisRoutes) {
        $.each(thisRoutes, function (thisRouteId, thisRoute) {
          if (thisRoute.id == routeGroupId && selectedRoutes.indexOf(thisRouteId) >= 0) {
            isSelected = true;
            return false;//break
          }
        });
        if (isSelected) return false;//break
      });
    }
  }
  //console.log("getRouteOpacity: isSelected:="+isSelected)
  if (!isSelected
    //25092023   useful for starting agency! && routesJson.length>1 
  ) {
    //not selected across some selected? dim it completely. djd 24092021
    opacity = selectedRoutes.length > 0 ? 0 : newRouteUIdimmedOpacity;
    //console.log("getRouteOpacity: opacity:="+opacity+", newRouteUIdimmedOpacity="+newRouteUIdimmedOpacity)
  }
  return opacity
}


function getRoutesWgrouped(routeIds, onlyIfSelected) {
  if (!routeIds)
    routeIds = [];
  //may be grouped?
  var groupIds = [];
  for (var j = 0; j < routeIds.length; j++) {
    for (var i = 0; i < routesJsonFull.length; i++)
      if (routesJsonFull[i].myid == routeIds[j] && routesJsonFull[i].groupId > 0 && groupIds.indexOf(+routesJsonFull[i].groupId) == -1)
        groupIds.push(+routesJsonFull[i].groupId);
  }
  if (groupIds.length) {
    //console.log("highlightRoute: groupIds=",groupIds,", was routeIds=",routeIds,", routesJsonFull=",routesJsonFull);
    for (var i = 0; i < routesJsonFull.length; i++) {
      //console.log("   "+i+") for routesJsonFull["+i+"].groupId="+routesJsonFull[i].groupId+" groupIds.indexOf="+groupIds.indexOf(+routesJsonFull[i].groupId));
      //if (routesJsonFull[i].groupId>0 && groupIds.indexOf(+routesJsonFull[i].groupId)>=0) console.log("groupId="+routesJsonFull[i].groupId+", myid="+routesJsonFull[i].myid);
      if (routesJsonFull[i].groupId > 0 && groupIds.indexOf(+routesJsonFull[i].groupId) >= 0 && routeIds.indexOf(routesJsonFull[i].myid) == -1)
        routeIds.push(routesJsonFull[i].myid);
    }
  }
  if (onlyIfSelected) {
    var wasSelected = false;
    for (var j = 0; j < routeIds.length; j++)
      if (localStorage.getItem('route' + routeIds[j]) == 1) {
        wasSelected = true;
        break;
      }
    if (!wasSelected)
      routeIds = [];
  }
  //console.log("getRoutesWgrouped: done routeIds=",routeIds);
  return routeIds;
}

function highlightRoute(routeIds, options) { //n zoomtoroute n zoom2route
  if (!options) options = {}
  if (unhighlighRouteTimer != null) {
    clearTimeout(unhighlighRouteTimer);
    unhighlighRouteTimer = null;
  }
  //console.log("highlightRoute1("+routeIds+")")
  routeIds = getRoutesWgrouped(routeIds);
  //console.log("highlightRoute2("+routeIds+")")
  var bounds = null;

  //hide rotes
  for (var j = routePaths.length - 1; j >= 0; j--) {
    //if (j==0)console.log("routePaths[j]=",routePaths[j].strokeColor)
    let opacity = 0;
    if (routeIds.length > 0 && routeIds.indexOf(routePaths[j].routeId) >= 0 || routeIds.indexOf(+routePaths[j].routeId) >= 0/*may be int*/)
      opacity = 1;
    if (!opacity)
      opacity = getRouteOpacity(routePaths[j])

    routePaths[j].setOptions({ strokeOpacity: opacity });
    routePaths[j].setOptions({ strokeWeight: opacity == newRouteUIdimmedOpacity ? newRouteUIdimmedWeight : newRouteUIactiveWeight });
    const icons = routePaths[j].get("icons");
    icons[0].icon = getRouteArrow(routePaths[j].strokeColor, opacity)
    //it works! icons[0].offset = (Math.random()*100)+"%";
    routePaths[j].set("icons", icons);
    //console.log("highlightRoute: routePaths["+j+"]: opacity="+opacity)
    if (options.zoom && opacity > newRouteUIdimmedWeight) {
      if (bounds == null) bounds = new google.maps.LatLngBounds();
      bounds.union(routePaths[j].getBounds());//????routePaths[j].path);
    }
  }
  //hide stops
  /*dont, works worth! hides clusters
  if (stopMarkers!=null){
      for (var j=stopMarkers.length-1;j>=0;j--){
          //if (j<5) console.log("highlightRoute stopMarkers[j]=",stopMarkers[j]);
          let visibility=false
          for (var i=routeIds.length-1;i>=0;i--){
              if (stopMarkers[j].routeId==routeIds[i]){
                  visibility=true;
                  break;
              }
          }
          stopMarkers[j].setVisible(visibility);
      }
      recreateStopMarkerCluster();
  }*/

  if (options.zoom) {
    //console.log("highl ightRoute(zoom="+zoom+"), routeIds=",routeIds,", foundVisible="+foundVisible+", bounds=",bounds);
    if (bounds == null && stops) {
      //console.log("highl ightRoute(zoom="+options.zoom+") no route segments? find stops! routeIds=",routeIds,", bounds=",bounds);
      $.each(stops, function (key, theStop) {
        let visibility = false
        for (var i = routeIds.length - 1; i >= 0; i--) {
          if (theStop.routeIDs && (theStop.routeIDs.indexOf(routeIds[i]) != -1 || theStop.routeIDs.indexOf("" + routeIds[i]) != -1)) {
            visibility = true;
            break;
          }
        }
        //console.log("highlightRoute: stops["+key+"].routeIDs="+theStop.routeIDs+", visibility="+visibility)
        if (theStop && theStop.latitude && theStop.latitude != 0 && theStop.routeIDs && visibility) {
          if (bounds == null) bounds = new google.maps.LatLngBounds()
          bounds.extend(new google.maps.LatLng(+theStop.latitude, +theStop.longitude))
        }
      });
    }
    if (bounds != null)
      map.fitBounds(bounds);
  }
  if (routeIds && routeIds.length)  //25092023 endless fix
    unhighlighRouteTimer = setTimeout(function () {
      //console.log("highlightRoute call 1")
      highlightRoute();
    }, options.interval ? options.interval : 3000);//09092021 was 10000
}
function unhighlightAll() {
  //18092021 if (unhighlighRouteTimer!=null) 
  //console.log("unhighlightRoute")
  highlightRoute();
}


function queryBusEta(keyBuse) {
  var theLocation = buses[keyBuse];
  // console.log("queryBusEta: "+JSON.stringify(theLocation));
  mytoast("Demo. Will be implemented soon.", false);
}

function onClusterMarkerHover(cluster) {
  //console.log("onClusterMarkerHover, infoWindowReopened="+infoWindowReopened);
  if (!infoWindowReopened)
    onMarkerHover.call(cluster.markers_);//markers[0]
}
function onClusterMarkerClick(cluster) {
  //console.log("onClusterMarkerClick");
  onMarkerClick.call(cluster.markers_);//markers[0]
}
function onMarkerHover() {
  //highliht entire route on hover
  var markers = this;
  if (!(markers.constructor === Array)) {
    markers = [];
    markers.push(this);
  }
  var routeIds = [];
  for (K = 0; K < markers.length; K++) {
    routeIds.push(markers[K].routeId);
  }
  //console.log("onMarkerHover: routeIds="+routeIds);
  //console.log("highlightRoute call 3")
  highlightRoute(routeIds);//25092023 fixed, it was inside loop
  return;

  /*old 2019 UI if (!infoWindowReopened){
      //onMarkerClick();
      let func = onMarkerClick.bind(this);
      func();
  }*/
}
function onMarkerClick() {
  //console.log("onMarkerClick");//, this=",this);
  var markers = this;
  if (!(markers.constructor === Array)) {
    markers = [];
    markers.push(this);
  }
  var pos = markers[0].cluster ? markers[0].cluster.getCenter() : markers[0].getPosition();
  //if (debug) console.log("onMarkerClick, pos.lat=",pos.lat,pos.lat());
  var fontsize = isMobile ? 13 : 16;
  var btnsize = "";
  if (markers.length > 10) {
    fontsize -= 4;
    btnsize = "btn-xs";
  } else if (markers.length > 5) {
    fontsize -= 2;
    btnsize = "btn-sm";
  }
  var stopsDisplayed = 0;
  var stopId = "", routeId = 0, position, userId = 0;
  var stopItems = {};
  var usedStops = [];

  for (K = 0; K < markers.length; K++) {
    var marker = markers[K];
    //var jo=JSON.parse(marker.snippet);
    //if (debug){
    stopId = marker.stopId;
    //console.log("onMarkerClick: stopId="+stopId+", marker.title="+marker.title+", excludedRoutes=",excludedRoutes,"selectedRoutes=",selectedRoutes);
    var usedRoutesInGroups = [];
    //since 17022022 we ask all routes, despite on excluded, bcz they may be active in next minutes.
    //but inactive routes will be hidden by getETA
    //for (var oos = 0; /*17022022 show inactive cuz it may be active soon (Huski issue) localStorage.optionShowInactive==1*/true?oos <=1:oos <1; oos++) {
    $.each(routes, function (routeId1, routestops) {
      var isExcluded = excludedRoutes.indexOf(routeId1) >= 0 || excludedRoutes.indexOf(+routeId1) >= 0//both string and in ids
      var isSelected = selectedRoutes.indexOf(routeId1) >= 0 || selectedRoutes.indexOf(+routeId1) >= 0
      ///*if (isExcluded)*/ console.log("onMarkerClick: stopId "+stopId+", route "+routeId1+"=="+(+routeId1)+", isSelected?"+isSelected+", isExcluded? "+isExcluded+", oos? "+routestops[2]);//+": routestops=",routestops);
      //if (!isExcluded==(oos==0) || (oos==0 && isSelected)){
      //09082024 cuz stops are always visible! if (!selectedRoutes.length || isSelected){
      for (i = 3; i < routestops.length; i++) {
        if (stopId == routestops[i][1] && stops["ID" + stopId]) {
          //console.log("onMarkerClick: "+i+". routeId1="+routeId1+", stopId="+stopId+" == "+routestops[i][1]+"? "+(stopId==routestops[i][1])+" isExcluded?"+isExcluded);
          var routeGroupUID = "", routeName = routestops[0], routeColor = routestops[1];

          var shortName = "";
          $.each(routesJson, function (key, val) {
            if (val.myid == routeId1 && val.shortName) {
              shortName = val.shortName
              return false//break
            }
          });
          if (shortName && shortName.length > 5) shortName = shortName.substring(0, 5)

          var routeGroupId = 0;
          if (groupRoutes[stops["ID" + stopId].userId] && groupRoutes[stops["ID" + stopId].userId][routeId1]) {
            routeGroupId = groupRoutes[stops["ID" + stopId].userId][routeId1].id;
            routeName = groupRoutes[stops["ID" + stopId].userId][routeId1].name;
            routeColor = groupRoutes[stops["ID" + stopId].userId][routeId1].color;
          }
          if (routeGroupId > 0) {
            routeGroupUID = "G" + routeGroupId + "B" + routestops[i][2];
            if (usedRoutesInGroups.indexOf(routeGroupUID) != -1)
              routeGroupUID = "-";
            else {
              usedRoutesInGroups.push(routeGroupUID);
            }
          }
          //console.log("onMarkerClick: ---> routeId="+routeId1+", routeGroupUID="+routeGroupUID);//+", routestops=",routestops);
          if (routeGroupUID != "-") {
            userId = stops["ID" + stopId].userId;
            //                                    routeName=/*"Route: "*/'<i class="glyphicon glyphicon-road"></i> '+(routeName!=""?routeName:routestops[0]);
            routeColor = correctColorFromARGB(routeColor != "" ? routeColor : routestops[1]);
            //if (routeGroupUID=="" || routeGroupUID!="-"){
            //individual stop, get all specified
            position = routestops[i][0];
            routeId = routeId1;
            /*} else {
                //grouped routes, new ETA way, get only by stopId
                position=-1;
                routeId=-1;
                routeName="";
                routeColor="#000000";
            }*/
            var fastEtaId = "" + stopId + "-" + routeId;
            var routeNameStopIdUid = routeName + stopId  //25032022 cuz don't show same but inactive route (Ozark Route 62 @ Mountain & Old Missouri)
            if (!usedStops.includes(routeNameStopIdUid/*not fastEtaId cuz id differ but name is same*/)) {
              usedStops.push(routeNameStopIdUid);
              fastEtaId = "" + stopId + "-" + routeId + "-" + position + "-" + userId;//yes, again

              let RRdiv = ""
              if (localStorage.goRideRequestEnabled == 1) {
                if ((routesRR.indexOf(routeId1) >= 0 || routesRR.indexOf(+routeId1) >= 0) && (stopsRR.indexOf(stopId) >= 0 || stopsRR.indexOf(+stopId) >= 0)) {
                  //console.log("onMarkerClick: RR cuz routeId="+routeId1+" in ",routesRR," and stopId="+stopId+" in ",stopsRR)
                  RRdiv = "<div>"
                    + "<img class='btn btn-success rrBtn' src='img/man-and-bus0.svg' "
                    + " onClick=requestRideClick(this) "
                    + " title='Request a Ride!' data-stopid=" + stopId + " data-routeid=" + routeId1 + " >"
                    + "</div>"
                } else if (debug) {
                  //console.log("onMarkerClick: not RR cuz routeId1 "+routeId1+" not in "+routesRR+" and stopId "+stopId+" not in "+stopsRR);
                }
              }
              //always, let ETA decide! if (routeSchedules[routeId1]>=0 || routeSchedules[+routeId1]>=0){
              let scheduleDiv = "" +
                '<button class="btn btn-default btn-sm goShowSchedule' + fastEtaId + '" style="margin-left: 5px;outline: none;'
                + 'display:none;" ' //vis state will be changed by ETA later
                + ' onClick="showSchedule(this);" data-id="' + routeId1 + '" data-stopid="' + stopId + '" title="Schedule">'
                + '<img src=img/ic_schedule2.svg style="width:20px; height:20px;" alt=""></button>'
              //}

              //if (debug)routeColor="#fefefe"
              //console.log("onMarkerClick: routeColor="+routeColor)
              var stopItem = {};
              stopItem.stop = "<div style='display: block; "
                + "width:450px; " //main infowindow width
                //13102023 +"height:25px; "
                + "font-size:" + (fontsize + 3) + "px; font-weight:bold; white-space: nowrap;text-overflow: ellipsis;overflow: hidden;' class='etaStopNameAutofit'>" +/*Stop: "* /'<i class="glyphicon glyphicon-record"></i> '*/marker.title + "</div>";
              stopItem.row = ""
                + "<div style='" + (isExcluded && !isSelected ? "display:none;" : "display:flex;") + " justify-content:space-between; align-items:center;'>"
                + "<div class=\"stopEtaTitle fastEtaDivs\" "
                + " id='" + fastEtaId + "' "
                + " data-stopid=\"" + stopId + "\" data-routeid=\"" + routeId + "\" data-position=" + position + " data-userid=" + userId + " "
                + " onClick=\"queryStopEta(null,'" + stopId + "','" + routeId + "'," + position + "," + userId + ",false,this);\" "//strings since 07082020
                + " title=\"Show buses and upcoming schedule\" "
                + " tabindex=\"0\" onkeydown=\"emulateClick(event)\">"
                //route
                + "<span class='etaRouteNameAutofit' style='display: block; " + (!isMobile ? "width:315px;" : "") + " height:25px; margin-left: 15px; margin-right:15px; "
                + " font-size:" + (fontsize + 1) + "px; display: flex;    align-items: center;white-space:nowrap;color:#000000;font-weight: bolder;'>"
                /*13102023 +"<i class='glyphicon glyphicon-road' style='margin-right: 7px;font-size: 19px; padding: 5px; border-radius:5px;"
                    +" background: #b7b7b7;"//
                    +" color: "+routeColor+";"//$.xcolor.darken(routeColor)+"; "
                    + (!$.xcolor.readable(routeColor, "#808080") ? "text-shadow:0px 0px 8px #ffffff;" : "")
                    +"'></i> "*/
                + ("<div class=\"routeBadge\" style=\"background:" + routeColor + ";\"><span id=\"badge" + fastEtaId + "\">" + (shortName != "" ? shortName : "<img src=\"img/ic_routes_manage.svg\" style=\"height: 20px;filter: invert(1);\" alt>") + "</span></div>")
                + routeName + (routestops[i][2] ? " <i class='glyphicon glyphicon-repeat'></i>" : "")
                + "</span>"
                //eta string
                + "<span id=\"" + fastEtaId + "Eta\" style=\"display:none; position:absolute; transform-origin: right; "
                + "font-size:" + (fontsize + 3) + "px; right: 0px;top:0px; padding:0px 5px 5px 10px; color:#000000; font-weight:bold; background:#ffffff;\"></span>"
                + "<span id=\"" + fastEtaId + "Minutes\" style=\"position:absolute; font-size:" + (fontsize - 3) + "px; right: 0px;top:17px; padding-left:5px; padding-right:5px; color:#000000; \"></span>"
                + "<span id=\"" + fastEtaId + "Ico\" class=\"glyphicon glyphicon-time\" style=\"position:absolute; right:-10px; top:5px; font-size:10px;\"></span>"
                //+' <i class="glyphicon glyphicon-refresh" style="font-size:12px; position: absolute;right: 0px;top: 5px;"></i>'
                + "</div>" //stopEtaTitle
                //right side
                + "<div style='display:flex; align-items:center;' id='extraEtaDiv" + fastEtaId + "'>"
                + scheduleDiv + RRdiv
                + "</div>"
                + "</div>"

              stopsDisplayed++;

              if (!stopItems["stop" + stopId])
                stopItems["stop" + stopId] = [];
              stopItems["stop" + stopId].push(stopItem);
            }
          }
        }
      }
      //}
    });
    //}
  }

  let s = "";
  var idx = 0;
  $.each(stopItems, function (theStopId, routes) {
    //console.log("onMarkerClick: stop "+routes[0].stop+", theStopId=",theStopId);
    let favTitle = "Favorite stop" + (localStorage.getItem("fav" + theStopId) == 1 ? " set" : "")
    s += "<div style='font-size:16px; font-weight:bold;display:flex; justify-content:space-between; align-items:center;margin-top: " + (idx > 0 ? 15 : 0) + "px; "
      + "margin-bottom:10px; margin-right:15px;border-bottom: 2px solid #80808080;margin-left: 13px;'>"
      + "<img src=img/ic_roadstop.png>" + routes[0].stop
      + "<div>"
      + "<button class='btn btn-default btn-sm'  alt='" + favTitle + "' title='" + favTitle + "' data-uid='" + theStopId + "' data-title='" + $(routes[0].stop).text() + "' style='" + (localStorage.getItem("fav" + theStopId) == 1 ? "color:blue;" : "") + "' onClick='favoriteOnSwitch(this);'><i class=\"glyphicon glyphicon-heart\"></i></button>"
      + (localStorage.goRoutePlannerEnabled == 1
        ? "<button class='btn btn-default btn-sm hideOn1000' title='Route Planner' data-lat='" + pos.lat() + "' data-lng='" + pos.lng() + "' onClick='navigationMenuBtn(this);' tabindex='0'>"
        + "<img src=img/ic_navigation.svg style='width: 12px;' title='Run Route Planner (beta)'></button>" : "")
      + "</div>"
      + "</div>"
      + "<div style='display:flex; flex-direction:column;'>";
    for (var i = 0; i < routes.length; i++)
      s += routes[i].row
    s += "</div>";
    idx++;
  });
  //console.log("onMarkerClick: stopItems=",stopItems);//,"s="+s);

  s = "<div style=\"font-size:" + fontsize + "px; position:relative;    padding-right: 5px;\">"
    + s
    //+(stopsDisplayed && localStorage.goEtaEnabled==1?"<div style=\"font-size:14px; text-align:center;\"><br>Click on Route to monitor ETA online</div>":"")
    + "<div style='font-size:11px; text-align:center;margin-top:15px;' id='fastEtaUpdHint'>Requested " + (new Date()).toLocaleString() + "</div>"
    ;
  if (markers.length > 1) {
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < markers.length; i++) {
      //console.log("onMarkerClick: pos["+i+"]=");
      bounds.extend(markers[i].getPosition());
    }

    var ss = "<div style='text-align:center'><button class='btn btn-link' onClick='zoomToBounds(" + bounds.getNorthEast().lat() + "," + bounds.getNorthEast().lng() + "," + bounds.getSouthWest().lat() + "," + bounds.getSouthWest().lng() + ");'><i class='glyphicon glyphicon-zoom-in'></i> Zoom to stops</button></div>";
    if (markers.length > 10)
      s = ss + s;
    else
      s = s + ss;
  }
  //console.log("onMarkerClick: goEtaEnabled="+localStorage.goEtaEnabled);
  if (localStorage.goEtaEnabled == 1 || timelineIsActive || debug) {
    if (false /*25092018 Scott unify UI */ && stopsDisplayed == 1) {
      s += "<center><br><span><img src=img/loader.gif> loading ETA...</span></center>";
      setTimeout(function () {
        //console.log("onMarkerClick: will call queryStopEta ",stopId,routeId,position,userId);
        queryStopEta(null, stopId, routeId, position, userId);
      }, 500);
    } else {
      //FAST ETA
      setTimeout(function () {
        //console.log("fastEtaDiv start to loop over... len="+$(".fastEtaDivs").length);
        refreshFastETA(true);
        setTimeout(function () {
          //fix long strings. 
          //was completely off since 25082020 because 1. was appeared too big, 2. it crashes on html tags inside text
          //returned 16092025 set maxfontsize, and let it crash np
          textFit($(".etaStopNameAutofit"), { maxFontSize: fontsize + 3 });//https://github.com/STRML/textFit
          textFit($(".etaRouteNameAutofit"), { maxFontSize: fontsize + 1 });//https://github.com/STRML/textFit
          //$(".etaStopNameAutofit").each(function(){textFit(this,{maxFontSize:fontsize+3})});
          //$(".etaRouteNameAutofit").each(function(){textFit(this,{maxFontSize:fontsize+1})});

        }, 50);
      }, 150);
    }
  }
  //s+="<br><button class='btn btn-default' onClick='queryStopEta("+markers[0].id+");'><img src='img/ic_clock.svg'> Query ETA</button>";
  s += "</div>";
  //console.log("onMarkerClick: calling popup with s="+s);
  if (stopsDisplayed) {//22102019
    if (infowindow)
      closeInfoWindow();//infowindow.close();
    showInfoWindow(s, pos);
  } else
    mytoast("Cannot identify the stop", false);//09082024 Out of Service
}

function zoomToBounds(getNorthEastLat, getNorthEastLng, getSouthWestLat, getSouthWestLng) {
  //console.log("zoomToBounds: "+getNorthEastLat+"/"+getNorthEastLng+","+getSouthWestLat+"/"+getSouthWestLng);
  var bounds = new google.maps.LatLngBounds(new google.maps.LatLng(getNorthEastLat, getNorthEastLng));
  bounds.extend(new google.maps.LatLng(getSouthWestLat, getSouthWestLng));
  map.fitBounds(bounds, Math.min(Gy, Gx) * 0.45);
  closeInfoWindow();
}

function refreshFastETA(firstTime = false) {//queryfasteta fastqueryeta fastetaquery
  if (!$(".fastEtaDivs").length) return;
  if (fastETArefreshInterval) clearInterval(fastETArefreshInterval);
  fastETArefreshInterval = setInterval(function () {
    refreshFastETA();
  }, 10000) //10s 26092023
  if (!firstTime && $("#forceSolidPause").prop("checked")) return;
  let allAreLoaded = true;
  $(".fastEtaDivs").each(function (key, fastEtaDiv) {
    //if ($(fastEtaDiv).parent().css("display")=="none") return true//continue 
    let fastEtaId = $(fastEtaDiv).prop("id")
    //26092023 limit ETA requesting by few times
    let amount = ($(fastEtaDiv).data("amount") | 0) + 1
    //console.log("refreshFastETA: fastEtaId="+fastEtaId+", amount="+amount+", loading?",$("#"+fastEtaId+"Ico").hasClass("glyphicon-refresh-animate"));
    if (amount > 30 && !$("#forceSolidCompare").prop("checked")) {
      if (letInfowindowBeClosed) closeInfoWindow();
      console.log("refreshFastETA: stopped on " + amount + " request");
      allAreLoaded = true
      return false//break
    }
    $(fastEtaDiv).data("amount", amount)
    if ($("#" + fastEtaId + "Ico").length && $("#" + fastEtaId + "Ico").hasClass("glyphicon-refresh-animate")) {
      allAreLoaded = false;
      return false//break
    }
  });
  if (allAreLoaded) {
    $(".fastEtaDivs").each(function (key, fastEtaDiv) {
      //if ($(fastEtaDiv).parent().css("display")=="none") return true//continue 
      let fastEtaId = $(fastEtaDiv).prop("id");
      //$("#"+fastEtaId+"Eta").hide("slide", { direction: "right" }, 100); 
      $("#" + fastEtaId + "Ico").fadeIn(100)//"slide", { direction: "right" }, 100); 
      $("#" + fastEtaId + "Ico").addClass("glyphicon-refresh-animate");
      setTimeout(function () {
        if (!$("#" + fastEtaId).length) {
          //console.log("fats eta immediately finished cuz nothing to do");
          return false;//break
        }
        //console.log("refreshFastETA will call queryStopEta id="+fastEtaId);
        queryStopEta(null, $("#" + fastEtaId).data("stopid"), $("#" + fastEtaId).data("routeid"), $("#" + fastEtaId).data("position"), $("#" + fastEtaId).data("userid"), true);
      }, 150 + (300 * key));
    });
  }
}
function queryStopEta(markerId, stopId, routeId, position, userId, fastEta, el) {//n queryeta( geteta
  if (el) $(el).effect("highlight");
  if (localStorage.goEtaEnabled != 1 && !timelineIsActive && !debug) {
    console.log("queryStopEta immediately quits (goEtaEnabled=" + localStorage.goEtaEnabled + ")");
    $(".glyphicon-time").hide();
    mytoast('ETA is not provided yet');
    return;
  }
  //console.log("queryStopEta("+markerId+","+stopId+","+routeId+","+position+","+userId+", fastEta="+fastEta+"), lastStopETAjsonObject==null?"+(lastStopETAjsonObject==null));
  if (stopId) {
    lastStopETAjsonObject = {};
    lastStopETAjsonObject.id = stopId;
    lastStopETAjsonObject.routeId = routeId;
    lastStopETAjsonObject.position = position;
    lastStopETAjsonObject.userId = userId;
    lastStopETAjsonObject.fastEta = fastEta;
  }
  if ((lastStopETAjsonObject != null && !fastEta) || stopId) {/*ok!*/ } else {
    console.log("queryStopEta: lastStopETAjsonObject is null! exit");
    return;
  }
  var dontSlide = !stopId && !fastEta && lastStopETAjsonObject != null;//autorefresh of already opened window
  var fastEtaId = "" + stopId + "-" + routeId + "-" + position + "-" + userId;
  if (!fastEta)
    $("#infowindowLoader").show();
  else
    $("#" + fastEtaId + "Ico").addClass("glyphicon-refresh-animate");
  $("." + fastEtaId + "loader").show();

  var created;
  var s1 = myServer() + "mapGetData.php?eta=3&deviceId=" + deviceId
    + "&stopIds=" + lastStopETAjsonObject.id
    + (lastStopETAjsonObject.routeId ? "&routeId=" + lastStopETAjsonObject.routeId : "") //routeId is string!
    + (lastStopETAjsonObject.position > 0 ? "&position=" + lastStopETAjsonObject.position : "")
    + (lastStopETAjsonObject.userId > 0 ? "&userId=" + lastStopETAjsonObject.userId : "")
    ;
  if (timelineIsActive) s1 += "&timelineIsActive=1&timelineDatetime=" + encodeURIComponent(localStorage.timelineDate + " " + localStorage.timelineTime);
  if ($("#forceSolid").prop("checked")) s1 += "&forceSolid=1"
  if ($("#forceSolidPast").prop("checked")) s1 += "&forceSolidPast=1"
  if ($("#forceSolidCompare").prop("checked")) s1 += "&forceSolidCompare=1"
  var includedRoutes = [];
  $.each(routesJson, function (key, val) { if (localStorage.getItem('route' + val.myid) == 1) includedRoutes.push(val.myid) });
  if (includedRoutes.length > 0) s1 += "&routeIds=" + includedRoutes.join(",");
  if (debug) s1 += "&debug2=1";
  //console.log("queryStopEta: includedRoutes="+JSON.stringify(includedRoutes));

  //13072023 if (localStorage.optionETAmode!=1) s1+="&solid=1"; //12052023

  //var pos=new google.maps.LatLng(lastStopETAjsonObject.latitude,lastStopETAjsonObject.longitude);
  //console.log("queryStopEta: "+s1);
  $.getJSON(s1)
    .done(function (data) {
      //console.log("queryStopEta: data=",data);//,"localStorage.goEtaEnabled="+localStorage.goEtaEnabled);
      if (lastStopETAjsonObject == null && (!fastEta || !fastEtaId || !$("#" + fastEtaId).length)) {
        console.log("queryStopEta immediately finished cuz nothing to do: lastStopETAjsonObject==null?" + (lastStopETAjsonObject == null) + ", fastEta?" + fastEta + ", fastEtaId?" + fastEtaId + ', $("#"+fastEtaId).length?' + $("#" + fastEtaId).length);
        if (fastETArefreshInterval) clearInterval(fastETArefreshInterval);
        return;
      }
      if (!data || !data.ETAs) {
        console.log("queryStopEta will stop updating cuz got ", data);
        if (fastETArefreshInterval) clearInterval(fastETArefreshInterval);
      }
      let maxAmountOfBusesInEta = fastEta ? 3 : 6 //actually 3, 6 is for Chicago 01032024 todo use SSOconfig.maxAmountOfBusesInEta value
      var fastEtaArr = []
      let fastEtaTable = []
      var fastEtaErr = ""
      var fastEtaHint = ""
      var fastEtaOrder = -1;
      var fastEtaOOS = false
      var totalAmount = 0, amount = 0;
      var firstStop = true;
      var s = "";
      var routeName = "", shortName = ""
      var routeColor = "#808080"//,etaColor="#000000",etaBackground="yellow";
      var heatmapData = [];
      var solid = false
      $.each(data ? data.ETAs : [], function (stopId, stopEtas) {
        var lastRouteId = -1;
        $.each(stopEtas, function (etaIdx, etta) {
          //Here are 2 modes of view: get 1 stop ETA and update previously shown ETA infowindow for all routes (aka fastEta)
          //or popup new (secondary) infowindow for single route

          if ((amount < maxAmountOfBusesInEta && !(etta.sameRoute === 1))
            || $("#forceSolidCompare").prop("checked") //debug mode
          ) {
            if (etta.secondsSpent > 1) amount++;

            //etaBackground=etta.bg //need for fastEta
            //etaColor=etta.color && etta.color!=""?etta.color:etaColor //need for fastEta
            var etaError = etta.error && etta.error.length ? etta.error[0] : "";
            var routeId = etta.routeId;
            shortName = etta.theStop && etta.theStop.shortName && etta.theStop.shortName != "" ? etta.theStop.shortName : ""
            if (shortName.length > 5) shortName = shortName.substring(0, 5) //for long badges
            //console.log("queryStopEta: routeId="+routeId+" "+shortName+" "+etta.eta+", fastEtaId="+fastEtaId)
            solid = etta.solid

            if (fastEta) {
              //refresh inline ETA in stop infowindow just called and placed by onMarkerClick()

              if ($("#forceSolid").prop("checked") || $("#forceSolidCompare").prop("checked")) {
                if (etta.debug && etta.solid) etta.etaR += "<span style='color:#808080;' title='solid ETA, upd " + etta.updatedSecAgo + "s ago'>*</span>";
              }
              if ($("#forceSolidCompare").prop("checked")) {
                //debug dev info
                fastEtaTable.push(etta);
              }
              if (etta.outOfService) {
                fastEtaOOS = true
                return false
              }
              if (!fastEtaArr.length) {
                //only for 1st ETA 
                if (etaError != "") fastEtaErr = etaError
                if (etta.goShowSchedule == 1) $(".goShowSchedule" + fastEtaId).show()
                if (fastEtaOrder < 0) fastEtaOrder = etta.order + etta.secondsSpent
              }
              if ((stopEtas.length > 1 && etta.etaR && etta.etaR !== "") || $("#forceSolidCompare").prop("checked")/*debug*/) {
                //up to 3 digital items in a row
                fastEtaArr.push(etta.etaR || etta.eta)
                if (!fastEtaHint) fastEtaHint = "minutes "
              } else {
                //single textual item
                fastEtaArr.push(etta.eta)
                return false //get only first
              }
            }
            else {
              //draw stop-route secondary ETA infowindow THIS IS NOT A GENERAL ETA POPUP!! see in onMarkerClick()
              if (!created) created = etta.created;
              if (firstStop && etta.theStop) {
                firstStop = false;
                s += "<div style='font-weight:bold; font-size:18px; "
                  + "width:400px;" //main width of second ETA infowindow
                  + " display:flex; justify-content:space-between; align-items:center;'>"
                  + "<div style='width:100%;white-space: nowrap;text-overflow: ellipsis;overflow: hidden;'>"
                  + "<img src=img/busstop.svg class='busstop_eta'>" + etta.theStop.name + "</div>"
                  + "<img src=/img/loader.gif style='width:20px; height:20px;display:none;' class='" + fastEtaId + "loader'>"
                  + "</div>";
              }
              if (lastRouteId != routeId && routes[routeId] && !(etta.sameRoute === 1)) {
                routeName = etta.theStop && etta.theStop.routeName && etta.theStop.routeName != "" ? etta.theStop.routeName : routes[routeId][0];
                routeColor = routes[routeId][1]; if (routeColor == "") routeColor = "#808080";
                routeColor = correctColorFromARGB(routeColor != "" ? routeColor : routestops[1]);
                lastRouteId = routeId;
                s += "<div style='margin:15px 5px;font-size:18px; '><span style='color:#000000; font-weight:bolder'>"
                  + "<i class='glyphicon glyphicon-road' style='margin-right: 7px;font-size: 19px; padding: 5px; border-radius:5px;"
                  + " background: #b7b7b7;"//
                  + " color: " + routeColor + ";"//$.xcolor.darken(routeColor)+"; "
                  + (!$.xcolor.readable(routeColor, "#808080") ? "text-shadow:0px 0px 8px #ffffff;" : "")
                  + "'></i> "
                  + routeName + "</span>"
                  + (etta.outdated == 1 ? "<br><b>OUT OF SERVICE</b>" + (etta.serviceTime ? "<br><font style=\"font-size:13px;\">Service on route " + etta.serviceTime + "</font>" : "") : "") + "</div>";
              }

              var sche = "";
              if (etta.scheduleTimes && etta.scheduleTimes.length) {
                sche = "<div style='text-align:right;font-size:15px;margin-bottom:0px;margin-top:6px;max-width:350px;'>"
                  + "<i class=\"glyphicon glyphicon-time\"></i> Schedule: "
                  + "&nbsp;<nobr>" + etta.scheduleTimes[0] + "</nobr>"
                  + (etta.scheduleTimes.length > 1 ? " &nbsp;<nobr>" + etta.scheduleTimes[1] + "</nobr>" : "")
                  + (etta.scheduleTimes.length > 2 ? " &nbsp;<nobr>" + etta.scheduleTimes[2] + "</nobr>" : "");
                if (etta.scheduleTimes.length > 3) {
                  sche += " <a onClick='showHideSched(\"" + fastEtaId + "\");' title='+" + (etta.scheduleTimes.length - 3) + " more'>...</a>"
                    + "<div style='display:none; font-size:12px;' class='" + fastEtaId + "sche'>";
                  for (var ie = 3; ie < etta.scheduleTimes.length; ie++)
                    sche += " &nbsp;<nobr>" + etta.scheduleTimes[ie] + "</nobr>";
                  sche += "</div>";

                }
                sche += "</div>";
              }
              /*if (etta.scheduleTime && etta.scheduleTime!=""){
                              sche="<div style='text-align:right;font-size:15px;margin-bottom:7px;margin-top:10px;'><i class=\"glyphicon glyphicon-time\"></i> Schedule time "+etta.scheduleTime+"</div>";
              }*/
              if (etta.busName && etta.busName != "" && !etta.busName.toLowerCase().includes("bus")) etta.busName = "Bus " + etta.busName;
              if (localStorage.goBusNamedAsRoute == 1 && etta.theStop) {
                etta.busName = (etta.theStop.shortName && etta.theStop.shortName != "" ? etta.theStop.shortName : etta.theStop.routeName)
                  + (timelineIsActive ? " (" + etta.busName + ", tripId " + etta.tripId + ")" : ""); //" (Bus "
              }
              s += "<div style='position:relative; display:flex; justify-content:space-between; align-items:flex-start;margin-bottom:12px;'>"
                + "<div>"
                + "<img src='img/ic_bus_2019_white.png' alt='' style='width:30px; height:30px; margin-left:5px; margin-right:0px; padding:5px; background-color:" + routeColor + "; "
                + "background-blend-mode: color; border-radius:50%; cursor:pointer;' onClick='findDeviceById(" + etta.deviceId + ");'> "
                + etta.busName
                + "</div>"
                + "<div style='display:flex; flex-direction:column; align-items:flex-end;'>"
                + "<span class=\"class" + fastEtaId + "\" style='" + (dontSlide ? "" : "display:none;") + " padding:5px; background:" + etta.bg + "; color:" + etta.color + "; font-size:18px; font-weight:bold;'>"
                + etta.eta
                + (etaError != "" && dontSlide ? "<a style='margin:3px;font-size:16px;color:red;' title='Why?' onClick='showHideEtaErr(\"" + fastEtaId + "\");'><i class=\"glyphicon glyphicon-question-sign\"></i></a>" : "")
                + "</span>"
                + sche
                + "</div>"
                + "</div>";
              if (etaError != "") {
                s += "<div style='text-align:right;font-size:13px;margin-bottom:10px;display:" + (dontSlide ? "none" : "") + ";' class='" + fastEtaId + "err'><i class=\"glyphicon glyphicon-info-sign\"></i> "
                  + etaError
                  + (etta.deviceId > 0 ? " <a onClick='findDeviceById(" + etta.deviceId + ");' title='Locate the bus'>?</a>" : "")
                  + "</div>";
              }
            }
            totalAmount++;
          }
        });
      });
      if (!fastEta) {
        //secondary ETA infowindow, called from first infowindow, called by onMarkerClick()
        if (s == "" || totalAmount < 1) s += "<br><div style='text-align:center;'>" + (localStorage.goEtaEnabled ? "No prediction." : "ETA not provided") + "</div>"
        if (timelineIsActive || debugTimeline) s += "<br>&nbsp;&nbsp;&nbsp;<a href='" + s1.replace("passiogo.com", "passio3.com/www") + "&debugChart=1' target=_NEW style='font-size:10px;' title='Explain!'><i class='glyphicon glyphicon-new-window'></i></a><br>";
        showInfoWindow(s, null, data.time);
        setTimeout(function () { $(".class" + fastEtaId).show("slide", { direction: "right" }, 250) }, 250);
      }
      else {
        //refresh inline ETA in stop infowindow just called by onMarkerClick()
        lastStopETAjsonObject = null;
        if (!$("#" + fastEtaId).parent().data("orderSet")) {
          $("#" + fastEtaId).parent().data("orderSet", 1) //reorder it only on start, once! 26092023 
          $("#" + fastEtaId).parent().css("order", fastEtaOrder)
        }
        //join array of ETA to single string like "1,16 & 2"
        let eta = ""//fastEtaArr.length ? fastEtaArr.join("<span style='font-size:12px; margin:0px 3px;'>&</span>") : "--"
        if (fastEtaTable.length) {
          //debug table view (for compare)
          let extraEtaDiv = "<table class='extraEtaTable'><tr>"
            + "<th>Bus</th>"
            + "<th>ETA,m</th>"
            + "<th>sec</th>"
            + "<th>Source</th>"
            + "<th>Updated</th>"
            + "</tr>";
          fastEtaTable.sort((a, b) => a.busName.localeCompare(b.busName));
          for (var i = 0; i < fastEtaTable.length; i++) {
            extraEtaDiv += "<tr>"
            extraEtaDiv += "<td>" + (fastEtaTable[i].busName || "") + "</td>"
            extraEtaDiv += "<td>" + (fastEtaTable[i].etaR || "") + "</td>"
            extraEtaDiv += "<td>" + fastEtaTable[i].secondsSpent + "</td>"
            extraEtaDiv += "<td>" + (fastEtaTable[i].solid ? "table" : "OnFly") + "</td>"
            extraEtaDiv += "<td>" + (fastEtaTable[i].updatedSecAgo
              ? "<font color=" + (fastEtaTable[i].updatedSecAgo > 50 ? "red" : "black") + ">"
              + (fastEtaTable[i].updatedSecAgo < 90 ? fastEtaTable[i].updatedSecAgo + "s ago" : Math.round(fastEtaTable[i].updatedSecAgo / 60) + "m ago") + "</font>"
              : "now") + "</td>"
            extraEtaDiv += "</tr>";
          }
          extraEtaDiv += "</table>";
          $("#extraEtaDiv" + fastEtaId).html(extraEtaDiv)
        }
        //normal view
        for (var i = 0; i < fastEtaArr.length; i++) {
          eta += (eta == "" ? "" : "<span style='font-size:12px; margin:0px 3px 0px 0px; color:#808080;'>" + (i < (fastEtaArr.length - 1) ? "," : " &") + "</span>")
            + (i == 0 ? fastEtaArr[i] : "<span style='color:#808080;' title='Next bus ETA'>" + fastEtaArr[i] + "</span>")
        }
        if (eta == "") {
          eta = "--";
          fastEtaErr += "(no connect)";
          fastEtaOOS = true//01032024
        }
        if (fastEtaErr != "") eta += "<img src=img/i_sign.png style='margin:1px;width:10px; height:10px;' title='Note: " + fastEtaErr + "'>"
        $("#" + fastEtaId + "Eta").hide("slide", { direction: "down" }, 150);
        $("#" + fastEtaId + "Eta").html(eta);

        //16092025 fix long strings like "Route serive ctarts at 6:30 AM"
        //$("#"+fastEtaId+"Eta").css("fontSize",(3+(isMobile?13:16))*(eta.length>15?0.75:1))
        //console.log("queryStopEta: eta.length="+eta.length)
        $("#" + fastEtaId + "Eta").css("transform", eta.length > 20 && eta.replace(/<[^>]*>/g, '').length > 20 ? "scaleX(0.75) " : "scaleX(1) ")

        $("#" + fastEtaId + "Eta").show("slide", { direction: "up" }, 300);
        $("#" + fastEtaId + "Minutes").html(fastEtaHint + (solid ? "<font color=#008800 title=\"eta cache\">" + ($("#forceSolid").prop("checked") ? "*" : ".") + "</span>" : ""));
        $("#fastEtaUpdHint").html("Updated " + (data.time ? data.time : "~ " + (new Date()).toLocaleString()));
        if (shortName != "") $("#badge" + fastEtaId).html(shortName)

        //OOS? temporary hide non-active routes  27092023. They could be rise again!
        //$("#"+fastEtaId).parent().css("display",fastEtaOOS?"none":"flex")
        if (fastEtaOOS) {
          //console.log("ETA "+fastEtaId+" was temprorary hidden b/c of eta="+eta+" "+fastEtaErr);
          $("#" + fastEtaId).parent().remove() //11102023 remove completely, cuz hard to enumerate in refreshFastETA, and cuz in mobile GO it is so.
        }//*/
      }
    })
    .always(function (data, msg) {
      $("." + fastEtaId + "loader").fadeOut(1000);////useles cuz window refreshed
      setTimeout(function (el) {
        $("." + fastEtaId + "loader").show(500);////useles cuz window refreshed
      }, minBusQueryInterval - 2000);
      if (fastEta) {
        $("#" + fastEtaId + "Ico").removeClass("glyphicon-refresh-animate");
        $("#" + fastEtaId + "Ico").fadeOut(350)//"slide", { direction: "right" }, 250); 
      }
    })
}
function showHideEtaErr(fastEtaId) {
  //console.log("showHideEtaErr("+fastEtaId+")");
  $("." + fastEtaId + "err").toggle(350);
}
function showHideSched(fastEtaId) {
  //console.log("showHideSched("+fastEtaId+")");
  $("." + fastEtaId + "sche").toggle(350);
  $("." + fastEtaId + "sche").parent().find("a").toggle(350);
}
function findDeviceById(devicceid) {
  //console.log("findDeviceById("+deviceid+")");
  var found = false;
  for (i = 0; i < busMarkers.length; i++) {
    if (busMarkers[i].deviceId == devicceid) {
      //console.log("findDeviceById: found! deviceId["+i+"]="+busMarkers[i].deviceId);
      map.panTo(busMarkers[i].position);
      animateMapZoomTo(map, 16); //map.setZoom(16);
      closeInfoWindow();
      found = true;
      return false;
    }
  }
  if (!found)
    mytoast("Object not found", false);
}

function infowindowMouseover() {
  infoWindowReopened = true;
}
function setInfoWindowPinned() {
  infoWindowPinnedLeft = !infoWindowPinnedLeft;
  //console.log("setInfoWindowPinned: getContent="+infowindow.getContent());
  showInfoWindow(null, null, null);
}
function showInfoWindow(s, posOrMarker, withTime) {
  //console.log("showInfoWindow: pos="+pos);//s="+s); 
  //todo infobox: https://stackoverflow.com/a/7628522/2233069
  letInfowindowBeClosed = false;
  infoWindowReopened = true;
  var disableAutoPan = false;
  var xOffset = 0, yOffset = 0;
  if (!posOrMarker || infoWindowPinnedLeft) {
    //var bounds = map.getBounds();
    // var NECorner = bounds.getNorthEast();
    //var SWCorner = bounds.getSouthWest();
    //pos=new google.maps.LatLng((NECorner.lat()-SWCorner.lat())/2, SWCorner.lng());
    if (!infoWindowPinnedLeft) {
      posOrMarker = markerStopETA ? markerStopETA.getPosition() : (infowindow ? infowindow.getPosition() : map.getCenter());
      yOffset = -15;
    } else {
      posOrMarker = map.getCenter();//new google.maps.LatLng(0,0);
      disableAutoPan = true;
      xOffset = (Gx - infoWindowWidth) / 2 - 75;//triangle is in .gm-style .gm-style-iw-t::after
      yOffset = Gy * 0.4;
    }
  }
  if (s == null && infowindow) {
    s = infowindow.getContent();
  } else {
    s = "<div class='infowindow' style='width:auto; max-width: " + (infoWindowWidth * 2) + "px; max-height:" + infoWindowHeight + "; overflow-x:hidden;' onmouseover=\"infowindowMouseover();\">"
      + s;
    if (withTime) {
      if (withTime === true) {
        var d = new Date();
        withTime = d.toLocaleString()
      }
      s += "<div id='fastEtaUpdHint' style='font-size:13px; text-align:center;'>Updated " + withTime + "</div>"
    }
    if (localStorage.optionAccessibilityMode != 1)
      s += "<div style='position: absolute;bottom: 0px;left:0px;display:flex;justify-content:space-between;'>"
        + "<button id='infoWindowPinButton' class='btn btn-link btn-xs glyphicon glyphicon-pushpin' " + (Gx > 767 ? "" : "style='display:none;'") + " onClick='setInfoWindowPinned();' title='pin to the left' alt='pin to the left'></button>"
        + "</div>"

    s += "</div>";
  }
  //console.log("showInfoWindow is ready to open with pos="+pos);//s="+s);
  if (infowindow)
    infowindow.close();//not close..()! this only on click
  //console.log("showInfoWindow: posOrMarker=",posOrMarker)
  infowindow = new google.maps.InfoWindow({
    content: s,
    position: !posOrMarker.id ? posOrMarker : posOrMarker.getPosition(),
    disableAutoPan: disableAutoPan,
    pixelOffset: new google.maps.Size(-xOffset, yOffset)
  });// */
  infowindow.open(map, posOrMarker.id ? posOrMarker : null);
  //console.log("showInfoWindow: infowindow?"+infowindow);
  if (infoWindowPinnedLeft)
    $("#infoWindowPinButton").addClass("btn-success");
  else
    $("#infoWindowPinButton").removeClass("btn-success");
  setTimeout(function (el) {
    letInfowindowBeClosed = true;
  }, 350, this);
  google.maps.event.addListener(infowindow, 'closeclick', function () {
    //console.log("infowindow,'closeclick'");
    closeInfoWindow();
  });

}
function closeInfoWindowWithDelay() {
  //console.log("closeInfoWindowWithDelay");
  infoWindowReopened = false;
  setTimeout(function () {
    if (!infoWindowReopened && letInfowindowBeClosed)
      closeInfoWindow();
  }, 250);
}
function closeInfoWindow() {
  //console.log("closeInfoWindow, infowindow?",infowindow);
  letInfowindowBeClosed = false;
  if (infowindow) {
    infowindow.close();
    //console.log("closeInfoWindow, infowindow closed");
  }
  infowindow = null;
  infoWindowReopened = false;
  if (lastStopETAjsonObject) {
    lastStopETAjsonObject = null;
    if (markerStopETA) {
      markerStopETA.setMap(null);
      markerStopETA = null;
    }
  }
  if (markerPredictRoute)
    markerPredictRoute.setMap(null);
  if (heatmap)
    heatmap.setMap(null);
}

function getRoutes() { //n queryRoutes
  routeListWasChanged = 0;
  //var s="";

  var amount = 0;
  var json = {}
  for (var ki = 0; ki < localStorage.length; ki++) {
    var key = localStorage.key(ki);
    var val = localStorage.getItem(key);
    if (key.indexOf("system") == 0 && val == 1) {
      json["systemSelected" + amount] = key.substr(6);
      /*$.each(systemsJson, function(key, val) {
          if (val.id==json["systemSelected"+amount])
              s+=val.fullname+" ";
      });*/
      amount++;
    }
  };
  if (amount > 0) {
    var s1 = myServer() + "mapGetData.php?getRoutes=1&deviceId=" + deviceId
    json.amount = amount;
    //if ($.co okie('optionShowInactive')==1)
    //    json.showOutdated=1;
    if (timelineIsActive) {
      json.timelineIsActive = timelineIsActive;
      json.timelineDatetime = localStorage.timelineDate + " " + localStorage.timelineTime;
    }
    $.postJSON(s1, json).done(function (data) {
      routesJson = data;
      routesJsonFull = data;
      stopsQuery();
      queryBuses();
    });
  }
  //console.log("getRoutes: generated title s="+s);
  //???? if (app_name=="") app_name="Passio GO! "+s;
  //$("#headerTitle").html(app_name);

  operateFavorite();
}

function emulateClick(e) {
  console.log("emulateClick e.keyCode=" + e.keyCode)
  if (e.keyCode === 13)
    document.activeElement.onclick(e);
}

function operateFavorite(el, deleting) {
  let id = $(el).data("id");
  let title = $(el).data("title");
  if (deleting == 1) {
    noty({
      force: true, layout: 'center', type: 'warning', timeout: 5000, modal: true, killer: true,
      text: "Remove from Favorites?",
      buttons: [{ addClass: 'btn btn-default', text: 'No' }, {
        addClass: 'btn btn-danger', text: 'Yes', onClick: function ($noty) {
          favoriteOnSwitch(el)
          $noty.close();
        }
      }],
      callback: { afterShow: function () { $("#noty_center_layout_container").find("button").focus() } }
    })
    return;
  }
  //refresh
  let dropdown = []
  for (var ki = 0; ki < localStorage.length; ki++) {
    var key = localStorage.key(ki);
    var val = localStorage.getItem(key);
    if (key.indexOf("fav") == 0 && val == 1) {
      var uid = key.substr(3);
      //console.log("operateFavorite: key="+key+", uid="+uid)
      dropdown.push('<li><a class="ripple" style="font-size:14px;">'
        + '<i class="glyphicon glyphicon-heart" style="margin-right:7px;color:blue; cursor: url(\'img/cursor_delete.png\'), auto;" title="Remove from Favorites" data-uid=' + uid
        + ' onClick="operateFavorite(this,1);" onkeydown="emulateClick(event)" tabindex="7"></i> '
        + "<span data-uid=" + uid + " onClick=\"dropdownSelectFav(this);\" onkeydown=\"emulateClick(event)\" tabindex=\"7\">"
        + (localStorage.getItem("title" + key) ? localStorage.getItem("title" + key) : uid) + "</span>"
        + '</a></li>');
    }
  }
  if (!dropdown.length)
    dropdown.push("<li><a>No favorite stop yet</a></li>");
  $("#favDropdown ul").html(dropdown.join(""));
}
function dropdownSelectFav(el) {
  let uid = $(el).data("uid");
  if (uid.indexOf("stop") == 0) {
    let id = uid.substr(4)
    //console.log("dropdownSelectFav: uid="+uid+", => id="+id);
    zoomToStop(this, id);
  }
}
function favoriteOnSwitch(el) {
  //"<button class='btn btn-default btn-sm' title='Favorite' data-uid='"+theStopId+"' 
  //style='"+(localStorage.getItem("fav"+theStopId)==1?"color:blue;":"")+"' onClick='favoriteOnSwitch(this);'><i class=\"glyphicon glyphicon-heart\"></i></button>"
  var uid = $(el).data("uid");
  var wasSelected = localStorage.getItem("fav" + uid) == 1 ? 1 : 0;
  //console.log("favoriteOnSwitch: will set selected="+(1-wasSelected)+" for "+uid);
  $(el).css("color", wasSelected ? "black" : "blue");
  localStorage.setItem("fav" + uid, 1 - wasSelected);
  if (!wasSelected && $(el).data("title")) {
    let title = $(el).data("title")
    //console.log("favoriteOnSwitch saves title="+title+" from "+$(el).data("title"))
    localStorage.setItem("titlefav" + uid, title);
  }
  $(el).effect('highlight', { color: "blue" }, 1000)
  operateFavorite();
}




//for old UI ver.1
function routesSelector() {
  $("#headerTitle").html("Select Routes | Passio GO!")
  //console.log("routesSelector");
  if (Modernizr.flexbox)
    $("#routeSelector").css('display', 'flex');//show();//'slide',{direction: 'left'}, 350);
  else
    $("#routeSelector").show();
  var amount = 0;
  var json = JSON.parse('{}');
  var agencyNames = "";
  for (var ki = 0; ki < localStorage.length; ki++) {
    var key = localStorage.key(ki);
    var val = localStorage.getItem(key);
    if (key.indexOf("system") == 0 && val == 1) {
      var id = parseInt(key.substr(6));
      json["systemSelected" + amount] = id;
      amount++;
      $.each(systemsJson, function (key, val) {
        if (+val.id == +id)
          agencyNames += (agencyNames.length > 0 ? ", " : "") + val.fullname;
      });
    }
  };
  var container = $("#routeSelectorGrid");
  var sortMode = 1;
  if (amount > 0) {
    container.html("<img src=img/loader.gif>");
    var s1 = myServer() + "mapGetData.php?getRoutes=1&deviceId=" + deviceId + "&sortMode=" + sortMode + "&credentials=1"; //if sortMode is persist, routes will be grouped
    if (localStorage.optionDoNotLocateMe != 1)
      s1 += "&lat=" + localStorage.mLastLocationLat + "&lng=" + localStorage.mLastLocationLng;
    if (timelineIsActive) {
      json.timelineIsActive = timelineIsActive;
      json.timelineDatetime = localStorage.timelineDate + " " + localStorage.timelineTime;
    }
    json.amount = amount;
    //if (localStorage.optionTestMode==1) s1+="&testMode=1";
    //console.log("routesSelector: " + s1+"&json="+JSON.stringify(json));
    $.postJSON(s1, json)
      .done(function (data) {
        //console.log("routesSelector: ",data);
        //23012020 Scott: Android/iOS/Web Route list should appear in alphabetic numeric order.
        //25012020 Scott: I'm expecting the Routes to be in order but first grouped by Active/Inactive
        routesJson = [];
        for (i = 0; i < 2; i++) {
          $.each(data, function (key, val) {
            if (val.outdated == i)
              routesJson.push(val);
          });
        }
        $("#rightMenuToggleSelected").show();
        container.jsGrid({
          height: "95vh",
          width: Gx < 767 ? "100%" : "80%",
          sorting: true,
          data: routesJson,

          rowClass: function (item, itemIndex) {
            return "client-" + (itemIndex % 2);
          },
          rowRenderer: function (item) {
            var selected = localStorage.getItem('route' + item.myid) == 1;
            console.log("check checked for " + 'route' + item.myid + " = " + localStorage.getItem('route' + item.myid));
            var $checkbo = $("<div>").css("margin", Gx < 767 ? 3 : 5).append(
              '<div class="material-switch" style="display:flex; justify-content: space-between; align-items: center; " tabindex="9">'
              + '<input id="routeSwitch' + item.myid + '" type="checkbox" onchange="routeOnSwitch(\'' + item.myid + '\');"'
              + (selected ? " CHECKED" : "") + '>'
              + '<label for="routeSwitch' + item.myid + '" class="label-success" alt="toggle route"></label>'
              + '</div>');

            //22062019 var f=$.c ookie('favRoute'+item.myid)==1;
            //var $favorit = $("<div>").css("cursor","pointer").click({"type":"favR REMAKE TO DATA oute","id":item.myid}, fav oriteOnSwitch).append('<img id="favImg'+item.myid+'" src=img/ic_fav orite_'+((f==1)?"selected":"gray")+'.svg>');
            var $favorit = "<a href=?route=" + item.myid + " target=_new><i class=\"glyphicon glyphicon-new-window\"></i></a>";

            //item.outdated=Math.floor(Math.random()*2);
            //console.log("item.outdated="+item.outdated+", ((item.outdated || item.archive)="+((item.outdated || item.archive)));
            //if (item.name.length<6 && item.name.toLowerCase().indexOf("route")<0)
            //    item.name="Route "+item.name;
            if (item.outdated == 1) {
              item.fullname = "Inactive";
              if (item.serviceTime && item.serviceTime != "")
                if (item.serviceTimeShort)
                  item.fullname += ". " + item.serviceTimeShort;
                else
                  item.fullname += ". Service " + item.serviceTime;
            }
            //if (item.groupColor) console.log("item.groupColor="+item.groupColor);
            var color = item.groupColor ? item.groupColor : item.color;
            if (color.length == 9)
              color = "#" + color.substring(3, color.length);
            if (color == "" || color.length < 6)
              color = "#808080";
            var shortnameBadge = item.shortName && item.shortName != "" ? "<div class=\"routeScreenRbadge\" style=\"background:" + color + ";\"><span>" + item.shortName + "</span></div>" : "";
            var $info = $("<div>").css("margin", Gx < 767 ? 3 : 5).css("overflow", "hidden")
              .append($("<p>")
                .append($("<strong>")
                  .addClass("client-row")
                  .css("cursor", "pointer").click({ "id": item.myid }, routeOnSwitch)
                  .css("color", item.outdated == 0 ? "#000000" : "#666666")
                  .css("overflow", "hidden")
                  .css("white-space", "nowrap")
                  .css("text-overflow", "ellipsis")
                  .css("display", "flex")
                  .append(shortnameBadge)
                  .append(item.nameOrig)
                )
                /*.css("text-decoration",(item.outdated==1?"line-through":"none")).text(item.name)))*/
                .append($("<p>").css("font-style", "italic").text(item.fullname)))
              //.append(item.latitude && item.longitude?$("<p>").text("Location: " + item.latitude+", "+item.longitude):"")
              ;
            return $("<tr>").css("border-bottom", "1px solid #f1f1f1").attr("id", "tr" + item.myid).addClass(selected ? "client-selected" : "")
              .append($("<td>").css("width", Gx < 767 ? (Gx - 100) : "auto")
                .css("display", "flex").css("align-items", "center").append($checkbo).append($info))
              .append($("<td>").css("width", Gx < 767 ? 50 : "5%").css("text-align", "center").append($favorit))
              .append($("<td>").css("width", Gx < 767 ? 50 : "10%").css("background", color)
                .css("display", sortMode == 0 ? "" : "none")
                .append($("<p>")
                  .css("font-size", Gx < 767 ? 15 : 25)
                  .css("text-shadow", "0px 0px 3px #ffffff")
                  .css("text-align", "center").text(
                    item.distance > 0 ? item.distance + " mi" : "---")))
              ;
          },

          fields: [
            { title: "Public routes of " + agencyNames, name: "name", type: "text", width: "auto", css: "client-row" },
            { title: "URL", name: "", type: "text", width: "5%", css: "client-row" },
            { title: "Distance", name: "distance", type: "number", width: "10%", visible: sortMode == 0, css: "client-row" },
          ]
        });// */
      })
      .fail(function (data, msg) {
        console.log("error: " + msg + "," + JSON.stringify(data));
        container.html("Error loading routes");
      });
  } else {
    container.html("Select an agency first!");
  }
}
//for new UI ver.2
function routesSelector2() {
  var amount = 0
  var json = {}
  for (var ki = 0; ki < localStorage.length; ki++) {
    var key = localStorage.key(ki);
    var val = localStorage.getItem(key);
    if (key.indexOf("system") == 0 && val == 1) {
      var id = parseInt(key.substr(6));
      json["systemSelected" + amount] = id;
      amount++;
    }
  };
  var container = $("#menu_item_routes2 ul");
  if (!amount) {
    console.log("routesSelector2 imm ret, amount=" + amount)
    container.html("Select an agency first!");
    return
  }
  container.html("<div style='padding:20px; display:flex; align-items:center;'><img src=img/loader45.gif style='width:20px; height:20px;'><span style='font-size:10px; color:#a1a1a1;'>loading...</span><div>");
  var s1 = myServer() + "mapGetData.php?getRoutes=2&deviceId=" + deviceId + "&sortMode=1&credentials=1"; //if sortMode is persist (with any value), then routes will be grouped
  if (localStorage.optionDoNotLocateMe != 1) s1 += "&lat=" + localStorage.mLastLocationLat + "&lng=" + localStorage.mLastLocationLng;
  if (timelineIsActive) {
    json.timelineIsActive = timelineIsActive;
    json.timelineDatetime = localStorage.timelineDate + " " + localStorage.timelineTime;
  }
  json.amount = amount;
  if (debug) s1 += "&debug2=1"
  $.postJSON(s1, json).always(function (data) {
    if (!data || !data.all) {
      container.html("Error loading routes");
      console.log("routesSelector2 Error loading routes")
      return
    }
    routesJson = [];
    var routeS = [];
    let outdated = 0
    for (var i = 0; i < 2; i++) {
      $.each(data.all, function (key, item) {
        //sort in ABC, grouped by Active/Inactive
        if ((item.outdated | 0) == i) {
          routesJson.push(item);
          if (i == 1) outdated++
          //making <li>
          var selected = localStorage.getItem('route' + item.myid) == 1;
          var color = item.groupColor ? item.groupColor : item.color;
          if (color.length == 9)
            color = "#" + color.substring(3, color.length);
          if (color == "" || color.length < 6 || item.outdated == 1)
            color = "#808080";
          var shortnameBadge = item.shortName && item.shortName != "" ? "<div class=\"routeBadge\" style=\"background:" + color + ";\"><span>" + item.shortName + "</span></div>" : "";

          var fullname = "";
          if (item.outdated == 1) {
            fullname += "Inactive";
            if (item.serviceTime && item.serviceTime != "")
              if (item.serviceTimeShort)
                fullname += ". " + item.serviceTimeShort;
              else
                fullname += ". Service " + item.serviceTime;
          } else {
            if (item.fullname) fullname += item.fullname;
            if (item.distance > 0) fullname += ", " + item.distance + " mi.";
          }

          var stopnames = [];
          let usedStopIds = []
          if (routes != null && stops != null) {
            //console.log("routesSelector2: item["+key+"]=",item)
            let routesInTheGroup = []
            if (item.groupId && groupRoutes)
              $.each(groupRoutes, function (thisUserId, thisRoutes) {
                $.each(thisRoutes, function (keyRG, valueRG) {
                  if (valueRG.routeGroupId == item.groupId)
                    routesInTheGroup.push(keyRG)
                })
              });
            //console.log("routesSelector2: routesInTheGroup=",routesInTheGroup);
            $.each(routes, function (keyRoutes, routestops) {
              if (keyRoutes == item.myid || routesInTheGroup.indexOf(keyRoutes) >= 0) {
                //console.log("routesSelector2: routestops["+item.myid+"]=",routestops);
                for (ii = 3; ii < routestops.length; ii++) {
                  if (usedStopIds.indexOf(routestops[ii][1]) >= 0) continue
                  usedStopIds.push(routestops[ii][1])
                  var sID = "ID" + routestops[ii][1];
                  if (stops[sID] != null) {
                    //if (debug) console.log('routesSelector2: stops[keyRoutes='+keyRoutes+']['+sID+']=',stops[sID]);
                    stopnames.push("<div class='routestopsDetailStop' data-stopid='" + routestops[ii][1] + "' data-lat='" + stops[sID].latitude + "' "
                      + " data-lng='" + stops[sID].longitude + "' onClick='zoomToStop(event);' title='Show location'>"
                      + "<div class='thestop' style='background:" + routestops[1] + ";'>"
                      //04122023 b/c it doesn't reflect true pos anymore! +routestops[ii][0]
                      + "</div> " + stops[sID].name + "</div>");
                  }
                }
                //04122023 get all from group! return false;//break
              }
            });
          } //else console.log("routesSelector2 no routes or stops");

          if (localStorage.optionAccessibilityMode == 1)
            routeS.push(
              '<li class="pushy-submenu-clickable pushy-table grayed" data-routeid="' + item.myid + '" '
              + ' style="display:flex; justify-content: space-between; align-items: center; border-top: 1px dashed #80808025;padding-top: 5px;">'
              + '<div style="display:flex; flex-direction:column;">'
              + '<div style="width:315px;overflow: hidden;white-space: nowrap; font-size:20px; font-weight: bold;" id="routename2fit' + item.myid + '" '
              + ' title="' + item.nameOrig + '" >'
              + shortnameBadge + item.nameOrig + '</div>'
              + '</div>'
              + '<label alt="toggle ' + item.nameOrig + '" title="toggle ' + item.nameOrig + '">'
              + '<input id="routeSwitch' + item.myid + '" type="checkbox" onchange="routeOnSwitch(\'' + item.myid + '\');"' + (selected ? " CHECKED" : "") + ' tabindex="2">'
              + '</label>'
              + '</li>')
          else
            routeS.push(
              '<li class="pushy-submenu-clickable pushy-table material-switch grayed" data-routeid="' + item.myid + '" '
              + ' style="display:flex; justify-content: space-between; align-items: center; border-top: 1px dashed #80808025;padding-top: 5px;" '
              + ' title="Hover to show, click for zoom, toggle to fix">'
              //+'<button class="btn btn-default"></button>'
              + '<div style="display:flex; flex-direction:column;" tabindex="2">'
              ///-----------------V here remember about .pushy.pushy_wider width. About (wider-75)
              + '<div style="width:315px;overflow: hidden;white-space: nowrap; font-size:20px; font-weight: bold;" id="routename2fit' + item.myid + '" '
              + ' title="' + item.nameOrig + '" >'
              + shortnameBadge + item.nameOrig + '</div>'
              + "<div style='margin-bottom:5px;display:flex;'>"
              + (item.goShowSchedule == 1 ? '<div class="btn btn-default btn-sm" style="width:20px; height:20px;padding:0px;    margin-right: 10px;outline: none;" '
                + ' onClick="showSchedule(this);" onkeydown="emulateClick(event)" data-id="' + item.myid + '" title="Schedule" tabindex="2"><img src=img/ic_schedule2.svg style="width:20px; height:20px;" alt=""></div>' : '')
              + '<div style="width:290px;white-space: nowrap; font-size:14px; color:' + (item.outdated == 0 ? color : "#666666") + ';" id="routefullname2fit' + item.myid + '" onClick="showRouteDetails(\'' + item.myid + '\');">'
              + '<i class="glyphicon glyphicon-chevron-down" style="font-size: 12px;margin-right: 3px;color:#000000;"></i>'
              + (fullname ? fullname : "show stops")
              + '</div>'
              + "</div>"
              + '<div class="routeDetailsDiv" style="display:none;font-size: 14px; padding: 5px;" id="routedetails2fit' + item.myid + '">'///<div>Stops</div>'
              + stopnames.join("")
              + "<hr style='margin: 8px;'>"
              + "<div style='font-size: 10px; opacity:0.5;'>Direct <a href=?route=" + item.myid + " target=_new style='display: contents;'>link to the route"/*+location.protocol+"//"+location.hostname+"/?route="+item.myid*/ + "</a></div>"
              + '</div>'
              + '</div>'
              + '<input id="routeSwitch' + item.myid + '" type="checkbox" onchange="routeOnSwitch(\'' + item.myid + '\');"' + (selected ? " CHECKED" : "") + ' >'
              + '<label for="routeSwitch' + item.myid + '"  alt="toggle route" onkeydown="emulateClick(event)" '
              + ' style="flex-shrink: 0; margin:10px; margin-top: 25px;align-self: flex-start;  filter: opacity(0.5) drop-shadow(0 0 0 ' + color + ') drop-shadow(0px 0px 0px ' + color + ')">'
              + '.</label>'
              + '</li>');
        }
      });
    }
    container.html(routeS.join(""));

    //postproduction
    $.each(data.all, function (key, item) {
      if ($('#routename2fit' + item.myid).length) textFit($('#routename2fit' + item.myid)[0], { minFontSize: 14, maxFontSize: 18 });//https://github.com/STRML/textFit
      if ($('#routefullname2fit' + item.myid).length) textFit($('#routefullname2fit' + item.myid)[0]);//https://github.com/STRML/textFit
    });
    $("#menu_item_routes2 .pushy-table").mouseenter(function () {
      if (!$(".pushy").hasClass("pushy_wider")) {
        $(".pushy").addClass("pushy_wider");
        $(".site-header").addClass("pushy-open-left_wider");
      }
      //console.log("routesSelector2 highlightRoute call")
      highlightRoute([$(this).data("routeid")]);
    });
    $("#menu_item_routes2 .pushy-table").mouseleave(function () {
      unhighlightAll()
    });
    $("#menu_item_routes2 .pushy-table").on("click", function () {
      highlightRoute([$(this).data("routeid")], { zoom: true });
    });
    $("#menu_item_routes2 .pushy-table").on("keydown", function () {
      //onkeydown=\"emulateClick(event)\"
      highlightRoute([$(this).data("routeid")], { zoom: true });
    });

  })
}
function showSchedule(el) {
  var routeId = $(el).data("id");
  var stopId = $(el).data("stopid");
  $("#bottomPanel").addClass("bottomPanelOpen");
  $("#bottomPanel").css("height", 100);
  $("#bottomPanelDiv").html("loading... <img src=img/loader.gif style='width:20px; height:20px;'>");
  var s1 = myServer() + "mapGetData.php?schedule=4&deviceId=" + deviceId + "&routeId=" + routeId + "&stopId=" + stopId + "&r=" + Math.random();
  if (timelineIsActive) s1 += "&timelineIsActive=1&timelineDatetime=" + encodeURIComponent(localStorage.timelineDate + " " + localStorage.timelineTime);
  $.getJSON(s1).done(function (data) {
    var s = [];
    if (data && data.routes && Object.keys(data.routes).length > 0) {//[routeId] && data.routes[routeId].routeStops){
      //get only 1st route despite on how much they are here. todo support more! 02092023
      routeId = Object.keys(data.routes)[0]
      var stopIdx = 0;
      data.routes[routeId].routeColor = correctColorFromARGB(data.routes[routeId].routeColor != "" ? data.routes[routeId].routeColor : "#808080");
      $.each(data.routes[routeId].routeStops, function (key, value) {
        stopIdx++;
        var timepoints = [];
        if (value.timepoints) {
          var idx = -1;
          $.each(value.timepoints.past, function (key1, value1) {
            timepoints.push("<label class=\"scheduleTimeLabel\" style=\"color:" + (idx == 0 ? "#aa0000; font-weight:bold;" : true ? "#a1a1a1" : "#000000") + "\">"
              + value1 + "</label>");
          });
          $.each(value.timepoints.next, function (key1, value1) {
            idx++;
            timepoints.push("<label class=\"scheduleTimeLabel\" style=\"color:" + (idx == 0 ? "#aa0000; font-weight:bold;" : false ? "#a1a1a1" : "#000000") + "\">"
              + value1 + "</label>");
          });
        }
        s.push("<tr style='height: 30px;'><td style=\"min-width: 50px; max-width:300px; overflow:hidden; text-align:left;display: flex;flex-wrap: nowrap;align-items: center; cursor:pointer;\" "
          + " onClick='zoomToStop(null," + value.stopId + ")' title='"
          + (value.onDemandStop ? "OnDemand stop" : "Zoom to the stop") + "' "
          + " >"
          + "<span class='scheduleTimeStopNo' style='background:"
          + (value.onDemandStop ? "rgba(5, 195, 221, 0.35)" : data.routes[routeId].routeColor) //oDS 11092025 by Tim
          + ";'>"
          //28092023 cuz diff routes may be merged +stopIdx//25022022 cuz hidden stops! value.position
          + "</span>"
          + "<b style='white-space: nowrap; margin:0px 7px; '>" + value.stopName + "</b></td>"
          + "<td>" + (value.rideRequestStop && localStorage.goRideRequestEnabled == 1 ?
            "<button class='btn btn-default btn-sm' style='border-radius:50%;background:" + colorPrimary + ";width: 30px;height:30px;padding: 0;' title='Request a Ride' onclick='requestRideFABClick(this)' data-stopid='" + value.stopId + "'>"
            + "<img src=img/man-and-bus0.svg style='width: 70%;'>"
            + "</button>"
            : "") + "</td>"
          + "<td width=* style=\"padding-left:10px; border-bottom:1px solid #e5e5e5;overflow:hidden;text-align:left;\"><nobr>"
          + (timepoints.length > 0 ? timepoints.join("") : (data.routes[routeId].routeStops.length < 2 ? "no public timepoints" : ""))
          + "</nobr></td></tr>");
        //console.log("showSchedule timepoints["+key+"] ",timepoints);
      });
    }
    if (s.length > 0) {
      var ret = "<table style=\"width:auto; max-width:90vw;\" class=\"rightScheduleTable\">"
        + "<tr><td colspan=4 style=\"text-align:left; font-size:16px;padding:7px;\">"
        + "<div style=\"text-align:center; max-width:90vw; font-size:18px; color:" + data.routes[routeId].routeColor + ";\"><b>" + data.routes[routeId].routeName + "</b></div>"
        + "</td></tr>"
        + s.join("")
        + "</table></div>";
      $("#bottomPanelDiv").html(ret);
      $("#bottomPanel").css("height", Math.min(Gy * 0.7, 60 * (stopIdx + 1)));
    } else {
      if (data && data.routes && data.routes[routeId] && data.routes[routeId].schedule_url)
        $("#bottomPanelDiv").html("<a href=" + data.routes[routeId].schedule_url + " target=_newss>Click to open official schedule</a>");
      else
        $("#bottomPanelDiv").html("No public schedule");
      $("#bottomPanel").css("height", 100);
    }
  })
    .fail(function (data, msg) {
      $("#bottomPanelDiv").html("Error loading schedule");
      $("#bottomPanel").css("height", "100px");
    });
}
function showRouteDetails(routeId) {
  //console.log("showRouteDetails("+routeId+")");
  var wasVisible = $("#routedetails2fit" + routeId).css("display") != "none";
  $(".routeDetailsDiv").hide(150);
  if (!wasVisible) {
    $("#routedetails2fit" + routeId).show(250);
  }
}
function zoomToStop(e, stopId) {
  //console.log("zoomToStop(stopId="+stopId+")",e);
  if (!stopId) {
    e.stopPropagation();
    var el = $(e.target);
    //console.log("zoomToStop(stopId="+stopId+") stopid=",el.data("stopid"));
    if (!el.data("stopid")) el = el.parent();
    //console.log("zoomToStop(stopId="+stopId+") el=",el);
    /*var lat=el.data("lat");
    var lng=el.data("lng");
    if (lat && lng){
        //console.log('zoomToStop: lat='+lat+", lng="+lng);
        map.panTo(new google.maps.LatLng(+lat,+lng));
        if (map.getZoom()<18) animateMapZoomTo(map,18); 
    }*/
    stopId = el.data("stopid");
  }
  clearStopblinkInterval();
  $("#bottomPanel").removeClass("bottomPanelOpen");
  var found = false;
  if (stopMarkers != null)
    for (var j = stopMarkers.length - 1; j >= 0; j--) {
      if (stopMarkers[j].stopId == stopId) {
        //console.log("zoomToStop: stopMarkers[j]=",stopMarkers[j]);
        found = true;
        map.setCenter(stopMarkers[j].position);//new google.maps.LatLng(+lat,+lng));
        setTimeout(function () {
          google.maps.event.trigger(stopMarkers[j], 'click')
        }, 250)
        break;
      }
    }
  if (!found && el && el.data && el.data("lat")) {
    found = true
    //console.log("zoomToStop: no stopmarker, get latLng");
    map.panTo(new google.maps.LatLng(+el.data("lat"), +el.data("lng")));
  }
  if (!found && stops && Object.keys(stops).length)
    //last chance
    $.each(stops, function (key, stop) {
      if (stop.id == stopId) {
        //console.log("zoomToStop: stopMarkers[j]=",stopMarkers[j]);
        found = true;
        let position = new google.maps.LatLng(+stop.latitude, +stop.longitude)
        map.setCenter(position);
        //setTimeout(function(){google.maps.event.trigger( stopMarkers[j], 'click')},250)
        setTimeout(function () {
          blinkedStopMarker = new google.maps.Marker({ map, animation: google.maps.Animation.DROP, position: position, });
          blinkedStopMarker.addListener("click", clearStopblinkInterval);
          bounceMarkerTimeout = setTimeout(function () { clearStopblinkInterval() }, 7500);
        }, 750);
        return false;
      }
    })
  if (map.getZoom() < 18) map.setZoom(18)//animateMapZoomTo(map,18); 
}
function clearStopblinkInterval() {
  if (blinkedStopMarker) {
    //console.log("blinkedStopMarker.alsoAnimatedJ="+blinkedStopMarker.alsoAnimatedJ);
    if (blinkedStopMarker.alsoAnimatedJ) {
      stopMarkers[blinkedStopMarker.alsoAnimatedJ].setAnimation(null);
    }
    blinkedStopMarker.setMap(null);
    blinkedStopMarker = null;
  }
  if (bounceMarkerTimeout) {
    clearInterval(bounceMarkerTimeout);
  }
}


function toggleRoutesSwitches() {
  var newState = 1;
  //console.log("toggleRoutesSwitches routesJson=",routesJson,"routesJsonFull=",routesJsonFull)
  $.each(routesJsonFull, function (key, val) {
    if (newState === 1 && localStorage.getItem('route' + val.myid) == 1) newState = 0
    //console.log("toggleRoutesSwitches newState:="+newState)
    localStorage.setItem("route" + val.myid, val.outdated == 0 ? newState : 0)//25072024 WTF "false");
    $("#routeSwitch" + val.myid).prop("checked", localStorage.getItem("route" + val.myid) == 1);
    //console.log("toggleRoutesSwitches["+key+"]: checked?"+$("#routeSwitch"+val.myid).prop("checked")+" cuz localStorage.getItem(\"route\""+val.myid+")="+localStorage.getItem("route"+val.myid)+" and outdated="+val.outdated+" and newState="+newState);
  });
  refreshSelectedRoutes()
  highlightRoute();//refresh
}
function rightMenuClick(event) {
  var id = $(window.event.target).attr("id") || $(window.event.target).parent("button").attr("id");
  if (!id)
    id = $(window.event.target).parent().attr("id");
  //console.log("rightMenuClick, id="+id);
  if (id == "rightMenuToggleSelected") {
    toggleRoutesSwitches();
  } else if (id == "rightMenuMessages" || id == "alertRedString" || id == "alertRedPopup") {
    //08022022 ask permissions 1st time
    if ($("#messages").css("display") == "none")
      setTimeout(function () {
        let permission = typeof Notification != "undefined" ? Notification.permission : "";
        //console.log('rightMenuClick: permission='+permission);
        if (permission == "default")
          getGCMToken();
      }, 3000)
    //open msgs
    toggleMessages();
  } else if (id == "rightMenuNavigator") {
    if ($("#navigator").css("display") != "none") {
      $("#navigator").hide();
      return;
    }
    if (Modernizr.flexbox)
      $("#navigator").fadeIn("fast").css("display", "flex");
    else
      $("#navigator").show();
    $("#navigator").draggable();

  }
}

function routeOnSwitch(event) {
  var id = event.data ? event.data.id : parseInt(event);
  //console.log("routeOnSwitch: for save id="+id);
  if (event.data) {
    //logo clicked
    $("#routeSwitch" + id).prop("checked", !$("#routeSwitch" + id).prop("checked"));
  }
  $("#routeSwitch" + id).prop("checked") ? $("#tr" + id).addClass("client-selected") : $("#tr" + id).removeClass("client-selected");
  //and save
  $.each(routesJson, function (key, val) {
    localStorage.setItem("route" + val.myid, $("#routeSwitch" + val.myid).prop('checked') ? 1 : 0);
  });
  refreshSelectedRoutes()
  queryBuses()//for speed up 
}

function updateUI(dontReset) {
  //console.log("updateUI(dontReset="+dontReset+"),system sJson=",systemsJson);
  var logo = 0;
  if (!dontReset && systemsJson) {
    localStorage.agencyId = 0;
    localStorage.fullname = "";
    localStorage.homepage = "";
    localStorage.logoUrl = "";
    localStorage.goColor = "";
    localStorage.systemSelectedUsername0 = "";
    localStorage.goAgencyName = "";
  }
  //obsolete for(var ki=0; ki<localStorage.length; ki++) {var key = localStorage.key(ki);        var val = localStorage.getItem(key); if (key.indexOf("system")==0 && val==1){ .. +key.substr(6)
  let knownSystems = []
  $.each(systemsJson, function (key, val) {
    //console.log("updateUI: set?"+localStorage.getItem("system"+val.id)+" for "+val.id+". "+val.username);
    if (localStorage.getItem("system" + val.id) == 1) {
      //console.log("updateUI: selected["+key+"] ",val);
      knownSystems.push("system" + val.id)
      //15062022 amountOfSelectedSystems++;
      //ÑÑ‚Ð¾ Ð²Ñ‚Ð¾Ñ€Ð¸Ñ‡Ð½Ð¾Ðµ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ. Ð¿ÐµÑ€Ð²Ð¾Ðµ Ð² queryAlerts
      if (localStorage.logoUrl == "" && val.logo)
        setLogo(val.id);
      if (!localStorage.agencyId || localStorage.agencyId == 0) localStorage.agencyId = val.id;
      if (localStorage.fullname == "") localStorage.fullname = val.fullname;
      //if (localStorage.goAgencyName=="") localStorage.goAgencyName=val.goAgencyName?val.goAgencyName:val.username;
      if (localStorage.homepage == "" && val.homepage) localStorage.homepage = val.homepage;
      if (localStorage.goColor == "" && val.goColor) localStorage.goColor = val.goColor;
      if (localStorage.systemSelectedUsername0 == "") localStorage.systemSelectedUsername0 = val.username;
    }
  });
  $("#agencyLogo").attr("src", localStorage.logoUrl != "" ? localStorage.logoUrl : "img/ico100.png");
  $("#agencyLogo").attr("alt", localStorage.fullname)

  //fix, if some agency was selected but hidden now
  //console.log("updateUI =knownSystems",knownSystems)
  if (knownSystems.length > 0)
    for (var ki = 0; ki < localStorage.length; ki++) {
      if (localStorage.key(ki).indexOf("system") == 0 && localStorage.getItem(localStorage.key(ki)) == 1 && knownSystems.indexOf(localStorage.key(ki)) < 0) {
        console.log("updateUI removed hidden agency " + localStorage.key(ki) + ", knownSystems=", knownSystems)
        localStorage.removeItem(localStorage.key(ki))
      }
    };

  var amountOfSelectedSystems = getAmountOfSelectedSystems()//15062022
  //console.log("updateUI: amountOfSelectedSystems="+amountOfSelectedSystems+" from "+systemsJson.length+" agencies");
  $("#agencyLogo").css("width", localStorage.logoUrl != "" ? 150 : 50);
  if (amountOfSelectedSystems > 1)
    localStorage.fullname += " +" + (amountOfSelectedSystems - 1) + " system" + (amountOfSelectedSystems > 2 ? "s" : "");
  app_name = (localStorage.fullname && localStorage.fullname != "" ? localStorage.fullname + " | " : "") + "Passio GO!";
  document.title = app_name;
  $("#headerTitle").html(app_name);
  $("#app_promo_menutitle").html(app_name);
  //if (!newRouteUI) textFit($('#app_promo_menutitle')[0]);//https://github.com/STRML/textFit
  $("#menu_item_agencies").css("background", "")

  if (!localStorage.goColor || localStorage.goColor == "")
    localStorage.goColor = "#6ebd52";
  if (localStorage.optionAccessibilityMode == 1) {
    localStorage.goColor = "#000000"
  }
  colorPrimary = localStorage.goColor;
  $(".site-header").css("background", localStorage.goColor);
  $("#drawer_header").css("background", localStorage.goColor);
  //console.log("updateUI: goColor="+localStorage.goColor);

  // $(".back .client-compacted").css("background", "#4A7F52");


  app_promo_url = localStorage.homepage && localStorage.homepage != "" ? localStorage.homepage : "www.passiotech.com";

  $("#mobile_app_deeplinks").prop("href", "https://passio3.com/www/GO/mobile_app_deeplinks.php?id=" + (localStorage.agencyId | 0) + "&username=" + localStorage.username);
  //console.log("checkAtLeastOneSystemIsSelected: app_promo_url="+app_promo_url+", app_promo_url.indexOf(\"/\")="+app_promo_url.indexOf("/")+", app_promo_url.length="+app_promo_url.length);
  //remove last splash
  var spla = app_promo_url.split("/");
  if (spla.length > 0 && spla[spla.length - 1] == "")
    app_promo_url = app_promo_url.substr(0, app_promo_url.length - 1);
  //remove http from visual link
  if (app_promo_url.indexOf("https") == 0)
    app_promo_url = app_promo_url.substr(8);
  else if (app_promo_url.indexOf("http") == 0)
    app_promo_url = app_promo_url.substr(7);
  $("#app_promo_url").html('<i class="glyphicon glyphicon-globe"></i> ' + app_promo_url);
  $("#app_promo_url").attr("href", "http://" + app_promo_url);
  textFit($("#app_promo_url"), { minFontSize: 14, maxFontSize: 20 });//set display:block! https://github.com/STRML/textFit

  $("#menu_item_feedback").css("display", localStorage.busBuzz == 1 ? "" : "none");
  //console.log("updateUI: goOsm="+localStorage.goOsm);
  map.setMapTypeId(localStorage.goOsm == 1 ? 'osm' : 'simplified_map') //'roadmap'

  $("#sharedQRCodeLink").css("display",/*localStorage.getItem("system4")==1*/localStorage.goSharedCode != "" ? "" : "none");
  $("#sharedQRCode").hide();
  $("#sharedQRCodeLink").html("Show Agency Shared QR-code");


  //external links
  var container = $(".pushy-link").parent();
  container.find(".extra_links").remove();
  var links = JSON.parse(localStorage.links && localStorage.links != "" ? localStorage.links : "[]");
  if (links.length) {
    $.each(links, function (key, value) {
      //value.icon = value.icon.replaceAll("_","-");//"_" made by server from "-" for androids
      container.append('<li class="pushy-link extra_links"><a href="' + value.url + '" target=_new style="color:#0707ff;">'
        + '<div style="position:relative; width: 25px;height: 15px;margin-right: 10px;display: inline-block;padding-left: 4px;">'
        + '<i class="fa fa-' + value.icon + '" style="position:absolute;"></i>'
        + '<i class="fab fa-' + value.icon + '" style="position:absolute;"></i>'//hack b/c no google-wallet in fa
        + '</div>'
        + ' ' + value.name + '</a></li>');
    })
  }
}

function closeMenu() {
  if ($('body').hasClass("pushy-open-left")) $('.menu-btn').click()
}

function checkAtLeastOneSystemIsSelected() {
  var atLeastOneSelected = 0;
  $.each(systemsJson, function (key, val) {
    if (localStorage.getItem("system" + val.id) == 1) {
      atLeastOneSelected = val.id;
      return false;//break
    }
  });
  //console.log("checkAtLeastOneSystemIsSelected: atLeastOneSelected="+atLeastOneSelected+", goUserId>0 ? "+(localStorage.goUserId>0),localStorage.goUserId);

  //hide Login if not need, 09112023
  $("#menu_item_login").css("display", !atLeastOneSelected || localStorage.goUserId > 0 ? "" : "none")

  if (!atLeastOneSelected) {
    setTimeout(function () {
      if (!$('body').hasClass("pushy-open-left")) {
        $('.menu-btn').click()
      }
      setTimeout(function () {
        $("#menu_item_agencies").css("background", "yellow")
      }, 1500);//to override updateUI de-colorizing
      $("#menu_item_agencies").effect("shake").effect("highlight").effect("shake")

      noty({
        text: 'Please select an Agency to start tracking buses on routes',
        force: true,
        layout: 'center',
        type: 'error', // alert,success, error, warning, information, notification
        modal: false,
        killer: true,
        timeout: false,
        buttons: [
          {
            addClass: 'btn btn-success', text: 'Go!', onClick: function ($noty) {
              $noty.close();
              //systemsSelector();
              if ($('body').hasClass("pushy-open-left")) {
                $('.menu-btn').click();
              }
              pushyOnToggle($("#menu_item_agencies")[0]);
            }
          },
          {
            addClass: 'btn btn-default', text: 'Later', onClick: function ($noty) {
              $noty.close();
            }
          }
        ],
        callback: { afterShow: function () { $("#noty_center_layout_container").find("button").focus() } }
      });
    }, 1500);
  } else {
    //console.log('checkAtLeastOneSystemIsSelected: will getGMStoken');
    //08022022 moved to 1st msg button! getGCMToken();
    if (!deviceId && localStorage.softwareVer > 0) savePseudoTokenToServer() //08022022

    //console.log('checkAtLeastOneSystemIsSelected: will getRoutes');
    getRoutes();

    //08022022 moved to trash doSwitchToNewUI()

  }
  return atLeastOneSelected;
}

function menu_item_agencies() {
  toggleAllTitleActions(false);//hide all
  systemsSelector();
  $(".hamburger").addClass("is-active");

  var firstFocusable = $("#systemSelector").querySelector('[tabindex]');
  if (firstFocusable) {
    firstFocusable.focus();
  }
}
function getSystems() {
  //just load systems. This is not for Systems Screen!
  //the same in systemsSelector() but here is shortest
  var s = "mapGetData.php?getSystems=2&sortMode=1&deviceId=" + deviceId + "&credentials=1&acronymId=" + acronymId;
  //04102021 if (!debug) s+="&web=1" //remove it when web auth or QR will be implemented! in Sep 2021 ? and on server!
  if (localStorage.optionTestMode == 1) s += "&testMode=1";//for dev not mapapp users
  //console.log("getSystems: "+s);
  $.getJSON(s)
    .done(function (data) {
      systemsJson = data && data.all ? data.all : [];
      //console.log("getSystems: got "+systemsJson.length+" systems loaded")//,systemsJson);
      if (acronymId) {//save subdomain as selected
        $.each(systemsJson, function (key, val) {
          localStorage.setItem("system" + val.id, val.id == acronymId ? 1 : 0);
        });
      }
      checkAtLeastOneSystemIsSelected();
    })
    .fail(function (data, msg) {
      console.log("getSystems error: " + msg + "," + JSON.stringify(data));
      mytoast("Failed to load agencies");
    });
}
function systemsSelector(options) {
  if (!options) options = {}
  $("#headerTitle").html("Select an Agency | Passio GO!")
  //$("#favDropdown").show();
  $("#seachDiv").delay(1000).show(350);
  $("#seachDiv input").attr("placeholder", "Search an Agency");
  $("#seachDiv input").val("");
  $("#dotMenuDropdown").show();
  if (Modernizr.flexbox) $("#systemSelector").css('display', 'flex'); else $("#systemSelector").show();//safari. legacy from 2018
  $("#systemSelectorGrid").html("<img src=img/loader45.gif style='margin-top:200px;'>")
  var s = "mapGetData.php?getSystems=2&deviceId=" + deviceId + "&credentials=1&acronymId=" + acronymId;
  if (localStorage.optionDoNotLocateMe != 1) s += "&sortMode=3&lat=" + localStorage.mLastLocationLat + "&lng=" + localStorage.mLastLocationLng;
  if (localStorage.optionTestMode == 1) s += "&testMode=1";
  if (options.extra) s += "&extra=1"
  $.getJSON(s)
    .done(function (data_) {
      IPcoords = data_.IPcoords;
      data = data_ ? data_.all : [];//legacy from v=1. V=2 introduced 15082021, items are in "all" array now.
      //dont,seebelow systemsJson=data?data:[]; //was off dec-feb2022, on 07022022 cuz if just logged, systems are changed
      var suggestionsJQ = [];
      $.each(systemsJson, function (key, item) { suggestionsJQ.push(item.fullname) });
      $("#seachDiv input").autocomplete({
        source: suggestionsJQ,
        select: function (event, ui) {
          $("#seachDiv input").val(ui.item.value);
          navbar2search();
        }
      });
      let wasMineJO = {}
      var ww = Math.min(Gx, 1000);
      var systemsJsonClosest = [];
      let systemsJsonRest = [];
      var wasDistance = false;
      //resort & regroup them
      systemsJson = []
      for (var k = localStorage.optionDoNotLocateMe == 1 ? 1 : 0; k <= 2; k++) {
        $.each(data, function (key, jo) {
          var listMe = false;
          //nearest or mine
          if (k == 0) listMe = (jo.nearest == 1 && systemsJsonClosest.length < 8) || jo.mine == 1;
          //selected
          if (k == 1) listMe = (jo.nearest != 1) && localStorage.getItem('system' + jo.id) == 1;
          //rest
          if (k == 2) listMe = (jo.nearest != 1) && localStorage.getItem('system' + jo.id) != 1;
          //if (k>0) console.log("systemsSelector[k="+k+", id="+jo.id+"], localStorage="+localStorage.getItem('system'+jo.id)+", ==1?"+(localStorage.getItem('system'+jo.id)==1)+", !=1?"+( localStorage.getItem('system'+jo.id)!=1)+" "+jo.fullname);
          if (listMe) {
            if (k == 0) {
              //console.log("systemsSelector: closest ",jo)
              systemsJsonClosest.push(jo);
              //nearestIds.push(jo.id);
            } else {
              systemsJsonRest.push(jo);
              systemsJson.push(jo)
            }
            if (!wasDistance && jo.distance) wasDistance = true;
            if (jo.mine == 1 && !wasMineJO.id) wasMineJO = jo;
          }
        });
      }
      $("#systemSelectorGridClosest").css("display", systemsJsonClosest.length ? "" : "none");
      var height0 = systemsJsonClosest.length ? Gy * 0.25 : 0;
      //trick for jsGRid to scroll them togther: set height unlimited
      $("#systemSelector").css("height", "100%");
      $("#systemSelector").css("display", "block");
      $("#systemSelector").css("padding-left", (Gx - ww) / 2);
      $("#systemSelector").css("overflow-y", "auto");
      for (var casse = 0; casse <= 1; casse++) {
        //https://github.com/tabalinas/jsgrid
        $(casse == 0 ? "#systemSelectorGridClosest" : "#systemSelectorGrid").jsGrid({
          height: "auto",//casse==0?height0:Gy-$("header").height()-height0,
          width: ww,
          sorting: true,
          data: casse == 0 ? systemsJsonClosest : systemsJsonRest,
          rowClick: function (args) {
            if (selectedJSGridrow) selectedJSGridrow.removeClass("highlight"); selectedJSGridrow = this.rowByItem(args.item); selectedJSGridrow.addClass("highlight");
            if (args.dontClick) return;
            if (!args.event || !args.event.target || (args.event.target.nodeName != "BUTTON" && args.event.target.nodeName != "INPUT"
              && args.event.target.nodeName != "A" && args.event.target.nodeName != "LABEL")) {
              systemOnSwitch(args.item.id, true);
            }
          },
          rowClass: function (item, itemIndex) {
            return "client-" + (itemIndex % 2) + (localStorage.getItem('system' + item.id) == 1 ? " client-selected" : "");
          },
          onRefreshed: function () {
            $(".jsgrid-grid-body").css("overflow", "hidden");//trick
          },
          fields: [
            {
              title: "<h2 style='font-size:18px;margin: 7px;display: block;font-weight: bold;'>" + (casse == 0 ? "Closest Transit Systems" : "All Transit Systems") + "</h2>", name: "fullname", type: "text", width: "auto",
              itemTemplate: function (value, item) {
                var selected = localStorage.getItem('system' + item.id) == 1;
                var s = "<div style='margin-left:3px; display:flex; position:relative;' class='agencyDiv" + item.id + "'>"
                  + '<div class="material-switch" style="display:flex; justify-content: space-between; align-items: center; " tabindex="9">'
                  + '<input id="systemSwitch' + casse + "_" + item.id + '" class="systemSwitch' + item.id + '" type="checkbox" onchange="systemOnSwitch(' + item.id + ');" ' + (selected ? " CHECKED" : "") + '>'
                  + '<label for="systemSwitch' + casse + "_" + item.id + '" class="label-success" tabindex="-1"></label>'
                  + '</div>'
                  + '<div class="client-photo client-compacted" title="ID ' + item.id + '">'
                  + '<img class="client-compacted" style="position:absolute;" src="' + (item.logo ? "https://" + passiohost + "/tdb/binary/user/" + item.id + "/logo" : "img/ico100x250_2021.png") + '">'
                  + '<button class="back client-compacted flipped" onClick=\"showMap();\">GO!</button>'
                  + '</div>'
                  + '<div class="client-fullname">'
                  + '</span>' + item.fullname + '</span>'
                  + (item.homepage && item.homepage != ""
                    ? "<a href=\"" + item.homepage + "\" aria-label=\"" + item.fullname + "\" tabindex='9' target=_NEW>" + item.homepage + "</a>" : "")
                  + '</div>'
                  + "</div>"
                return s;
              }
            },
            {
              title: "Distance", name: "distance", type: "text", width: 100, visible: casse == 0 && wasDistance,
              itemTemplate: function (value, item) {
                return "<p style='font-size:" + (Gx < 767 ? 15 : 20) + "px;'>" + (item.distance > 0 ? item.distance + " mi" : "") + "</p>";
              }
            },
            { title: "Buses", name: "busAmount", type: "number", visible: options.extra == 1 },
          ]
        });
      }
      //hint about email
      if (data_.hint && data_.hint != "") {
        $("#titleHint").html(data_.hint);
        $("#titleHint").delay(2000).show(350)
          .delay(1000).effect("shake")
          .delay(1000).effect("shake")
          .delay(1000).effect("shake")
          .delay(7000).hide(750);
      }
      //auto agency selection after granted access
      if (getAmountOfSelectedSystems() == 0 && wasMineJO.id) {
        setTimeout(function () {
          systemOnSwitch(wasMineJO.id, true);//force invert
          noty({
            text: 'We found your agency and selected it:<br><br>' + wasMineJO.fullname, force: true, layout: 'center', type: 'success', timeout: false,
            buttons: [
              { addClass: 'btn btn-primary', text: 'GO!', onClick: function ($noty) { $noty.close(); showMap() } },
              {
                addClass: 'btn btn-danger', text: 'Incorrect', onClick: function ($noty) {
                  resetAllAgencies();
                  $noty.close();
                }
              }]
          });
        }, 1250);
      }
    })
    .fail(function (data, msg) {
      $("#systemSelectorGrid").html("Error loading systems");
    });
}

function resetAllAgencies() {
  for (var ki = 0; ki < localStorage.length; ki++) {
    var key = localStorage.key(ki);
    var val = localStorage.getItem(key);
    if (key.indexOf("system") == 0 && val == 1) {
      localStorage.setItem(key, 0);
    }
  };
  $.each(systemsJson, function (key, val) {
    $("#systemSwitch" + val.id).prop("checked", false);
    $(".systemSwitch" + val.id).prop("checked", false);
    $("#tr" + val.id).removeClass("client-selected");
  });
  routesJson = null;
  routesJsonFull = null;
  routesQueryJson = null;
  routes = null;
  routePoints = null;
  stops = null;
  groupRoutes = null;
  drawStopMarkers()//to clear all
  if (busMarkers != null) {
    for (var i = 0; i < busMarkers.length; i++) {
      busMarkers[i].setMap(null);
    }
    busMarkers = null
  }
  systemOnSwitch(0)
}

function systemOnSwitch(event, invert) { //n systemss
  var id = (event && event.data) ? event.data.id : parseInt(event);
  if ((event && event.data) || invert) { //event.data - obsolete, remove when newRouteUI will be implemented
    $(".systemSwitch" + id).prop("checked", !$(".systemSwitch" + id).prop("checked"));
  } else {
    $(".systemSwitch" + id).prop("checked", $(".systemSwitch" + id).prop("checked"));
  }
  //and save
  $.each(systemsJson, function (key, val) {
    let v = $("#systemSwitch" + val.id).prop('checked')
      || $(".systemSwitch" + val.id).prop('checked')
      //|| (id==val.id && force)
      ? 1 : 0;
    localStorage.setItem("system" + val.id, v);
    //if (v) console.log("systemOnSwitch["+key+"]: save system "+val.id+" := "+v);
  });
  systemsToggled = true;

  $.each(systemsJson, function (key, val) {
    //highlight selected
    $(".systemSwitch" + val.id).prop("checked")
      ? $(".agencyDiv" + val.id).parent().parent().addClass("client-selected")
      : $(".agencyDiv" + val.id).parent().parent().removeClass("client-selected");
    //animate cards
    if (id > 0 && $(".systemSwitch" + val.id).prop("checked")) {
      $(".agencyDiv" + val.id).children(".client-photo").children("img").addClass("flipped");
      setTimeout(function () {
        $(".agencyDiv" + val.id).children(".client-photo").children(".back").removeClass("flipped");
      }, 250);
    } else {
      $(".agencyDiv" + val.id).children(".client-photo").children(".back").addClass("flipped");
      setTimeout(function () {
        $(".agencyDiv" + val.id).children(".client-photo").children("img").removeClass("flipped");
      }, 250);
    }
  });

  $("#menu_item_routes2 ul").html("");
  $(".pushy-submenu").addClass("pushy-submenu-closed").removeClass("pushy-submenu-open");
  localStorage.removeItem("lastCenter");
  $("#taskDiv").jsGrid("refresh");
}

function showMap() {
  pushyOnBeforeToggle($("#menu_item_map")[0]);
  pushyOnToggle($("#menu_item_map")[0]);
}

function locationNearTheStop() {
  var lat = localStorage.mLastLocationLat;
  var lng = localStorage.mLastLocationLng;
  if (stops == null || stops.length == 0 || lat == 0 || lng == 0)
    return false;
  var res = false;
  $.each(stops, function (key, val) {
    var distance = Math.round(google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(lat, lng),
      new google.maps.LatLng(val.latitude, val.longitude)));
    //s+=distance+",";
    if (distance <= 30) {
      res = true;
      return false;
    }
  });
  return res;
}

function queryBuses() {//n busesQuery( =getbuses
  if (queryBusesTimer != null) clearTimeout(queryBusesTimer);
  let interv = Math.round(Math.min(30000, Math.max(getBusesMicrotime * 2000, minBusQueryInterval)))
  if (interv > minBusQueryInterval) console.log("queryBuses: timer interval:=" + interv + " cuz last getBusesMicrotime=" + getBusesMicrotime)
  queryBusesTimer = setTimeout(queryBuses, interv); //limiting 05092023 
  if (!map || map == null || map === undefined || routesQueryJson == null) return;

  //use WS , but if WS is dead or every 20*7 seconds refresh from REST
  if ((performance.now() - gotBusesTime < (minBusQueryInterval * 2)) && busesWereQueried >= 0 && wsBusesUsed < 20 && !debugTimeline && localStorage.optionWSmode != 1) {
    //console.log("queryBuses uses WS cuz performance.now()-gotBusesTime = "+(performance.now()-gotBusesTime)+" < "+interv+", wsBusesUsed="+wsBusesUsed)
    wsBusesUsed++
    drawBusMarkers()
    return
  }
  wsBusesUsed = 0
  var s = myServer() + "mapGetData.php?getBuses=" + (busesWereQueried < 0 || (performance.now() - excludedWereAsked > 600000) ? 1 : 2)//since 05092023 ask excludedRoutes[] only once, and then rarely
    + "&deviceId=" + deviceId + (busesWereQueried < 0 ? "&speed=1" : "")
  if (performance.now() - alertsWereAsked > 120000) {
    //ask alerts 1st time or rarely
    alertsWereAsked = performance.now()
    s += "&alertCRC=" + localStorage.alertCRC
  }
  busesWereQueried++;
  if (busesWereQueried > 1 && busesWereQueried < 10) {
    console.log("queryBuses waits for unfinished job..." + busesWereQueried)
    return
  } else if (busesWereQueried >= 10) busesWereQueried = 0

  if (localStorage.optionDoNotLocateMe != 1 && locationNearTheStop() && Math.random() < 0.1) s += "&lat=" + localStorage.mLastLocationLat + "&lng=" + localStorage.mLastLocationLng;
  if (debugTimeline) {
    routesQueryJson.timelineIsActive = timelineIsActive;
    routesQueryJson.timelineDatetime = localStorage.timelineDate + " " + localStorage.timelineTime;
  } else if (routesQueryJson.timelineIsActive) {
    delete routesQueryJson.timelineIsActive;
    delete routesQueryJson.timelineDatetime;
  }
  if (selectedRoutes.length > 0) {
    routesQueryJson.rA = selectedRoutes.length;
    for (let k = 0; k < selectedRoutes.length; k++) routesQueryJson["r" + k] = selectedRoutes[k]
  } else
    delete routesQueryJson.rA;
  $.postJSON(s, routesQueryJson).always(function (data) {
    busesWereQueried = 0
    getBusesMicrotime = (((data ? +data.microtime | 0 : 0) * 10) + (getBusesMicrotime * getBusesMicrotimeCount)) / (getBusesMicrotimeCount + 10);
    getBusesMicrotimeCount++;

    if (data && data.buses) {
      buses = data.buses;
      drawBusMarkers()
    }
    if (data && data.excludedRoutes) {
      excludedRoutes = data.excludedRoutes //since 22092023 it is pure sorted array
      excludedWereAsked = performance.now()
      let hash = checksum(JSON.stringify(excludedRoutes))
      if (excludedRoutesHash != hash) {
        //console.log("queryBuses: excludedRoutes=",excludedRoutes)
        excludedRoutesHash = hash
        routesSelector2()
        //todo 25092023 change routes opacity?
      } //else console.log("queryBuses: excludedRoutes are same",excludedRoutes)
    }
    if (data && ((data.alertCRC && data.alertCRC != localStorage.alertCRC) || data.lastPushId > 0)) setTimeout(function () { queryAlerts() }, 1000, this);
    if (data && data.time) $("#time").html(Object.values(data.time)[0])
    if (data && data.localTime) $("#localTime span").eq(1).html(data.localTime)
    if (typeof updateFabRequestRideVisibility != "undefined") updateFabRequestRideVisibility()

  })
}

function showAllRoutesHiddenHint() {
  if (!shownAllRoutesHiddenHint) {
    shownAllRoutesHiddenHint = true;
    mytoast("All routes are out of service");
  }
}

function blink(i, finalVisibility, counter) {
  if (routePaths[i]) {
    if (counter % 2 == 0)
      routePaths[i].setVisible(finalVisibility);
    else
      routePaths[i].setVisible(!finalVisibility);
    if (counter < 16) {
      var s = "blink(" + i + "," + finalVisibility + "," + (counter + 1) + ")";
      //console.log(s);
      setTimeout(s, 250);
    }
  }
}








/*************************************/

function getGCMToken(callback) {
  console.log('getGCMToken, asked4notif=' + localStorage.asked4notif)
  if (isSafari) {
    console.log('getGCMToken isSafari,so ignore....')
    //for what... savePseudoTokenToServer(callback)
    return
  }
  if (!localStorage.asked4notif && localStorage.optionAccessibilityMode != 1) {
    noty({
      text: 'In order to receive Alerts and Log in please grant required permissions',
      force: true,
      layout: 'topRight',
      type: 'warning', // alert,success, error, warning, information, notification
      modal: false, killer: true,
      timeout: false,
      buttons: [
        {
          addClass: 'btn btn-primary', text: 'Okay', onClick: function ($noty) {
            $noty.close();
            localStorage.asked4notif = 1
            getGCMToken(callback)
          }
        },
        {
          addClass: 'btn btn-danger', text: 'Later', onClick: function ($noty) {
            localStorage.asked4notif = 1
            console.log('getGCMToken will call savePseudoTokenToServer, callback=', callback)
            savePseudoTokenToServer(callback)
            $noty.close()
          }
        }
      ],
      callback: { afterShow: function () { $("#noty_center_layout_container").find("button").focus() } }
    });
    return;
  }
  console.log('getGCMToken: will call Notification permission dialog...');
  if (NotifTimer) clearTimeout(NotifTimer);
  NotifTimer = setTimeout(function () { //if blocked
    let permission = typeof Notification != "undefined" ? Notification.permission : "";
    console.log('getGCMToken: timeout, permission=' + permission);
    if (permission == "default" && !deviceId) {
      savePseudoTokenToServer(callback)
      mytoast("Please permit Notifications (small bell icon in address string above)", true)
    }
  }, 7500);
  if (typeof Notification != "undefined")
    Notification.requestPermission().then(function (permission) {
      if (NotifTimer) clearTimeout(NotifTimer);
      if (permission === 'granted') {
        console.log('getGCMToken: Notification permission granted.');
        messaging.getToken()
          .then(function (currentToken) {
            if (currentToken) {
              console.log('getGCMToken: token is available! ');//+currentToken);
              saveTokenToServer(currentToken, callback);
            } else {
              // Show permission request.
              console.log('getGCMToken: No Instance ID token available');
              savePseudoTokenToServer(callback)
            }
          })
          .catch(function (err) {
            console.log('getGCMToken: error!', err ? err.message : err, "deviceId=" + deviceId);
            savePseudoTokenToServer(callback);
          });
      } else {
        console.log('getGCMToken: Unable to get permission to notify.');
        savePseudoTokenToServer(callback)
      }
    });
}
function savePseudoTokenToServer(callback) {
  //console.log("savePseudoTokenToServer: deviceId="+deviceId+", callback=",callback)
  if (!deviceId) {
    let token = localStorage.currentToken ? localStorage.currentToken  //25102023 no doubles
      : "pseudo" + localStorage.softwareVer + "_" + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        //"pseudo101_" since ver 101 10102019, softwareVer since 109 25102023 
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      })
    saveTokenToServer(token, callback)
  }
}
function saveTokenToServer(currentToken, callback) {
  console.log("saveTokenToServer: currentToken=" + currentToken + ", callback=", callback)
  //here was a bug, fixed in 15092021: it created token on every request. So don't get any stat for webGO before Sep2021!
  if (!currentToken)
    currentToken = localStorage.currentToken;//just to refresh
  else
    localStorage.currentToken = currentToken;
  var s =/*myServer()*/""//passiogo.com/goServices.php is symlink to make x-domain cookies
    + "goServices.php?register=1&deviceId=" + deviceId + "&token=" + currentToken + "&platform=web&buildNo=" + localStorage.softwareVer + "&oldToken=" + (localStorage.currentToken ? localStorage.currentToken : "");
  $.getJSON(s).always(function (data) {
    if (deviceId != data.deviceId) console.log("Attention! changed deviceId! " + deviceId + " => " + data.deviceId);
    deviceId = parseInt(data.deviceId);
    localStorage.deviceId = deviceId;
    if (callback) callback()
  });
}

function closeBottomPanel() {
  if ($("#bottomPanel").hasClass("bottomPanelOpen"))
    $("#bottomPanel").removeClass("bottomPanelOpen");
  setTimeout(function () {
    $("#bottomPanel").css("top", "");
    $("#bottomPanel").css("height", "");
    $("#bottomPanel").css("bottom", "");
  }, 250);
}






function toggleKML() {
  //console.log("toggleKML optionLocalLayer="+localStorage.optionLocalLayer);
  if (kmlLayer != null) {
    kmlLayer.setMap(null);
    kmlLayer = null;
  }
  if (localStorage.optionLocalLayer == 1) {
    //get customer id. Old historical way
    let userId = 0;
    for (var ki = 0; ki < localStorage.length; ki++) {
      var key = localStorage.key(ki);
      var val = localStorage.getItem(key);
      if (key.indexOf("system") == 0 && val == 1) {
        userId = key.substr(6);
        break;
      }
    };
    let url =/*Google wants public URL*/"https:" + myServer() + "goServices.php?getKmz=2&userId=" + userId;
    $.ajax({
      url: url,
      dataType: 'zip',
    }).always(function (data) {
      //console.log("toggleKML got: ",data);
      kmlLayer = new google.maps.KmlLayer(url, {
        suppressInfoWindows: true,
        preserveViewport: true,
        map: map
      });
      google.maps.event.addListener(kmlLayer, 'click', function (kmlEvent) {
        //console.log("kmlLayer click ",kmlEvent.featureData);
        var text = kmlEvent.featureData.name;//description; there is latitude in description
        mytoast(text, true);
        /*var infowindow = new google.maps.InfoWindow();
        infowindow.setContent(text);
        infowindow.setPosition(kmlEvent.latLng);
        infowindow.open(map);*/// cuz bad positioning and will stay on screen
      });
    });
  }
}


function whereAmI() {
  var s = "";
  console.log("whereAmI: IPcoords=", IPcoords);
  if (IPcoords && IPcoords.IP) {
    s = "Your location is<br><a href=https://www.google.com/maps/@" + IPcoords.lat + "," + IPcoords.lng + ",12z target=_new2>" + IPcoords.lat + ", " + IPcoords.lng + "</a>";
    if (IPcoords.IP)
      s += "<br><br>We detected it by your IP " + IPcoords.IP + " and approximated address: " + IPcoords.comment;
  } else {
    s = "Sorting is OFF: unknown GPS location. Turn on locations in your browser";
  }
  mytoast(s, true)
}


//Authorization/login
function checkGoUserToken(completion) {
  let agencyId = 0
  for (var ki = 0; ki < localStorage.length; ki++) {
    if (localStorage.key(ki).indexOf("system") == 0 && localStorage.getItem(localStorage.key(ki)) == 1) {
      agencyId = localStorage.key(ki).substr(6)
      break;
    }
  };
  $.postJSON("goServices.php?mobLogin=1", {
    deviceId: deviceId,
    civilAction: 1,//check token
    agencyId: agencyId, //to refresh it
  }).always(function (data) {
    //console.log("checkGoUserToken: got ",data);
    toggleMailboxHint(data)
    if (data) {
      saveNewGoUsername(data)
      if (completion)
        completion(data)
    }
  })
}
function saveNewGoUsername(json) {
  localStorage.goUserId = json && json.id ? json.id : 0;
  localStorage.goUsername = localStorage.goUserId && json && json.username ? json.username : "";
  localStorage.goEmail = localStorage.goUserId && json && json.email ? json.email : "";
  localStorage.goUserPhoto = localStorage.goUserId && json && json.ico ? json.ico : "";
}
function toggleMailboxHint(json) {
  $("#mailboxImg").hide();
  if (json && json.id > 0 && json.verified == 0 && json.email && json.email != "") {
    if (!$("#mailboxImg").length) {
      $("#mailboxImgContainer").html('<img src="img/mailbox.gif" id="mailboxImg" title="Please confirm email! Click to open Profile" alt="" onClick="openLogin()">')
      $("#mailboxImg").tooltip()
    }
    $("#mailboxImg").show(350);
    toggle4Email2bVerified(true)
  }
}
function toggle4Email2bVerified(start) {
  if (wait4Email2bVerifiedTimer)
    clearInterval(wait4Email2bVerifiedTimer);
  if (start) {
    wait4Email2bVerified = 1
    wait4Email2bVerifiedTimer = setInterval(function () {
      if (wait4Email2bVerified <= 0 || wait4Email2bVerified > 100/*10min*/) {
        toggle4Email2bVerified()
        return
      }
      wait4Email2bVerified++
      $.postJSON("goServices.php?mobLogin=1", {
        civilAction: 1,//check token
        fast: 1
      }).always(function (data) {
        console.log("toggle4Email2bVerified: got ", data);
        if (data && data.v == 1 && wait4Email2bVerified > 0) {
          wait4Email2bVerified = 0 //stop
          goEmailVerified()
        } else if (data && data.error && data.error != "")
          wait4Email2bVerified = 0 //stop
      })
    }, 5000)
  }
}
function toggle4DeviceAuth2bVerified(pinAuthPublic_) {
  if (wait4DeviceAuth2bVerifiedTimer)
    clearInterval(wait4DeviceAuth2bVerifiedTimer);
  if (pinAuthPublic_ && pinAuthPublic_ != "") {
    pinAuthPublic = pinAuthPublic_
    wait4DeviceAuth2bVerified = 1
    wait4DeviceAuth2bVerifiedTimer = setInterval(function () {
      query4DeviceAuth2bVerified(false)
    }, 3000)
  }
}
function query4DeviceAuth2bVerified(withPin) {
  if (wait4DeviceAuth2bVerified <= 0 || wait4DeviceAuth2bVerified > 100/*10min*/) {
    toggle4DeviceAuth2bVerified()
    return
  }
  wait4DeviceAuth2bVerified++
  let json = {
    civilAction: 9,//device auth
    deviceId: deviceId,
  }
  if (withPin)
    json.pinAuthPublic = pinAuthPublic
  $.postJSON("goServices.php?mobLogin=1", json).always(function (data) {
    console.log("toggle4DeviceAuth2bVerified: got ", data);
    if (data && data.v == 1) //step 1
      query4DeviceAuth2bVerified(true)
    else if (data && data.id > 0 && wait4DeviceAuth2bVerified > 0) {//step 2
      wait4DeviceAuth2bVerified = 0 //stop
      checkGoUserToken(function () {
        goEmailVerified()
      })
    } else if (data && data.error && data.error != "")
      wait4DeviceAuth2bVerified = 0 //stop
  })
}
function goEmailVerified() {
  mytoast("Email confirmed, access granted")
  toggleMailboxHint();
  let notSelectedYet = 1;//always! getAmountOfSelectedSystems()==0
  console.log("goEmailVerified: notSelectedYet=" + notSelectedYet + ", systemSelector opened?" + ($("#systemSelector").css("display") != "none"))
  resetAllAgencies()
  if ($("#login").css("display") != "none") {
    console.log("goEmailVerified: profile is opened")
    $(".authHint").html("Email is confirmed")
    $(".authHint").data("isHint", 1)
    $(".authHint").css("background", "")
    //todo for QR: checkGoUserToken -> upload profile again? civilAction=1
    updateLoginUI()
    setTimeout(function () {
      $("#login").hide();
      menu_item_agencies()
    }, 750)
  } else if ($("#systemSelector").css("display") != "none" && notSelectedYet) {
    console.log("goEmailVerified: systems selector is opened")
    systemsSelector();
  } else if (notSelectedYet) {
    console.log("goEmailVerified: map is opened")
    menu_item_agencies()
  }
}
//////Authorization




function prepareRideRequest(called) {//fillfab
  if ((routesRR.length || stopsRR.length) && localStorage.goRideRequestEnabled == 1) {/*ok*/ }
  else {
    $(".kc_fab_wrapper").hide()
    return
  }


  if (called > 10) console.log("prepareRideRequest(" + called + ")...")
  if (called > 20) { mytoast("Error 102"); return }
  if (typeof requestRide === "undefined" || typeof $('.kc_fab_wrapper').kc_fab !== "function") {
    if (!called) {
      Append_To_Head('script', 'js/rideRequest.js?r=' + Math.random());
      Append_To_Head('script', 'js/kc.fab_djd.js')//?r='+Math.random());
      Append_To_Head('style', 'css/kc.fab.css');
    }
    setTimeout(function () {
      prepareRideRequest((called | 0) + 1);
    }, 450);
    return;
  }
  if (rrTImer) clearInterval(rrTImer); rrTImer = setInterval(rideRequestQuery, 5000)
  //04102021 if (!debug) return
  //https://github.com/devaspros/dap_fab
  let links = [{
    "bgcolor": colorPrimary,
    "icon": "<img src=img/man-and-bus0.svg style='width: 70%;'>"
  }]
  for (let key in stopsRR) {
    var theStop = stops["ID" + stopsRR[key]]
    if (theStop) {
      let color = colorPrimary// theStop.routeColor && theStop.routeColor!="" ? theStop.routeColor : $.xcolor.random()
      //color=$.xcolor.darken(color)
      let title = theStop.name//dont! diff routes! +" @ "+theStop.routeName
      //console.log("prepareRideRequest: stops[ID"+stopsRR[key]+"] color,title="+color+","+title+" from ",theStop)
      links.push({
        "onclick": "requestRideFABClick",
        "uid": key,
        "title": title,
        "bgcolor": color,
        "color": "#fffff",
        "icon": title//theStop.name+".",
      })
    }// else console.error("prepareRideRequest: no stops[key="+key+"][ID"+stopsRR[key]+"] in stops=",stops) //debug
  }
  $('.kc_fab_wrapper').kc_fab(links);
  $(".kc_fab_wrapper").show()
  $(".kc_fab_main_btn").attr("title", "Request a Ride")
  $(".kc_fab_main_btn").tooltip({ position: { my: "left+15 center", at: "right center" } })
}





function showSharedQRCode(called) {
  if (typeof $("#sharedQRCode").qrcode == "function") {
    $("#sharedQRCode").show();
    if (localStorage.goSharedCode && localStorage.goSharedCode != "") {
      $("#sharedQRCode").html("");
      $("#sharedQRCode").attr("title", localStorage.goSharedCode);
      $("#sharedQRCodeLink").html("Your QR is \"" + localStorage.goSharedCode + "\"");
      //dont! below! $("#sharedQRCode").tooltip();
      $("#sharedQRCode").qrcode({
        text: localStorage.goSharedCode,
        width: parseInt($("#sharedQRCode").width() * 0.95),
        height: parseInt($("#sharedQRCode").width() * 0.95),
        colorDark: "#000000",
        colorLight: "#0000FF",
        //correctLevel : QRCode.CorrectLevel.H
      });
    } else
      $("#sharedQRCode").html("No shared code");
  } else {
    console.log("showSharedQRCode wait... typeof qrcode=" + (typeof $("#sharedQRCode").qrcode));
    if (!called)
      Append_To_Head('script', '/js/jquery.qrcode.min.js');
    setTimeout(function () {
      showSharedQRCode(true);
    }, 150);
    return;
  }
}




function showQRMobilePromo(called) {
  $("#mobileAppBadges").css("visibility", $("#mobileAppBadges").children("a").eq(0).attr("href") != "" ? "" : "hidden")
  if (isMobile || typeof $("#mobileAppBadgesQR").qrcode == "function") return
  if (!called) Append_To_Head('script', '/js/jquery.qrcode.min.js');
  setTimeout(function () {
    showQRMobilePromo(true);
  }, 150);
}
function generateQR(el) {
  if (isMobile || typeof $("#mobileAppBadgesQR").qrcode != "function") return
  var url = $(el).attr("href");
  $(el).siblings("div").html("");
  if (typeof $(el).siblings("div").qrcode == "function")
    $(el).siblings("div").qrcode({
      text: url,
      width: parseInt($("#mobileAppBadgesQR").width() * 0.8),
      height: parseInt($("#mobileAppBadgesQR").width() * 0.8),
      colorDark: "#000000",
      colorLight: colorPrimary,
      //correctLevel : QRCode.CorrectLevel.H
    });
}










function getAmountOfSelectedSystems() {
  var amount = 0;
  for (var ki = 0; ki < localStorage.length; ki++) {
    if (localStorage.key(ki).indexOf("system") == 0 && localStorage.getItem(localStorage.key(ki)) == 1) {
      amount++;
    }
  };
  //console.log("getAmountOfSelectedSystems: amount="+amount);
  return amount
}

function correctColorFromARGB(color) {
  //console.log("correctColorFromARGB("+color+")");
  let error = ""//will be fillef by color
  if (color == undefined || color == null || color == "null")
    error = color
  else {
    color = color.trim() //20082024
    if (color.length == 9) {
      var m = color.match(/^#([0-9a-f]{8})$/i)[1];
      if (m) {
        error = color
        color = "#" + m.substr(2, 2) + m.substr(4, 2) + m.substr(6, 2);
      }
    }
  }
  //if (error!="") console.log("correctColorFromARGB bad color!",error);
  return color;
}

function myServer() {
  return "//" + "passiogo.com/"//05092023 +(passiohost?passiohost:"passio3.com")+"/www/";
}
/*05092023 for what? function myServerNode(){
    return "//"+(passiohost?passiohost:"passio3.com")+"/";
}*/


function mytoast(s, center, modal, timeout) {
  if (!center)
    noty({ text: s });
  else {
    var s = "<center><img src='img/ico100.png' style='height:30px;'></center>" + s;
    noty({
      force: true,
      layout: 'center',
      type: 'notification', // alert,success, error, warning, information, notification
      timeout: timeout,
      modal: modal,
      killer: true,
      text: s,
      buttons: [
        {
          addClass: 'btn btn-danger', text: 'Close', onClick: function ($noty) {
            $noty.close();
          }
        }
      ],
      callback: { afterShow: function () { $("#noty_center_layout_container").find("button").focus() } }
    });
  }
}

String.prototype.replaceAll = function (search, replace) {
  return this && this.split ? this.split(search).join(replace) : this;
}


  /*
   * this to prevent Chrome to flame and freeze entire site if console is opened
   * it is endlessly saying on verbose level: [Violation] Added non-passive event listener to a scroll-blocking 'touchmove' event. Consider marking event handler as 'passive' to make the page more responsive.
   */
  (function () {
    if (typeof EventTarget !== "undefined") {
      let func = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, fn, capture) {
        this.func = func;
        if (typeof capture !== "boolean") {
          capture = capture || {};
          capture.passive = false;
        }
        this.func(type, fn, capture);
      };
    };
  }());



function Append_To_Head(elemntType, content) {
  if ((elemntType == "body" || elemntType.indexOf("#") == 0) && $(elemntType).length > 0) {
    //console.log("Append_To_Head("+elemntType+") ",content);
    $.get(content, function (data) {
      $(elemntType).append(data);
    });
  } else {
    var Is_Link = true;//djd. was: content.split(/\r\n|\r|\n/).length <= 1  &&  content.indexOf("/") > -1; // if provided content is "link" or "inline codes"
    if (Is_Link) {
      if (elemntType == 'script') { var x = document.createElement('script'); x.src = content; x.type = 'text/javascript'; }
      else if (elemntType == 'style') { var x = document.createElement('link'); x.href = content; x.type = 'text/css'; x.rel = 'stylesheet'; }
      /* it works
              $.getScript( "/js/jquery.datetimepicker.js?r=2" )
                .done(function( script, textStatus ) {
                  console.log('Successfully loaded script',textStatus);
                })
                .fail(function( jqxhr, settings, exception ) {
                  console.log('Failed to load script',jqxhr,settings,exception);
              });   */

    }
    else {
      var x = document.createElement(elemntType);
      if (elemntType == 'script') { x.type = 'text/javascript'; x.innerHTML = content; }
      else if (elemntType == 'style') { x.type = 'text/css'; if (x.styleSheet) { x.styleSheet.cssText = content; } else { x.appendChild(document.createTextNode(content)); } }
    }
    //console.log("Append_To_Head("+elemntType+") ",x);
    (document.head || document.getElementsByTagName('head')[0]).appendChild(x);
  }
}


function soon() {
  mytoast("This feature will be available soon")
}

//for accessibilty issues
document.addEventListener('DOMContentLoaded', function () {
  var table = document.querySelector('table.jsgrid-table');
  // var keyboardDiv = document.querySelector('LGLeeN-keyboard-shortcuts-view');

  // setTimeout(function() {
  //     const button = document.querySelector('LGLeeN-keyboard-shortcuts-view');
  //     console.log(button, 'Keyboard shortcuts clicked!');

  //     // Add event listener to the found button
  //     if (button) {
  //         button.addEventListener('click', function() {
  //             console.log('Keyboard shortcuts clicked!');
  //         });
  //     }
  // }, 1000); 

  setInterval(() => {
    document.querySelectorAll('div[role="button"]').forEach((element) => {
      element.setAttribute('aria-label', 'Bus');
    });
  }, 2000);

  var skipMapBtn = document.getElementById('btnSkipMap');
  var searchDiv = document.getElementById('seachDiv');
  if (skipMapBtn) {
    skipMapBtn.addEventListener("click", function (event) {
      var inputField = searchDiv.querySelector('input');
      if (inputField) {
        inputField.focus();
      }
    });

    skipMapBtn.addEventListener("keydown", function (event) {
      if (event.key === 'Enter' || event.keyCode === 13) {
        var inputField = searchDiv.querySelector('input');
        if (inputField) {
          inputField.focus();
        }
      }
    });
  }


  if (table) {
    table.setAttribute('role', 'presentation');
  }

  var btnRoute = document.getElementById('btnRoute');
  if (btnRoute) {
    btnRoute.addEventListener("click", function (event) {
      if (this.parentNode.className == "pushy-submenu pushy-submenu-closed") {
        btnRoute.setAttribute("aria-expanded", "true");
      } else {
        btnRoute.setAttribute("aria-expanded", "false");
      }

    })
  }

  let optionAccessibilityModeVal = localStorage.getItem('optionAccessibilityMode');
  if (optionAccessibilityModeVal == '1') {
    $(".back .client-compacted").css("background", "#4A7F52");
  }

});

(function () {
  // Set a timer to change tabindex before DOMContentLoaded
  setTimeout(function () {
    var mapDiv = document.querySelector('div[aria-label="Map"]');
    if (mapDiv) {
      mapDiv.setAttribute('tabindex', '-1');
    }
  }, 1000);
})();




