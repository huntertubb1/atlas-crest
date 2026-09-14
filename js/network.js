(function () {
  var form = document.getElementById('nw-apply');
  var error = document.getElementById('nw-error');
  if (!form || !window.fetch) return;

  function setButton(button, disabled, label) {
    if (!button) return;
    button.disabled = disabled;
    button.textContent = label;
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    if (typeof error.scrollIntoView === 'function') {
      error.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function normalizeZip() {
    var zip = form.querySelector('#nw-zip');
    if (!zip) return true;
    var digits = String(zip.value || '').replace(/\D/g, '');
    if (digits.length < 5) {
      showError('Enter a five-digit ZIP code.');
      zip.focus();
      return false;
    }
    zip.value = digits.slice(0, 5);
    return true;
  }

  function hasAvailability() {
    return Boolean(form.querySelector('input[name="availability"]:checked'));
  }

  function submitWithBrowser(form, button) {
    setButton(button, true, 'Trying a compatible submission method...');
    // A normal HTML form post does not depend on cross-origin fetch/CORS. The intake
    // endpoint answers it with a 303 back to applied.html, so privacy extensions and
    // older browsers still have a working path.
    window.HTMLFormElement.prototype.submit.call(form);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var button = form.querySelector('button[type="submit"]');
    error.hidden = true;

    if (!normalizeZip()) {
      setButton(button, false, 'Apply to the network');
      return;
    }

    if (!hasAvailability()) {
      showError('Choose at least one time when you are generally available.');
      var availability = document.getElementById('nw-availability');
      if (availability && typeof availability.scrollIntoView === 'function') {
        availability.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      setButton(button, false, 'Apply to the network');
      return;
    }

    setButton(button, true, 'Sending your application...');

    var controller = window.AbortController ? new AbortController() : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 20000) : null;
    fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
      signal: controller ? controller.signal : undefined,
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.error || 'We could not send that application.');
        window.location.href = body.waitlisted ? '/applied.html?waitlisted=1' : '/applied.html';
      });
    }).catch(function (caught) {
      // Network/CORS/privacy-tool failures happen before Atlas can return an actionable
      // response. Retry through the endpoint's non-JavaScript form flow. Do not retry a
      // real 4xx/5xx response, because its applicant-facing message should remain visible.
      if (caught && (caught.name === 'TypeError' || caught.name === 'AbortError')) {
        submitWithBrowser(form, button);
        return;
      }
      showError(caught.message || 'We could not reach Atlas. Please try again shortly.');
      setButton(button, false, 'Apply to the network');
    }).then(function () {
      if (timeout) window.clearTimeout(timeout);
    });
  });
})();
