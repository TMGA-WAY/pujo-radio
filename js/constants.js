const CLASSIC_PLAYLIST_ID  = "PLGlwblcnENoE";
const GENZ_PLAYLIST_ID     = "PLIBwgxsH13jE";
const NAVRATRI_PLAYLIST_ID = "PLV5erBsOVWwA";
const MAHALAYA_PLAYLIST_ID = "PLRglbAmOZpTo";

const CLASSIC_TOP_COUNT  = 10;
const GENZ_TOP_COUNT     = 0;
const NAVRATRI_TOP_COUNT = 0;
const MAHALAYA_TOP_COUNT = 0;

const GA_MEASUREMENT_ID = "G-LBT9CHRNJQ";

const INSTAGRAM_ID = "afterthecommit";

const BACKGROUND_IMAGES = [
  "assets/durgapujo.webp",
  "assets/durgapujo-back-2.webp"
];

const SITE_URL = "https://durgapujasongs.com";

window.PUJO_CONFIG = {
  playlists: [
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
    },
    {
      key:        "navratri",
      label:      "Navratri Special",
      playlistId: NAVRATRI_PLAYLIST_ID,
      topCount:   NAVRATRI_TOP_COUNT
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
  instagramId:      INSTAGRAM_ID,
  siteUrl:          SITE_URL
};
