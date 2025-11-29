import { loadArtistByName, loadSongs, $, requireAuth } from "../general.js";
import { renderSongsToDom } from "../player.js";

requireAuth();

// Select elements
const aboutArtist = $(".about-artist");
const aboutBackground = $(".about-background");
const aboutText = $(".about-artist-text");
const profileImg = $(".artist-profile-img");
const coverImg = $(".artist-cover-img");

(async function () {
  const params = new URLSearchParams(window.location.search);
  const artistName = params.get("artist");

  if (!artistName) {
    console.error("❌ No artist name passed in URL.");
    return;
  }

  console.log("🎤 Loading artist:", artistName);

  const artistData = await loadArtistByName(artistName);

  if (!artistData) {
    console.error("❌ Artist not found:", artistName);
    return;
  }

  console.log("🎨 Full Artist Data:", artistData);

  const poster = document.querySelector(".artist-poster");

  // ---------------------------------------
  // 1. COVER PHOTO with fallback
  // ---------------------------------------
  if (artistData.coverPhoto) {
    coverImg.src = artistData.coverPhoto;
    coverImg.style.display = "block";

    coverImg.onerror = () => {
      coverImg.style.display = "none";
      poster.style.background =
        "linear-gradient(to right, rgb(82, 82, 82), rgb(147, 147, 147))";
    };
  } else {
    coverImg.style.display = "none";
    poster.style.background =
      "linear-gradient(to right, rgb(82, 82, 82), rgb(147, 147, 147))";
  }

  // ---------------------------------------
  // 2. PROFILE PHOTO with fallback SVG
  // ---------------------------------------
  const defaultProfile = "../images/default-profile.svg";

  if (artistData.profilePhoto) {
    profileImg.src = artistData.profilePhoto;

    profileImg.onerror = () => {
      profileImg.src = defaultProfile;
    };
  } else {
    profileImg.src = defaultProfile;
  }

  // ---------------------------------------
  // 3. BIO TEXT
  // ---------------------------------------
  aboutText.textContent =
    artistData.bio || "This artist has no biography yet.";

  // ---------------------------------------
  // 4. PAGE TITLE
  // ---------------------------------------
  const headerTitle = document.querySelector("h2");
  if (headerTitle) headerTitle.textContent = artistData.artistName;

  // ---------------------------------------
  // 5. LOAD AND DISPLAY ARTIST SONGS
  // ---------------------------------------
  try {
    const allSongs = await loadSongs();

    const artistSongs = allSongs.filter(
      (song) =>
        song.artist.toLowerCase() === artistData.artistName.toLowerCase()
    );

    console.log("🎵 Artist Songs:", artistSongs);

    renderSongsToDom({
      songs: artistSongs,
      layout: "list",               // <— LIST VIEW
      container: "#artistTrackList" // <— Your HTML section
    });

  } catch (err) {
    console.error("❌ Failed to load artist songs:", err);
  }
})();

// =======================================
// Hover + Modal Logic
// =======================================

profileImg.addEventListener("mouseover", () => {
  aboutArtist.style.display = "block";
});

profileImg.addEventListener("mouseout", () => {
  aboutArtist.style.display = "none";
});

// Open modal
aboutArtist.addEventListener("click", () => {
  aboutBackground.style.display = "flex";
});

// Close on background click ONLY
aboutBackground.addEventListener("click", (e) => {
  if (e.target === aboutBackground) {
    aboutBackground.style.display = "none";
    aboutArtist.style.display = "none";
  }
});