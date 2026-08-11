/* Atlas Crest LLC — site interactions.
   Three pieces of local UI state, per the design handoff: the mobile nav
   drawer, the certificate-tracking tab strip (Home), and the audience
   switcher + need chips (Home contact, Contact page). Nothing persisted. */

(function () {
  "use strict";

  /* mobile nav drawer */
  var burger = document.querySelector(".ac-burger");
  if (burger) {
    burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* tab strips — container: [data-tabs]; buttons: [data-tab="i"];
     panels: [data-tab-panel="i"]. First tab selected by default. */
  document.querySelectorAll("[data-tabs]").forEach(function (root) {
    var tabs = root.querySelectorAll("[data-tab]");
    var panels = root.querySelectorAll("[data-tab-panel]");
    function select(i) {
      tabs.forEach(function (t) {
        var on = t.getAttribute("data-tab") === i;
        t.classList.toggle("is-selected", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      panels.forEach(function (p) {
        p.hidden = p.getAttribute("data-tab-panel") !== i;
      });
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () { select(t.getAttribute("data-tab")); });
    });
    select(tabs.length ? tabs[0].getAttribute("data-tab") : "0");
  });

  /* audience switcher — form: [data-aud-form]; radios: name="audience";
     swap targets carry data-aud-0/1/2 text on [data-aud-swap] (textContent)
     or [data-aud-placeholder] (placeholder attr); chip sets: [data-chip-set="i"].
     Changing audience clears any checked chips. */
  document.querySelectorAll("[data-aud-form]").forEach(function (form) {
    var radios = form.querySelectorAll('input[name="audience"]');
    function apply(val) {
      form.querySelectorAll("[data-aud-swap]").forEach(function (el) {
        el.textContent = el.getAttribute("data-aud-" + val) || el.textContent;
      });
      form.querySelectorAll("[data-aud-placeholder]").forEach(function (el) {
        el.placeholder = el.getAttribute("data-aud-" + val) || el.placeholder;
      });
      form.querySelectorAll("[data-chip-set]").forEach(function (set) {
        var on = set.getAttribute("data-chip-set") === val;
        set.hidden = !on;
        set.querySelectorAll('input[type="checkbox"]').forEach(function (c) {
          if (!on) c.checked = false;
        });
      });
    }
    radios.forEach(function (r) {
      r.addEventListener("change", function () { apply(r.value); });
    });
    var checked = form.querySelector('input[name="audience"]:checked');
    apply(checked ? checked.value : "0");
  });
})();
