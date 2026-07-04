/* ============================================================================
   BurstBox bar — shared across all consumer pages.
   Injects the bottom-docked "Powered by Burst Marketing" panel, defines its
   behavior, and wires every gold CTA (.btn-gold / .nav-cta) + the home popup
   CTA (.welcome-cta) to open it. CSS lives in styles.css (.bbx-*).
   Functions are global on purpose so the injected inline onclick handlers and
   home.html's closeWelcome() can call them.
   ========================================================================== */

var BBX_HTML =
'<div id="bbx-overlay" class="bbx-overlay" style="display:none;" aria-hidden="true" onclick="if(event.target===this)closeBurstbox()">' +
'  <button class="bbx-close" onclick="closeBurstbox()" aria-label="Close">' +
'    <svg viewBox="0 0 24 24" fill="none"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>' +
'  </button>' +
'  <div class="bbx-bar" role="dialog" aria-label="Your Enerband price">' +
'    <div class="bbx-top">' +
'      <p class="bbx-tagline" id="bbxTagline">Enerband personalized face &amp; neck trainer to correct signs of facial &amp; neck aging.</p>' +
'      <span class="bbx-notif-msg" id="bbxNotifMsg"></span>' +
'      <button class="bbx-logout" id="bbxLogout" onclick="bbxSignOut()">Logout</button>' +
'    </div>' +
'    <div class="bbx-main">' +
'      <div class="bbx-inner">' +
'        <div class="bbx-col bbx-col-price">' +
'          <p class="bbx-h">Your price right now:</p>' +
'          <div class="bbx-price-row">' +
'            <span class="bbx-price-old" id="bbxOld">$79</span>' +
'            <span class="bbx-price-arrow">→</span>' +
'            <span class="bbx-price-new" id="bbxNew">$69</span>' +
'          </div>' +
'          <a href="order.html" class="bbx-order-btn" id="bbxOrderBtn">Order Now for $69</a>' +
'          <p class="bbx-h">Want an Even Lower Price? 💸</p>' +
'          <div class="bbx-muted-stack">' +
'            <p>Send your personal link to friends. As they accept your recommendation, your price can drop to as low as $19.</p>' +
'            <p>The best part? Your friends won’t need to make a purchase or provide any credit card details.</p>' +
'            <p>Send the link, help us spread the benefits of Enerband, and unlock your best price 🎁</p>' +
'          </div>' +
'        </div>' +
'        <div class="bbx-col bbx-col-ladder">' +
'          <p class="bbx-h">How to get the lowest price?</p>' +
'          <p class="bbx-muted">5 friends click = Enerband for $19. No credit card, no sign-up, no purchase.</p>' +
'          <div class="bbx-steps">' +
'            <div class="bbx-step" data-step="1"><span class="bbx-step-ico">👤</span><span class="bbx-step-n"><small>✶</small>1</span><span class="bbx-eq">=</span><span class="bbx-off">$10<small>off</small></span><span class="bbx-stepprice">$59<small>price</small></span></div>' +
'            <div class="bbx-step" data-step="2"><span class="bbx-step-ico">👤</span><span class="bbx-step-n"><small>✶</small>2</span><span class="bbx-eq">=</span><span class="bbx-off">$20<small>off</small></span><span class="bbx-stepprice">$49<small>price</small></span></div>' +
'            <div class="bbx-step" data-step="3"><span class="bbx-step-ico">👤</span><span class="bbx-step-n"><small>✶</small>3</span><span class="bbx-eq">=</span><span class="bbx-off">$30<small>off</small></span><span class="bbx-stepprice">$39<small>price</small></span></div>' +
'            <div class="bbx-step" data-step="4"><span class="bbx-step-ico">👤</span><span class="bbx-step-n"><small>✶</small>4</span><span class="bbx-eq">=</span><span class="bbx-off">$40<small>off</small></span><span class="bbx-stepprice">$29<small>price</small></span></div>' +
'            <div class="bbx-step" data-step="5"><span class="bbx-step-ico">👤</span><span class="bbx-step-n"><small>✶</small>5</span><span class="bbx-eq">=</span><span class="bbx-off">$50<small>off</small></span><span class="bbx-stepprice">$19<small>price</small></span></div>' +
'          </div>' +
'          <p class="bbx-h-sm">One click = instant $10 off</p>' +
'          <div class="bbx-sim-row">' +
'            <button class="bbx-sim" onclick="bbxSimClick()">⚡ Demo: simulate a friend click</button>' +
'            <button class="bbx-sim" onclick="bbxReset()">↺ reset</button>' +
'          </div>' +
'        </div>' +
'        <div class="bbx-col bbx-col-timer">' +
'          <div class="bbx-login" id="bbxLogin">' +
'            <p class="bbx-h">Sign up to generate for free</p>' +
'            <p class="bbx-muted">Continue with one of the following to get started:</p>' +
'            <div class="bbx-social">' +
'              <button class="bbx-social-btn" onclick="bbxSignUp()"><span class="bbx-social-ico"><svg viewBox="0 0 24 24" fill="#000"><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.89-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.83 1.31 10.39.87 1.25 1.9 2.66 3.26 2.61 1.31-.05 1.8-.85 3.39-.85 1.58 0 2.03.85 3.41.82 1.41-.02 2.3-1.28 3.16-2.54.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.73-1.05-2.76-4.16zM14.6 4.7c.72-.87 1.21-2.08 1.08-3.29-1.04.04-2.3.69-3.04 1.56-.66.77-1.24 2-1.08 3.18 1.16.09 2.34-.59 3.04-1.45z"/></svg></span> Continue with Apple</button>' +
'              <button class="bbx-social-btn" onclick="bbxSignUp()"><span class="bbx-social-ico"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.7-.06-1.4-.18-2H12v3.8h5.9a5.05 5.05 0 0 1-2.18 3.3v2.74h3.52c2.06-1.9 3.26-4.7 3.26-7.84z"/><path fill="#34A853" d="M12 23c2.94 0 5.42-.97 7.22-2.64l-3.52-2.74c-.98.66-2.23 1.05-3.7 1.05-2.84 0-5.25-1.92-6.11-4.5H2.25v2.83A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.89 14.17a6.6 6.6 0 0 1 0-4.34V7H2.25a11 11 0 0 0 0 9.99l3.64-2.82z"/><path fill="#EA4335" d="M12 5.5c1.6 0 3.04.55 4.17 1.63l3.12-3.12A11 11 0 0 0 2.25 7l3.64 2.83C6.75 7.42 9.16 5.5 12 5.5z"/></svg></span> Continue with Google</button>' +
'              <button class="bbx-social-btn" onclick="bbxSignUp()"><span class="bbx-social-ico"><svg viewBox="0 0 24 24" fill="#000"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-7-6.2 7H1.4l8.1-9.3L1 2h7l4.9 6.5L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z"/></svg></span> Continue with X</button>' +
'              <button class="bbx-social-btn" onclick="bbxSignUp()"><span class="bbx-social-ico"><svg viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 11 10.1 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-1.9.9-1.9 1.8V12h3.3l-.5 3.5h-2.8v8.4C19.6 23 24 18 24 12z"/></svg></span> Continue with Facebook</button>' +
'              <button class="bbx-social-btn" onclick="bbxSignUp()"><span class="bbx-social-ico"><svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></span> Continue with Email</button>' +
'            </div>' +
'          </div>' +
'          <div class="bbx-card" id="bbxActiveCard">' +
'            <p class="bbx-h">Want the fastest price drop?</p>' +
'            <p class="bbx-muted">Each send is counted once the recipient clicks your link — $10 off per click.</p>' +
'            <button class="bbx-wa" onclick="bbxStart()"><svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.8.7.8-2.7-.2-.3A8 8 0 1 1 12 20zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.7.9-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-.8-1-1.1-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.4-.4.1-.1.2-.2.2-.4 0-.1 0-.3-.1-.4 0-.1-.5-1.3-.7-1.7-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.2 1.6 2.4 3.8 3.4.5.2.9.4 1.2.5.5.2 1 .1 1.3.1.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.1-.4-.2z"/></svg> Open WhatsApp &amp; Send</button>' +
'            <div class="bbx-linkbox">' +
'              <span class="bbx-link">http://www.enerband.com/f-demo…</span>' +
'              <button class="bbx-copy" onclick="bbxCopy()"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg> Copy</button>' +
'            </div>' +
'            <p class="bbx-h">Get a second Enerband free</p>' +
'            <p class="bbx-muted">5 clicks in 3 hours. No tricks, no strings.</p>' +
'            <div class="bbx-clock" id="bbxClock">3:00:00</div>' +
'            <div class="bbx-progress"><div class="bbx-progress-fill" id="bbxProgress"></div></div>' +
'            <p class="bbx-timer-note" id="bbxTimerNote">Your 3-hour countdown starts the moment you sign up.</p>' +
'          </div>' +
'        </div>' +
'      </div>' +
'    </div>' +
'    <div class="bbx-footer">' +
'      <p class="bbx-rights">All rights reserved to <a href="#" class="bbx-bm" title="Burst Marketing — the platform powering Enerband">BURST MARKETING</a> FAR EAST LTD 2025 ©</p>' +
'      <div class="bbx-foot-right" id="bbxFootRight">' +
'        <span>Watch your price drop in real time with every click</span>' +
'        <span class="bbx-dots"><i></i><i></i><i></i><i></i></span>' +
'      </div>' +
'    </div>' +
'  </div>' +
'</div>' +
'<button id="bbx-reopen" class="bbx-reopen" dir="ltr" style="display:none;" onclick="showBurstbox()">Your Price — <span id="bbxReopenPrice">$69</span> ▴</button>' +
'<div id="pb-bar" role="status" aria-live="polite" style="display:none;" onclick="showBurstbox()" title="Click to open your Burst">' +
'  <div class="pb-inner">' +
'    <span class="pb-tagline">Enerband personalized face &amp; neck trainer to correct signs of facial &amp; neck aging.</span>' +
'    <span class="pb-chevron">&#8963;</span>' +
'    <span class="pb-timer-mini" id="pbTimerMini">Just 5 clicks in 3 hours</span>' +
'  </div>' +
'</div>';

/* ---- state: bar always shows the LAST price effect (prev -> current), persisted ---- */
var BBX_PRICES = [69, 59, 49, 39, 29, 19];   /* index = friend clicks done (0..5) */
function bbxGetClicks() {
  var n = parseInt(localStorage.getItem('enerband_bbx_clicks') || '0', 10);
  return isNaN(n) ? 0 : Math.max(0, Math.min(5, n));
}
function bbxSetClicks(n) {
  localStorage.setItem('enerband_bbx_clicks', String(Math.max(0, Math.min(5, n))));
}
function bbxLastEffect(c) {
  return c <= 0 ? { old: 79, now: 69 } : { old: BBX_PRICES[c - 1], now: BBX_PRICES[c] };
}
function renderBbx() {
  var c = bbxGetClicks(), e = bbxLastEffect(c);
  var o = document.getElementById('bbxOld'), n = document.getElementById('bbxNew'), b = document.getElementById('bbxOrderBtn');
  if (o) o.textContent = '$' + e.old;
  if (n) n.textContent = '$' + e.now;
  if (b) b.textContent = 'Order Now for $' + e.now;
  var rp = document.getElementById('bbxReopenPrice');
  if (rp) rp.textContent = '$' + e.now;
  var nc = document.getElementById('navCtaPrice');
  if (nc) nc.textContent = '$' + e.now;
  var steps = document.querySelectorAll('.bbx-step');
  Array.prototype.forEach.call(steps, function(s) {
    var step = parseInt(s.getAttribute('data-step'), 10);
    s.classList.toggle('done', step <= c);
  });
}
function bbxSimClick() {
  bbxSetClicks(bbxGetClicks() + 1);
  renderBbx();
  var n = document.getElementById('bbxNew');
  if (n) { n.classList.remove('bbx-pulse'); void n.offsetWidth; n.classList.add('bbx-pulse'); }
  bbxStart();
  pbRefreshFeed(); /* show the new "price dropped" message immediately */
}
function bbxReset() {
  bbxSetClicks(0);
  localStorage.removeItem('enerband_bbx_signed');
  renderBbx();
  var bar = document.querySelector('#bbx-overlay .bbx-bar');
  if (bar) bar.classList.remove('bbx-mode-active');
  pbHide();
  if (pbFeedTimer) { clearInterval(pbFeedTimer); pbFeedTimer = null; }
}

/* anon (default) <-> active (after sign-up) */
function bbxIsSignedUp() { return localStorage.getItem('enerband_bbx_signed') === '1'; }
function bbxSignUp() {
  localStorage.setItem('enerband_bbx_signed', '1');
  var bar = document.querySelector('#bbx-overlay .bbx-bar');
  if (bar) bar.classList.add('bbx-mode-active');
  bbxStart();
  pbStartFeed(); /* feed primed; pbShow(animate=true) called from closeBurstbox */
}
function bbxSignOut() {
  localStorage.removeItem('enerband_bbx_signed');
  var bar = document.querySelector('#bbx-overlay .bbx-bar');
  if (bar) bar.classList.remove('bbx-mode-active');
  pbHide();
}

function showBurstbox() {
  var el = document.getElementById('bbx-overlay');
  if (!el) return;
  renderBbx();
  el.classList.remove('hiding');
  el.style.display = 'flex';
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  var bar = el.querySelector('.bbx-bar');
  if (bar) {
    if (bbxIsSignedUp()) bar.classList.add('bbx-mode-active');
    bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
  }
  var tab = document.getElementById('bbx-reopen');
  if (tab) tab.style.display = 'none';
  pbHide();
}
function closeBurstbox() {
  var el = document.getElementById('bbx-overlay');
  if (!el) return;
  el.classList.add('hiding');
  document.body.style.overflow = '';
  setTimeout(function() {
    el.style.display = 'none';
    el.classList.remove('hiding');
    el.setAttribute('aria-hidden', 'true');
    if (bbxIsSignedUp()) {
      pbShow();
    } else {
      var tab = document.getElementById('bbx-reopen');
      if (tab) tab.style.display = 'block';
    }
  }, 250);
}

var bbxTimer = null;
var BBX_TOTAL = 3 * 60 * 60;   /* real 3-hour window, in seconds */
function bbxFmt(s) {
  var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
}
function bbxStart() {
  if (bbxTimer) return;                       /* already counting */
  var fill = document.getElementById('bbxProgress');
  var clock = document.getElementById('bbxClock');
  var note = document.getElementById('bbxTimerNote');
  var left = BBX_TOTAL;
  if (fill) fill.style.width = '100%';
  if (clock) clock.textContent = bbxFmt(left);
  if (note) note.textContent = 'Time left to complete your 5 clicks.';
  bbxTimer = setInterval(function() {
    left--;
    if (clock) clock.textContent = bbxFmt(Math.max(0, left));
    if (fill) fill.style.width = Math.max(0, (left / BBX_TOTAL * 100)) + '%';
    /* sync mini timer in the closed dark bar */
    var mini = document.getElementById('pbTimerMini');
    if (mini && left > 0) {
      var h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
      mini.innerHTML = 'Just 5 clicks in 3 hours: <b>' + h + ':' + (m < 10 ? '0' : '') + m + '</b>';
    }
    if (left <= 0) {
      clearInterval(bbxTimer); bbxTimer = null;
      if (note) note.textContent = 'Time’s up — but you can still order anytime.';
      if (mini) mini.textContent = 'Time’s up — order anytime';
    }
  }, 1000);
}
function bbxCopy() {
  try { if (navigator.clipboard) navigator.clipboard.writeText('http://www.enerband.com/f-demo'); } catch (e) {}
  bbxStart();
}

/* ---- Pink LIVE bar (bottom-docked, shows after sign-up) ---- */
var pbRevertTimer = null;

var PB_FEED = [
  '',
  'The price dropped to $59 because one of your friends clicked on your link',
  'The price dropped to $49 because a second friend clicked on your link',
  'The price dropped to $39 because a third friend clicked on your link · just two more to reach the maximum discount',
  'The price dropped to $29 because a fourth friend clicked on your link · just one more to reach the maximum discount',
  'You won a second Enerband 100% free · five recommendations sent in 3 hours'
];
var PB_AMBIENT = [
  'Someone is viewing Enerband right now via your link',
  'Your Burst is live · send your link to start dropping the price'
];
var pbFeedTimer = null;

function pbMessages() {
  var c = bbxGetClicks();
  var msgs = [];
  if (c > 0 && c <= 5) msgs.push(PB_FEED[c]);
  msgs.push(PB_AMBIENT[0]);
  if (c === 0) msgs.push(PB_AMBIENT[1]);
  return msgs;
}
function pbSetMsg(msg) {
  /* update the notification text (used even when bar is closed, ready for next open) */
  var notifEl = document.getElementById('bbxNotifMsg');
  if (notifEl) notifEl.textContent = msg;

  /* only flash the top strip pink when the BurstBox overlay is currently open */
  var overlay = document.getElementById('bbx-overlay');
  if (!overlay || overlay.style.display !== 'flex') return;

  var top = overlay.querySelector('.bbx-top');
  var tagline = document.getElementById('bbxTagline');
  if (!top) return;

  top.classList.add('bbx-top--live');
  if (tagline) tagline.style.display = 'none';

  clearTimeout(pbRevertTimer);
  pbRevertTimer = setTimeout(function() {
    top.classList.remove('bbx-top--live');
    if (tagline) tagline.style.display = '';
  }, 5500);
}
function pbStartFeed() {
  if (pbFeedTimer) return;
  var msgs = pbMessages(), idx = 0;
  pbSetMsg(msgs[0]);
  pbFeedTimer = setInterval(function() {
    msgs = pbMessages();
    idx = (idx + 1) % msgs.length;
    pbSetMsg(msgs[idx]);
  }, 5500);
}
function pbRefreshFeed() {
  if (pbFeedTimer) { clearInterval(pbFeedTimer); pbFeedTimer = null; }
  pbStartFeed();
}
function pbShow() {
  var bar = document.getElementById('pb-bar');
  var tab = document.getElementById('bbx-reopen');
  if (tab) tab.style.display = 'none';
  if (bar) bar.style.display = 'flex';
  pbStartFeed();
}
function pbHide() {
  var bar = document.getElementById('pb-bar');
  if (bar) bar.style.display = 'none';
}

/* inject the bar once, then render persisted state */
function bbxInject() {
  if (document.getElementById('bbx-overlay')) return;
  var holder = document.createElement('div');
  holder.innerHTML = BBX_HTML;
  while (holder.firstChild) document.body.appendChild(holder.firstChild);
}
function bbxInit() {
  bbxInject();
  renderBbx();
  if (bbxIsSignedUp()) pbShow(); /* restore pink bar on every page load */
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bbxInit);
} else {
  bbxInit();
}

/* Our gold button (and the home popup CTA) — anywhere, any stage, ANY mode — opens the
   bar with easing instead of navigating away. Capture phase + stopPropagation so it
   preempts both the link's navigation AND the inline editor's click handling. */
document.addEventListener('click', function(e) {
  if (!e.target.closest) return;
  if (e.target.closest('.welcome-cta')) {                 /* home popup "Click Your Next $10" */
    e.preventDefault(); e.stopPropagation();
    bbxSetClicks(0);   /* welcome entry always opens the bar at the starting $79 -> $69 */
    if (typeof closeWelcome === 'function') closeWelcome(); else showBurstbox();
    return;
  }
  if (e.target.closest('.btn-gold, .nav-cta')) {          /* every gold CTA + nav CTA */
    e.preventDefault(); e.stopPropagation();
    showBurstbox();
    return;
  }
}, true);

/* Escape closes the bar when it is open */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  var el = document.getElementById('bbx-overlay');
  if (el && el.style.display === 'flex') { closeBurstbox(); }
});
