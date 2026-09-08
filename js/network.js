(function () {
  var form = document.getElementById('nw-apply');
  var error = document.getElementById('nw-error');
  if (!form || !window.fetch) return;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var button = form.querySelector('button[type="submit"]');
    error.hidden = true;
    if (button) { button.disabled = true; button.textContent = 'Sending your application...'; }
    fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.error || 'We could not send that application.');
        window.location.href = body.waitlisted ? '/applied.html?waitlisted=1' : '/applied.html';
      });
    }).catch(function (caught) {
      error.textContent = caught.message || 'We could not reach Atlas. Please try again shortly.';
      error.hidden = false;
      if (button) { button.disabled = false; button.textContent = 'Apply to the network'; }
    });
  });
})();
