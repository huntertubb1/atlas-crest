(function () {
  // Replace with the Atlas project ref before deploying this page.
  var ENDPOINT = 'https://sapngofczuiejofxyfky.supabase.co/functions/v1/application-portal';
  var AGREEMENT_VERSION = 1;

  var error = document.getElementById('ob-error');
  var status = document.getElementById('ob-status');
  var body = document.getElementById('ob-body');
  var lede = document.getElementById('ob-lede');

  // Two ways in, and both credentials travel in the fragment so they are never sent to the web
  // server or written into its access logs, and both are removed from the address bar once read.
  //
  //   #token=...         the emailed one-time link, for anyone part-way through onboarding
  //   #access_token=...  a signed-in Atlas account, which is what outlives onboarding
  //
  // The account session is the access token itself rather than the Supabase SDK: the page needs
  // one bearer string, not a 100KB client, and a short-lived token that simply expires is a
  // better fit for a credential sitting in a browser than one that silently refreshes forever.
  var raw = window.location.hash.replace(/^#/, '') || window.location.search.replace(/^\?/, '');
  var token = (/(?:^|&)token=([A-Za-z0-9_-]+)/.exec(raw) || [])[1] || '';
  var session = (/(?:^|&)access_token=([^&]+)/.exec(raw) || [])[1] || '';
  var linkError = (/(?:^|&)error_description=([^&]+)/.exec(raw) || [])[1] || '';
  if (session) session = decodeURIComponent(session);
  if (linkError) linkError = decodeURIComponent(linkError.replace(/\+/g, ' '));

  // Survive a reload within the same tab. sessionStorage, never localStorage: this is a
  // credential, and it should die with the tab rather than sit on the machine.
  try {
    if (session) window.sessionStorage.setItem('atlas-onboarding-session', session);
    else if (!token) session = window.sessionStorage.getItem('atlas-onboarding-session') || '';
  } catch (ignored) { /* private browsing blocks storage; the link still works without it */ }

  if (token || session || linkError) history.replaceState({}, '', window.location.pathname);

  function show(element, text) {
    element.textContent = text;
    element.hidden = false;
  }
  function clearMessages() {
    error.hidden = true;
    status.hidden = true;
  }

  function call(payload) {
    // The function resolves the application from whichever credential is present. A session
    // must not also send a token, or the token path wins and the account is ignored.
    var headers = { 'Content-Type': 'application/json' };
    var sent = payload;
    if (session && !token) headers.Authorization = 'Bearer ' + session;
    else sent = Object.assign({ token: token }, payload);
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(sent),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (json) {
        if (!response.ok) throw new Error(json.error || 'That did not work. Please try again.');
        return json;
      });
    });
  }

  function sha256Hex(buffer) {
    return crypto.subtle.digest('SHA-256', buffer).then(function (digest) {
      return Array.prototype.map.call(new Uint8Array(digest), function (byte) {
        return ('0' + byte.toString(16)).slice(-2);
      }).join('');
    });
  }

  function setState(key, text, done) {
    var element = document.querySelector('[data-state="' + key + '"]');
    if (!element) return;
    element.textContent = text;
    element.classList.toggle('done', Boolean(done));
  }

  function render(state) {
    // An emailed link expires; an Atlas account does not, so expiresAt is null on the account
    // path and must not be rendered as a date (new Date(null) is 12/31/1969).
    lede.textContent = 'Welcome, ' + state.legalName
      + '. Upload your documents and sign below. '
      + (state.expiresAt
        ? 'Your link is good until ' + new Date(state.expiresAt).toLocaleDateString() + '.'
        : 'You are signed in to your Atlas account.');
    body.hidden = false;
    (state.documents || []).forEach(function (document_) {
      var accepted = document_.reviewStatus === 'accepted';
      var rejected = document_.reviewStatus === 'rejected';
      setState(document_.kind, accepted ? 'Accepted by Atlas' : rejected ? 'Needs correction: ' + (document_.reviewNote || 'Contact Atlas') : 'Received — awaiting Atlas review', accepted);
    });
    (state.agreements || []).forEach(function (agreement) {
      setState(
        agreement.agreementKey,
        agreement.agreementKey === 'field_policy' ? 'Acknowledged' : 'Signed',
        true,
      );
    });
  }

  function upload(kind, file) {
    clearMessages();
    setState(kind, 'Uploading', false);
    var buffer;
    return file.arrayBuffer().then(function (read) {
      buffer = read;
      return sha256Hex(buffer);
    }).then(function (digest) {
      return call({ action: 'upload-url', kind: kind, contentType: file.type })
        .then(function (prepared) {
          // Upload straight to storage with the one-time URL Atlas issued for this path.
          return fetch(ENDPOINT.replace(/\/functions\/v1\/.*$/, '')
            + '/storage/v1/object/upload/sign/onboarding-documents/' + prepared.path
            + '?token=' + encodeURIComponent(prepared.token), {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: buffer,
          }).then(function (response) {
            if (!response.ok) throw new Error('The upload did not finish. Please try again.');
            return call({
              action: 'confirm-upload',
              kind: kind,
              path: prepared.path,
              contentType: file.type,
              contentSha256: digest,
              byteSize: buffer.byteLength,
            });
          });
        });
    }).then(function () {
      setState(kind, 'Received — awaiting Atlas review', false);
      show(status, 'Saved. Atlas Crest can review it now. This is not approval for work.');
    }).catch(function (caught) {
      setState(kind, 'Not uploaded', false);
      show(error, caught.message);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-upload]'), function (input) {
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (file) void upload(input.getAttribute('data-upload'), file);
      input.value = '';
    });
  });

  function sign(key, textId, nameInput, button, doneText) {
    clearMessages();
    var typedFullName = nameInput.value.trim();
    if (typedFullName.length < 2) {
      show(error, 'Type your full legal name first.');
      return;
    }
    button.disabled = true;
    // The signature is bound to the digest of the text actually shown on this page, and Atlas
    // refuses any digest that is not the published version's, so what was signed is reproducible.
    var text = document.getElementById(textId).innerText.replace(/\s+/g, ' ').trim();
    sha256Hex(new TextEncoder().encode(key + '|' + AGREEMENT_VERSION + '|' + text))
      .then(function (digest) {
        return call({
          action: 'sign-agreement',
          agreementKey: key,
          agreementVersion: AGREEMENT_VERSION,
          agreementSha256: digest,
          typedFullName: typedFullName,
        });
      }).then(function () {
        setState(key, doneText, true);
        show(status, 'Recorded. Thank you.');
      }).catch(function (caught) {
        show(error, caught.message);
      }).finally(function () {
        button.disabled = false;
      });
  }

  var signButton = document.getElementById('ob-sign');
  var policyButton = document.getElementById('ob-policy');
  signButton.addEventListener('click', function () {
    sign('subcontractor_agreement', 'ob-agreement-text', document.getElementById('ob-sign-name'), signButton, 'Signed');
  });
  policyButton.addEventListener('click', function () {
    sign('field_policy', 'ob-policy-text', document.getElementById('ob-policy-name'), policyButton, 'Acknowledged');
  });

  if (linkError) {
    lede.textContent = 'That sign-in link did not work.';
    show(error, linkError + ' Sign-in links are single use and expire. Ask us for a new one.');
    return;
  }

  if (!token && !session) {
    lede.textContent = 'This page needs the private link Atlas Crest emailed you.';
    show(error, 'Open the link from your email. If it has expired, ask us for a new one.');
    return;
  }

  call({ action: 'load' }).then(render).catch(function (caught) {
    // An expired session is the common case and should not read as a failure. Clear it so a
    // reload does not retry the same dead credential.
    if (session && !token) {
      try { window.sessionStorage.removeItem('atlas-onboarding-session'); } catch (ignored) {}
    }
    lede.textContent = 'We could not open your onboarding.';
    show(error, caught.message);
  });
})();
