/* Atlas Crest LLC — inspector badge check for /verify.
   Badge QR codes point at https://atlascrestllc.com/verify?id=AC-1001. This reads the id,
   looks it up in /assets/inspectors/badges.json and un-hides one [data-state] card in
   verify.html. Nothing is stored and nothing is sent anywhere else.
   Add, change or deactivate an inspector in badges.json (see README). */

(function () {
  "use strict";

  var ROSTER_URL = "/assets/inspectors/badges.json";
  var PHOTO_DIR = "/assets/inspectors/";

  var root = document.querySelector("[data-verify]");
  if (!root) return;

  /* "ac 1001", "AC1001", "1001" and "AC-1001" are all badge AC-1001. */
  function normalize(raw) {
    var s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.indexOf("AC") === 0) s = s.slice(2);
    return s ? "AC-" + s : "";
  }

  function card(state) {
    return root.querySelector('[data-state="' + state + '"]');
  }

  function fill(el, slot, text) {
    el.querySelectorAll('[data-slot="' + slot + '"]').forEach(function (node) {
      node.textContent = text;
    });
  }

  function show(state, title) {
    root.querySelectorAll("[data-state]").forEach(function (el) {
      el.hidden = el.getAttribute("data-state") !== state;
    });
    document.title = title + " — Atlas Crest LLC";
  }

  function note(text) {
    var el = root.querySelector('[data-slot="note"]');
    el.textContent = text;
    el.hidden = !text;
  }

  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var first = parts[0] ? parts[0].charAt(0) : "";
    var last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }

  /* The live clock shows the check just happened on this phone, not in a screenshot. */
  function startClock(el) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat(undefined, {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", second: "2-digit"
      });
    } catch (e) {
      fmt = null;
    }
    function tick() {
      var now = new Date();
      el.textContent = fmt ? fmt.format(now) : now.toLocaleString();
    }
    tick();
    window.setInterval(tick, 1000);
  }

  function showActive(person, id) {
    var el = card("active");
    var name = String(person.name || "").trim();
    fill(el, "name", name);
    fill(el, "role", String(person.role || "Field Inspector"));
    fill(el, "badge", id);

    var photoBox = el.querySelector('[data-slot="photo"]');
    var mono = document.createElement("span");
    mono.textContent = initials(name);
    photoBox.appendChild(mono);

    var photo = String(person.photo || "");
    if (/^[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/i.test(photo)) {
      var img = document.createElement("img");
      img.alt = "Photo of " + name;
      img.addEventListener("load", function () {
        while (photoBox.firstChild) photoBox.removeChild(photoBox.firstChild);
        photoBox.appendChild(img);
        note("Make sure the photo and name match the person in front of you. You can also ask to see a photo ID.");
      });
      img.src = PHOTO_DIR + photo;
    }

    startClock(el.querySelector('[data-slot="clock"]'));
    note("Make sure this name matches the name on the badge. You can ask to see a photo ID.");
    show("active", name + " · Active inspector");
  }

  var params = new URLSearchParams(window.location.search);
  var raw = (params.get("id") || "").slice(0, 24);
  var id = normalize(raw);

  if (!id) {
    show("lookup", "Verify an Inspector");
    return;
  }

  fetch(ROSTER_URL + "?t=" + Date.now(), { cache: "no-store", credentials: "omit" })
    .then(function (res) {
      if (!res.ok) throw new Error("roster " + res.status);
      return res.json();
    })
    .then(function (data) {
      var badges = (data && data.badges) || [];
      var person = null;
      for (var i = 0; i < badges.length; i++) {
        if (normalize(badges[i].badge) === id) { person = badges[i]; break; }
      }
      if (!person) {
        var miss = card("notfound");
        fill(miss, "badge", id);
        miss.querySelector('[data-slot="input"]').value = raw;
        show("notfound", "Badge not found");
      } else if (person.status !== "active") {
        fill(card("inactive"), "badge", id);
        show("inactive", "Badge not active");
      } else {
        showActive(person, id);
      }
    })
    .catch(function () {
      card("error").querySelector('[data-slot="retry"]').href = window.location.href;
      show("error", "Can't check right now");
    });
})();
