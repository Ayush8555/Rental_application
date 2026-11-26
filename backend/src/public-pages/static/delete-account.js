// Web account deletion: phone -> OTP -> confirm. Uses Firebase phone auth
// in production; in local development the server accepts "dev:" tokens and
// any 6-digit code works.
(function () {
  var root = document.getElementById('del');
  if (!root) return;
  var cfg = JSON.parse(root.getAttribute('data-config') || '{}');
  var $ = function (id) { return document.getElementById(id); };
  var phone = '';
  var confirmation = null;
  var verifier = null;

  function show(step) {
    ['step-phone', 'step-otp', 'step-done'].forEach(function (s) { $(s).classList.toggle('hidden', s !== step); });
  }

  function validPhone(v) { return /^[6-9]\d{9}$/.test(v); }

  if (cfg.mode === 'firebase' && window.firebase) {
    firebase.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId });
    verifier = new firebase.auth.RecaptchaVerifier('recaptcha', { size: 'normal' });
    verifier.render();
  }

  $('send').addEventListener('click', function () {
    var v = $('phone').value.replace(/\D/g, '');
    $('phone-err').textContent = '';
    if (!validPhone(v)) { $('phone-err').textContent = 'Enter a valid 10-digit mobile number'; return; }
    phone = '+91' + v;
    $('send').disabled = true;
    if (cfg.mode !== 'firebase') { show('step-otp'); return; }
    firebase.auth().signInWithPhoneNumber(phone, verifier).then(function (c) {
      confirmation = c;
      show('step-otp');
    }).catch(function () {
      $('phone-err').textContent = 'Could not send the code. Please try again in a few minutes.';
      $('send').disabled = false;
    });
  });

  $('confirm').addEventListener('click', function () {
    var code = $('otp').value.replace(/\D/g, '');
    $('otp-err').textContent = '';
    if (code.length !== 6) { $('otp-err').textContent = 'Enter the 6-digit code'; return; }
    $('confirm').disabled = true;
    var getToken = cfg.mode === 'firebase'
      ? confirmation.confirm(code).then(function (r) { return r.user.getIdToken(); })
      : Promise.resolve('dev:' + phone);
    getToken.then(function (idToken) {
      return fetch('/delete-account/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: idToken, reason: $('reason').value || undefined }),
      });
    }).then(function (res) {
      return res.json().then(function (body) { return { ok: res.ok, body: body }; });
    }).then(function (r) {
      if (!r.ok) throw new Error((r.body && r.body.error && r.body.error.message) || 'failed');
      $('step-done').textContent = r.body.message;
      show('step-done');
      if (cfg.mode === 'firebase') firebase.auth().signOut();
    }).catch(function (e) {
      $('otp-err').textContent = e && e.message && e.message !== 'failed' ? e.message : 'That code did not work. Please try again.';
      $('confirm').disabled = false;
    });
  });
})();
