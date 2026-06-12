// Contact form submission.
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var statusEl = document.getElementById('status');
  var submitBtn = document.getElementById('submitBtn');
  var formFields = form.querySelectorAll('input:not([type="submit"]), textarea');

  function setStatus(text, cls) {
    statusEl.textContent = text || '';
    statusEl.className = 'status ' + (cls || '');
  }

  function setDisabled(state) {
    submitBtn.disabled = state;
    formFields.forEach(function (field) { field.disabled = state; });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Native constraint validation (required, type=email, maxlength).
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var payload = Object.fromEntries(new FormData(form).entries());
    setStatus('Sending…');
    setDisabled(true);

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to send');
        });
      })
      .then(function () {
        setStatus('Thanks — your message was sent. We’ll be in touch within two business days.', 'ok');
        form.reset();
        setDisabled(false);
      })
      .catch(function (err) {
        console.error(err);
        setStatus('Sorry, something went wrong. Please try again, or email info@yuna-labs.com.', 'err');
        setDisabled(false);
      });
  });
})();
