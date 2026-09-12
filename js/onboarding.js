(function () {
  // Replace with the Atlas project ref before deploying this page.
  var ENDPOINT = 'https://sapngofczuiejofxyfky.supabase.co/functions/v1/application-portal';
  var AGREEMENT_VERSION = 1;
  var TOKEN_STORAGE_KEY = 'atlas-onboarding-token';
  var SESSION_STORAGE_KEY = 'atlas-onboarding-session';

  var error = document.getElementById('ob-error');
  var status = document.getElementById('ob-status');
  var body = document.getElementById('ob-body');
  var lede = document.getElementById('ob-lede');
  var onlineSigning = null;
  var signingSdk = null;
  var signingEmbed = null;

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
    if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    if (session) window.sessionStorage.setItem(SESSION_STORAGE_KEY, session);
    if (!token && !session) {
      token = window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
      session = token ? '' : window.sessionStorage.getItem(SESSION_STORAGE_KEY) || '';
    }
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

  function reportClientError(step, errorCode, documentKind) {
    return call({
      action: 'client-event',
      step: step,
      errorCode: errorCode,
      documentKind: documentKind || null,
    }).catch(function () { /* Progress reporting must never hide the applicant's real error. */ });
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
    document.querySelectorAll('[data-state="' + key + '"]').forEach(function (element) {
      element.textContent = text;
      element.classList.toggle('done', Boolean(done));
    });
    updateProgress();
  }

  function stateDone(key) {
    var element = document.querySelector('[data-state="' + key + '"]');
    return Boolean(element && element.classList.contains('done'));
  }

  function updateProgress() {
    var required = [
      'subcontractor_agreement', 'field_policy', 'onboarding_packet',
      'w9', 'identity_document', 'insurance_certificate',
    ];
    var completed = required.filter(stateDone).length;
    var count = document.getElementById('ob-progress-count');
    var bar = document.getElementById('ob-progress-bar');
    var next = document.getElementById('ob-next');
    if (!count || !bar || !next) return;
    next.removeAttribute('aria-disabled');
    count.textContent = completed + ' of ' + required.length + ' complete';
    bar.style.width = Math.round((completed / required.length) * 100) + '%';

    var signaturesDone = stateDone('subcontractor_agreement') && stateDone('field_policy');
    var packetDone = stateDone('onboarding_packet');
    var documentsDone = stateDone('w9') && stateDone('identity_document')
      && stateDone('insurance_certificate');
    document.querySelector('[data-progress-step="signatures"]').classList.toggle('done', signaturesDone);
    document.querySelector('[data-progress-step="packet"]').classList.toggle('done', packetDone);
    document.querySelector('[data-progress-step="documents"]').classList.toggle('done', documentsDone);

    if (!signaturesDone) {
      next.href = '#ob-signatures';
      next.textContent = 'Continue with the quick signatures';
    } else if (!packetDone) {
      next.href = onlineSigning && onlineSigning.available ? '#ob-online-signing' : '#ob-packet';
      next.textContent = onlineSigning && ['awaiting_owner', 'completed'].includes(onlineSigning.state)
        ? 'View signing status — waiting for Atlas' : 'Continue with the onboarding packet';
    } else if (!documentsDone) {
      next.href = '#ob-packet';
      next.textContent = 'Continue with supporting documents';
    } else {
      next.removeAttribute('href');
      next.textContent = 'Everything is submitted for Atlas review';
      next.setAttribute('aria-disabled', 'true');
    }
  }

  function render(state) {
    onlineSigning = state.signing || { available: false };
    renderSigning(onlineSigning);
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
      setState(document_.kind, accepted ? 'Accepted by Atlas' : rejected ? 'Needs correction: ' + (document_.reviewNote || 'Contact Atlas') : 'Received — awaiting Atlas review', !rejected);
    });
    (state.agreements || []).forEach(function (agreement) {
      setState(
        agreement.agreementKey,
        agreement.agreementKey === 'field_policy' ? 'Acknowledged' : 'Signed',
        true,
      );
      var signedButton = document.getElementById(agreement.agreementKey === 'field_policy' ? 'ob-policy' : 'ob-sign');
      if (signedButton) { signedButton.disabled = true; signedButton.textContent = agreement.agreementKey === 'field_policy' ? 'Acknowledged' : 'Signed'; }
    });
    updateProgress();
  }

  function renderSigning(signing) {
    var panel = document.getElementById('ob-online-signing');
    if (!panel) return;
    panel.hidden = !signing.available;
    document.getElementById('ob-packet').hidden = Boolean(signing.available);
    if (!signing.available) return;
    var labels = {
      not_started: 'Your final packet is ready to start.',
      creating: 'Your packet is being prepared. Refresh status shortly.',
      ready: 'Your packet is ready. Continue to fill out and sign.',
      starting: 'Your saved packet is opening. Refresh status shortly.',
      signing: 'Your packet is in progress. Continue where you left off.',
      awaiting_owner: 'Your signing is complete. Waiting for Atlas to countersign.',
      completed: onlineSigning.reviewRequired ? 'Your signatures are complete. Atlas needs to review an existing upload before filing this packet. Please contact Atlas.' : 'Both signatures are complete. Saving your documents for Atlas review.',
      filed: 'Your completed documents are saved for Atlas review. You can get your signed copy below.',
      declined: 'This packet was declined. Contact Atlas before starting another packet.',
      expired: 'This packet has expired. Contact Atlas for a replacement.',
      needs_attention: 'Atlas needs to check this packet. Your saved progress has been kept.',
      unavailable: 'Signing is temporarily unavailable. Refresh status or contact Atlas for help.'
    };
    document.getElementById('ob-online-state').textContent = labels[signing.state] || labels.unavailable;
    document.getElementById('ob-tax-confirmation').hidden = signing.state !== 'not_started';
    var open = document.getElementById('ob-open-signing');
    open.hidden = !['not_started', 'ready', 'signing'].includes(signing.state);
    open.textContent = signing.state === 'not_started' ? 'Fill out and sign online' : 'Continue filling and signing';
    document.getElementById('ob-download-signed').hidden = signing.state !== 'filed';
    document.querySelector('[data-progress-step="packet"]').textContent = 'Fill out and sign your packet online';
    document.querySelector('[data-progress-step="documents"]').textContent = 'Documents saved after Atlas countersigns';
  }

  function loadSigningSdk() {
    if (window.SignWellEmbed) return Promise.resolve();
    if (!signingSdk) signingSdk = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://static.signwell.com/assets/embedded.js';
      script.onload = function () { resolve(); };
      script.onerror = function () { script.remove(); signingSdk = null; reject(new Error('The signing window could not load. Please try again.')); };
      document.head.appendChild(script);
    });
    return signingSdk;
  }
  function refreshSigning() {
    return call({ action: 'signing-refresh' }).then(function () { return call({ action: 'load' }); }).then(render);
  }
  var openSigning = document.getElementById('ob-open-signing');
  if (openSigning) {
    openSigning.addEventListener('click', function () {
      clearMessages();
      var first = onlineSigning.state === 'not_started';
      if (first && !document.getElementById('ob-us-tax').checked) {
        show(error, 'Confirm that you can complete the W-9 in this packet, or contact Atlas for the correct tax form.'); return;
      }
      openSigning.disabled = true;
      call({ action: first ? 'signing-start' : 'signing-resume', confirmUsTax: first && document.getElementById('ob-us-tax').checked })
        .then(function (result) {
          onlineSigning = result; renderSigning(result); updateProgress();
          if (!result.signingUrl) return;
          var url = new URL(result.signingUrl);
          if (url.origin !== 'https://www.signwell.com' || url.username || url.password) throw new Error('Atlas could not verify the signing link.');
          return loadSigningSdk().then(function () {
            var host = document.getElementById('ob-signing-window'); host.hidden = false;
            host.replaceChildren();
            signingEmbed = new window.SignWellEmbed({ url: url.href, containerId: 'ob-signing-window', allowRedirect: false,
              events: {
                completed: function () {
                  host.hidden = true;
                  show(status, 'Checking your saved signing status…');
                  // The callback is only a refresh hint. Only the server can verify signatures
                  // and file the completed PDF; never mark document gates from this event.
                  refreshSigning().then(function () { status.hidden = true; }).catch(function (e) { show(error, e.message); });
                },
                closed: function () { host.hidden = true; refreshSigning().catch(function (e) { show(error, e.message); }); },
                error: function () { show(error, 'The signing window stopped. Your saved progress is kept; use Continue to reopen it.'); }
              }
            });
            signingEmbed.open(); host.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }).catch(function (e) { show(error, e.message); })
        .finally(function () { openSigning.disabled = false; });
    });
    document.getElementById('ob-refresh-signing').addEventListener('click', function () {
      clearMessages(); refreshSigning().catch(function (e) { show(error, e.message); });
    });
    document.getElementById('ob-download-signed').addEventListener('click', function () {
      call({ action: 'signing-download' }).then(function (result) {
        var url = new URL(result.downloadUrl);
        if (url.origin !== new URL(ENDPOINT).origin || !url.pathname.startsWith('/storage/v1/object/sign/onboarding-signed-private/')) throw new Error('Could not verify the completed copy.');
        var link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
      }).catch(function (e) { show(error, e.message); });
    });
  }

  function uploadContentType(file) {
    var allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];
    if (allowed.indexOf(file.type) !== -1) return file.type;
    var extension = (file.name.split('.').pop() || '').toLowerCase();
    if (extension === 'pdf') return 'application/pdf';
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'png') return 'image/png';
    if (extension === 'heic' || extension === 'heif') return 'image/heic';
    return '';
  }

  function upload(kind, file) {
    clearMessages();
    setState(kind, 'Uploading', false);
    var buffer;
    var failureStep = 'file_read';
    var contentType = uploadContentType(file);
    if (!contentType) {
      setState(kind, 'Not uploaded', false);
      show(error, 'Upload a PDF or a photo (JPEG, PNG, or HEIC).');
      void reportClientError('upload_prepare', 'upload_prepare_failed', kind);
      return Promise.resolve();
    }
    if (file.size <= 0 || file.size > 26214400) {
      setState(kind, 'Not uploaded', false);
      show(error, file.size > 26214400
        ? 'That file is larger than 25 MB. Upload a smaller scan or photo.'
        : 'That file appears to be empty.');
      void reportClientError('file_read', 'file_read_failed', kind);
      return Promise.resolve();
    }
    return file.arrayBuffer().then(function (read) {
      buffer = read;
      return sha256Hex(buffer);
    }).then(function (digest) {
      failureStep = 'upload_prepare';
      return call({ action: 'upload-url', kind: kind, contentType: contentType })
        .then(function (prepared) {
          // Upload straight to storage with the one-time URL Atlas issued for this path.
          failureStep = 'storage_upload';
          return fetch(ENDPOINT.replace(/\/functions\/v1\/.*$/, '')
            + '/storage/v1/object/upload/sign/onboarding-documents/' + prepared.path
            + '?token=' + encodeURIComponent(prepared.token), {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: buffer,
          }).then(function (response) {
            if (!response.ok) throw new Error('The upload did not finish. Please try again.');
            failureStep = 'upload_confirm';
            return call({
              action: 'confirm-upload',
              kind: kind,
              path: prepared.path,
              contentType: contentType,
              contentSha256: digest,
              byteSize: buffer.byteLength,
            });
          });
        });
    }).then(function () {
      setState(kind, 'Received — awaiting Atlas review', true);
      show(status, 'Saved. Atlas Crest can review it now. This is not approval for work.');
    }).catch(function (caught) {
      setState(kind, 'Not uploaded', false);
      show(error, caught.message);
      var errorCodes = {
        file_read: 'file_read_failed',
        upload_prepare: 'upload_prepare_failed',
        storage_upload: 'storage_upload_failed',
        upload_confirm: 'upload_confirm_failed',
      };
      void reportClientError(failureStep, errorCodes[failureStep], kind);
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
        void reportClientError(key, 'agreement_failed', null);
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
  document.getElementById('ob-sign-name').addEventListener('input', function (event) {
    var policyName = document.getElementById('ob-policy-name');
    if (!policyName.value) policyName.value = event.target.value;
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
    if (/no longer valid|needs the private link/i.test(caught.message)) {
      try {
        window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (ignored) {}
    }
    lede.textContent = 'We could not open your onboarding.';
    show(error, caught.message);
  });
})();
