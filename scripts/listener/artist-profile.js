import { loadArtistByName, loadSongs, $, requireAuth } from "../general.js";
import { initPlayer, renderSongsToDom } from "../player.js";

requireAuth();

export async function initArtistView(artistName) {
  const root = document.getElementById("viewRoot") || document;

  const aboutArtist = root.querySelector(".about-artist");
  const aboutBackground = root.querySelector(".about-background");
  const aboutText = root.querySelector(".about-artist-text");
  const profileImg = root.querySelector(".artist-profile-img");
  const coverImg = root.querySelector(".artist-cover-img");
  const artistPageTitle = root.querySelector("#artistPageTitle");

  if (!artistName) {
    console.error("❌ No artist name provided.");
    return;
  }

  console.log("🎤 Loading artist:", artistName);

  const artistData = await loadArtistByName(artistName);

  if (!artistData) {
    console.error("❌ Artist not found:", artistName);
    return;
  }

  console.log("🎨 Full Artist Data:", artistData);

  const poster = root.querySelector(".artist-poster");

  // Cover photo with fallback
  if (artistData.coverPhoto) {
    coverImg.src = artistData.coverPhoto;
    coverImg.style.display = "block";
    coverImg.onerror = () => {
      coverImg.style.display = "none";
      if (poster) {
        poster.style.background =
          "linear-gradient(to right, rgb(82, 82, 82), rgb(147, 147, 147))";
      }
    };
  } else {
    coverImg.style.display = "none";
    if (poster) {
      poster.style.background =
        "linear-gradient(to right, rgb(82, 82, 82), rgb(147, 147, 147))";
    }
  }

  // Profile photo with fallback
  const defaultProfile = "../images/default-profile.svg";
  if (artistData.profilePhoto) {
    profileImg.src = artistData.profilePhoto;
    profileImg.onerror = () => {
      profileImg.src = defaultProfile;
    };
  } else {
    profileImg.src = defaultProfile;
  }

  // Bio text
  if (aboutText) {
    aboutText.textContent =
      artistData.bio || "This artist has no biography yet.";
  }

  // Page title
  if (artistPageTitle) {
    artistPageTitle.textContent = artistData.artistName;
  }

  // Load and display artist songs
  try {
    const allSongs = await loadSongs();

    const artistSongs = allSongs.filter(
      (song) =>
        song.artist.toLowerCase() === artistData.artistName.toLowerCase()
    );

    renderSongsToDom({
      songs: artistSongs,
      layout: "list",
      container: "#artistTrackList"
    });

    initPlayer(artistSongs);
  } catch (err) {
    console.error("❌ Failed to load artist songs:", err);
  }

  // === MODAL LOGIC ===
  const aboutBtn = root.querySelector(".about-btn");
  const aboutProfileImg = root.querySelector(".about-profile-img");
  const artistPhotoContainer = root.querySelector(".artist-photo");

  // Function to open modal
  const openModal = () => {
    if (aboutBackground) {
      aboutBackground.style.display = "flex";
      // Sync modal profile image
      if (aboutProfileImg && profileImg) {
        aboutProfileImg.src = profileImg.src;
      }
    }
  };

  // 1. Click "About" button
  aboutBtn?.addEventListener("click", openModal);

  // 2. Click Profile Photo
  artistPhotoContainer?.addEventListener("click", openModal);

  // 3. Click Cover Photo
  coverImg?.addEventListener("click", openModal);

  // Close Modal (Click outside)
  if (aboutBackground) {
    aboutBackground.addEventListener("click", (e) => {
      if (e.target === aboutBackground) {
        aboutBackground.style.display = "none";
      }
    });
  }
}