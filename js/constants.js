const KALIPUJO_PLAYLIST_ID = "PLV5erBsOVWwA";
const CLASSIC_PLAYLIST_ID  = "PLGlwblcnENoE";
const GENZ_PLAYLIST_ID     = "PLIBwgxsH13jE";
const MAHALAYA_PLAYLIST_ID = "PLRglbAmOZpTo";

const KALIPUJO_TOP_COUNT = 0;
const CLASSIC_TOP_COUNT  = 10;
const GENZ_TOP_COUNT     = 0;
const MAHALAYA_TOP_COUNT = 0;

const GA_MEASUREMENT_ID = "G-LBT9CHRNJQ";

const BACKGROUND_IMAGES = [
  "assets/durgapujo.webp",
  "assets/durgapujo-back-2.webp"
];

const SITE_URL = "https://durgapujasongs.com";

const SHOW_PANDAL_GUIDE = false;
const PANDAL_GUIDE_URL  = "https://durgapujapandal.com/";

const SCENE_TAGS = [
  { y: 0.5, text: "Go pandal hopping", icon: "pin", onScreen: true }
];

window.PUJO_CONFIG = {
  playlists: [
    {
      key:        "kalipujo",
      label:      "Kalipujo Song",
      playlistId: KALIPUJO_PLAYLIST_ID,
      topCount:   KALIPUJO_TOP_COUNT
    },
    {
      key:        "classic",
      label:      "Classic",
      playlistId: CLASSIC_PLAYLIST_ID,
      topCount:   CLASSIC_TOP_COUNT
    },
    {
      key:        "genz",
      label:      "Gen-Z Special",
      playlistId: GENZ_PLAYLIST_ID,
      topCount:   GENZ_TOP_COUNT
    }
  ],
  mahalaya: {
    key:        "mahalaya",
    label:      "Mahalaya",
    playlistId: MAHALAYA_PLAYLIST_ID,
    topCount:   MAHALAYA_TOP_COUNT
  },
  backgroundImages: BACKGROUND_IMAGES,
  gaMeasurementId:  GA_MEASUREMENT_ID,
  siteUrl:          SITE_URL,
  pandalGuideUrl:   SHOW_PANDAL_GUIDE ? PANDAL_GUIDE_URL : "",
  sceneTags:        SCENE_TAGS
};
