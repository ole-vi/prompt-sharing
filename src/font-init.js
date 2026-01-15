// Font loading initialization - prevents FOUC by hiding body until fonts are ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.body.style.visibility = 'visible';
    });
  } else {
    document.body.style.visibility = 'visible';
  }
});
