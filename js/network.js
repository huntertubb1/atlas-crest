(function () {
  var form = document.getElementById('nw-apply');
  var error = document.getElementById('nw-error');
  if (!form || !window.fetch) return;

  function setButton(button, disabled, label) {
    if (!button) return;
    button.disabled = disabled;
    button.textContent = label;
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
      error.textContent = caught.message || 'We could not reach Atlas. Please try again shortly.';
      error.hidden = false;
      setButton(button, false, 'Apply to the network');
    }).then(function () {
      if (timeout) window.clearTimeout(timeout);
    });
  });
})();
