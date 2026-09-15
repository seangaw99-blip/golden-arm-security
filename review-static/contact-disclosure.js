// Native <details> owns disclosure state and keyboard behavior.
const form = document.querySelector('body.contact-refined .contact-form');
const details = form?.querySelector('#optional-site-details');
if (details) {
  const revealPrefill = () => {
    const params = new URLSearchParams(window.location.search);
    const supplied = (params.get('location') || params.get('market'))?.trim();
    if (supplied && supplied.length <= 80) details.open = true;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', revealPrefill, { once: true });
  else revealPrefill();
  // Keep a future constrained optional control reachable during native validation.
  form.addEventListener('invalid', event => {
    if (details.contains(event.target)) details.open = true;
  }, true);
}
