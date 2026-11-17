(function () {
  var LABEL = 'Send my application';
  var MAX_RESUME = 10 * 1024 * 1024;
  var RESUME_OK = /\.(pdf|docx|jpe?g|png)$/i;

  if (!window.fetch) return;

  function setButton(button, disabled, label) {
    if (!button) return;
    button.disabled = disabled;
    button.textContent = label;
  }

  function resumeProblem(form) {
    var input = form.querySelector('input[type="file"][name="resume"]');
    var file = input && input.files && input.files[0];
    if (!file) return '';
    if (file.size > MAX_RESUME) return 'That resume is larger than 10 MB. Save it as a smaller PDF.';
    if (/\.doc$/i.test(file.name)) return 'Older Word .doc files are not accepted. Save the resume as a PDF or .docx.';
    if (!RESUME_OK.test(file.name)) return 'Upload the resume as a PDF, a .docx, or a JPEG or PNG photo.';
    return '';
  }

  function wire(form, errorEl, opts) {
    if (!form || !errorEl) return;

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      if (typeof errorEl.scrollIntoView === 'function') errorEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function reset(button) { setButton(button, false, LABEL); }

    // The live intake function may be older than this page. A plain form post does not depend on
    // cross-origin fetch, and the intake answers it with a redirect to applied.html.
    function submitNative(button) {
      setButton(button, true, 'Trying a compatible submission method...');
      window.HTMLFormElement.prototype.submit.call(form);
    }

    // Office form only: if the intake cannot take it, send it to the office mailbox instead.
    function submitFallback(button) {
      var fallback = form.getAttribute('data-fallback');
      if (!fallback) return submitNative(button);
      setButton(button, true, 'Sending your application...');
      form.action = fallback;
      [['_subject', 'Office assistant application — atlascrestllc.com'],
       ['_next', 'https://atlascrestllc.com/applied.html'],
       ['_captcha', 'false']].forEach(function (pair) {
        var hidden = document.createElement('input');
        hidden.type = 'hidden'; hidden.name = pair[0]; hidden.value = pair[1];
        form.appendChild(hidden);
      });
      var file = form.querySelector('input[type="file"][name="resume"]');
      if (file) file.name = 'attachment';
      window.HTMLFormElement.prototype.submit.call(form);
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var button = form.querySelector('button[type="submit"]');
      errorEl.hidden = true;

      var problem = resumeProblem(form);
      if (problem) { showError(problem); return; }
      if (opts.validate && !opts.validate(showError)) { reset(button); return; }

      setButton(button, true, 'Sending your application...');
      var data = new FormData(form);
      if (opts.prepare) opts.prepare(data);

      var controller = window.AbortController ? new AbortController() : null;
      var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 30000) : null;
      fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
        signal: controller ? controller.signal : undefined,
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) {
            var err = new Error(body.error || 'We could not send that application.');
            err.status = response.status;
            throw err;
          }
          window.location.href = body.waitlisted ? '/applied.html?waitlisted=1' : '/applied.html';
        });
      }).catch(function (caught) {
        var network = caught && (caught.name === 'TypeError' || caught.name === 'AbortError');
        var resumeError = caught && /resume|\.docx|\bPDF\b|10 MB|macro/i.test(caught.message || '');
        if (opts.office) {
          // A resume problem is the applicant's to fix. Anything else (an older intake that does
          // not know the office role, a network block) goes to the office mailbox instead.
          if (resumeError) { showError(caught.message); reset(button); return; }
          if (!(caught && caught.status === 429)) { submitFallback(button); return; }
        } else if (network) {
          submitNative(button);
          return;
        }
        showError((caught && caught.message) || 'We could not reach Atlas. Please try again shortly.');
        reset(button);
      }).then(function () {
        if (timeout) window.clearTimeout(timeout);
      });
    });
  }

  // Field inspector, surveyor, and auditor form.
  var field = document.getElementById('nw-apply');
  wire(field, document.getElementById('nw-error'), {
    validate: function (showError) {
      var zip = field.querySelector('#nw-zip');
      if (zip) {
        var digits = String(zip.value || '').replace(/\D/g, '');
        if (digits.length < 5) { showError('Enter a five-digit ZIP code.'); zip.focus(); return false; }
        zip.value = digits.slice(0, 5);
      }
      if (!field.querySelector('input[name="availability"]:checked')) {
        showError('Choose at least one time when you are generally available.');
        var box = document.getElementById('nw-availability');
        if (box && box.scrollIntoView) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return false;
      }
      return true;
    },
  });

  // Remote office assistant form.
  var office = document.getElementById('office-apply');
  wire(office, document.getElementById('of-error'), {
    office: true,
    prepare: function (data) {
      // The intake has no fields for these two answers yet, so they travel in the experience note.
      var extra = [];
      if (data.get('hours_per_week')) extra.push('Hours per week: ' + data.get('hours_per_week'));
      if (data.get('start_date')) extra.push('Earliest start: ' + data.get('start_date'));
      if (extra.length) data.set('experience', (String(data.get('experience') || '') + '\n\n' + extra.join('. ')).trim().slice(0, 1500));
    },
  });
})();
