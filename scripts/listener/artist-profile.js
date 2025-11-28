const aboutArtist = document.querySelector('.about-artist');
const profilePicture = document.querySelector('.artist-photo');
const aboutBackground = document.querySelector('.about-background');

// Hover behavior
profilePicture.addEventListener('mouseover', () => {
  aboutArtist.style.display = 'block';
});
profilePicture.addEventListener('mouseout', () => {
  aboutArtist.style.display = 'none';
});

// Clicking the hover bubble opens modal
aboutArtist.addEventListener('click', () => {
  aboutBackground.style.display = 'flex';
});

// Clicking background closes modal
aboutBackground.addEventListener('click', () => {
  aboutBackground.style.display = 'none';
});