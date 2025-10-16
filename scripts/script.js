const trackList = document.getElementById("trackList");
      const API_BASE =
        "https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com";

      let currentAudio = null; // keep track of which audio is playing

      async function fetchTracks() {
        try {
          // ✅ Call Lambda’s /list route securely
          const res = await fetch(`${API_BASE}/list`);
          const data = await res.json();
          const files = data.files || [];

          if (files.length === 0) {
            trackList.innerHTML = "<p>No tracks available yet.</p>";
            return;
          }

          trackList.innerHTML = "";
          files.forEach((file) => addTrack(file));
        } catch (err) {
          console.error("Error loading tracks:", err);
          trackList.innerHTML = "<p>⚠️ Error loading tracks.</p>";
        }
      }

      function addTrack(fileName) {
        const div = document.createElement("div");
        div.className = "track";
        div.innerHTML = `
          <strong>${fileName}</strong>
          <button>Play</button>
          <audio
            controls
            preload="none"
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            style="display:none"
          ></audio>
        `;

        const button = div.querySelector("button");
        const audio = div.querySelector("audio");

        button.addEventListener("click", async () => {
          if (currentAudio && currentAudio !== audio) {
            currentAudio.pause();
            currentAudio.style.display = "none";
            currentAudio.parentElement.querySelector("button").textContent =
              "Play";
          }

          button.disabled = true;
          button.textContent = "Loading...";

          try {
            const res = await fetch(
              `${API_BASE}/stream?file=${encodeURIComponent(fileName)}`
            );
            const { streamUrl } = await res.json();

            audio.src = streamUrl;
            audio.style.display = "block";
            audio.play();

            currentAudio = audio;
            button.textContent = "Pause";
            button.disabled = false;

            audio.addEventListener("pause", () => {
              button.textContent = "Play";
            });
          } catch (err) {
            console.error("Error streaming:", err);
            button.textContent = "Error";
            button.disabled = false;
          }
        });

        trackList.appendChild(div);
      }

      fetchTracks();