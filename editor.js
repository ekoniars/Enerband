(function() {
  'use strict';

  let currentEl = null;
  let toolbar = null;
  let fileInput = null;
  let colorInput = null;
  let inspectMode = false;
  let imgPanel = null;
  let activeImg = null;
  let editMode = true;

  // --- UTILS ---

  function getPageKey() {
    const path = window.location.pathname;
    const name = path.split('/').pop().replace('.html', '') || 'index';
    return 'enerband_' + name + '_';
  }

  function textToHtml(text) {
    return text.split('\n').join('<br>');
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- STORAGE ---

  function saveContent(key, htmlOrText, images) {
    var current = localStorage.getItem(key);
    if (current) {
      var prev1 = localStorage.getItem(key + '_prev1');
      if (prev1) { try { localStorage.setItem(key + '_prev2', prev1); } catch(e) {} }
      try { localStorage.setItem(key + '_prev1', current); } catch(e) {}
    }
    try { localStorage.removeItem(key + '_redo1'); } catch(e) {}
    try { localStorage.removeItem(key + '_redo2'); } catch(e) {}
    var isHTML = htmlOrText && htmlOrText.includes('<');
    var val;
    try {
      if (isHTML) {
        val = htmlOrText;
        localStorage.setItem(key, val);
      } else {
        var data = { text: htmlOrText, images: images };
        val = JSON.stringify(data);
        localStorage.setItem(key, val);
      }
    } catch(e) {
      console.warn('Storage full:', e);
      alert('Storage full! Try a smaller image or use a URL.');
    }
    // Persist to server DB
    try {
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, value: val || htmlOrText })
      }).then(function(r) {
        if (r.ok) showSaveToast();
      }).catch(function() {});
    } catch(e) {}
  }

  function showSaveToast() {
    var t = document.createElement('div');
    t.textContent = 'Saved to server';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#2ed573;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;z-index:10004;opacity:0;transition:opacity 0.3s;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    document.body.appendChild(t);
    requestAnimationFrame(function() { t.style.opacity = '1'; });
    setTimeout(function() {
      t.style.opacity = '0';
      setTimeout(function() { t.remove(); }, 300);
    }, 1500);
  }

  function historyShift(prefix, fromSuffix, toSuffix) {
    var moved = 0;
    var keys = Object.keys(localStorage).filter(function(k) {
      return k.startsWith(prefix) && k.endsWith(fromSuffix + '1') && !k.endsWith(fromSuffix + '11');
    });
    keys.forEach(function(k) {
      var base = k.slice(0, -(fromSuffix.length + 1));
      var current = localStorage.getItem(base);
      var step1 = localStorage.getItem(base + fromSuffix + '1');
      var step2 = localStorage.getItem(base + fromSuffix + '2');
      if (!step1) return;
      var existingTo1 = localStorage.getItem(base + toSuffix + '1');
      if (existingTo1) { try { localStorage.setItem(base + toSuffix + '2', existingTo1); } catch(e) {} }
      if (current) { try { localStorage.setItem(base + toSuffix + '1', current); } catch(e) {} }
      localStorage.setItem(base, step1);
      if (step2) {
        localStorage.setItem(base + fromSuffix + '1', step2);
        localStorage.removeItem(base + fromSuffix + '2');
      } else {
        localStorage.removeItem(base + fromSuffix + '1');
      }
      moved++;
    });
    return moved;
  }

  function countSteps(suffix) {
    var prefix = getPageKey();
    var has1 = false, has2 = false;
    var keys = Object.keys(localStorage);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.startsWith(prefix) && k.endsWith(suffix + '1') && !k.endsWith(suffix + '11')) has1 = true;
      if (k.startsWith(prefix) && k.endsWith(suffix + '2') && !k.endsWith(suffix + '12')) has2 = true;
    }
    return has2 ? 2 : has1 ? 1 : 0;
  }

  window.updateHistoryBadges = function() {
    var undoSteps = countSteps('_prev');
    var redoSteps = countSteps('_redo');
    var undoBtn = document.getElementById('btn-undo');
    var redoBtn = document.getElementById('btn-redo');
    if (undoBtn) {
      var badge = undoBtn.querySelector('.hist-badge');
      if (undoSteps > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'hist-badge';
          undoBtn.appendChild(badge);
        }
        badge.textContent = undoSteps;
      } else if (badge) { badge.remove(); }
    }
    if (redoBtn) {
      var badge2 = redoBtn.querySelector('.hist-badge');
      if (redoSteps > 0) {
        if (!badge2) {
          badge2 = document.createElement('span');
          badge2.className = 'hist-badge';
          redoBtn.appendChild(badge2);
        }
        badge2.textContent = redoSteps;
      } else if (badge2) { badge2.remove(); }
    }
  };

  window.editorUndo = function() {
    var moved = historyShift(getPageKey(), '_prev', '_redo');
    if (moved > 0) { window.location.reload(); }
    else { alert('No more undo steps.'); }
  };

  window.editorRedo = function() {
    var moved = historyShift(getPageKey(), '_redo', '_prev');
    if (moved > 0) { window.location.reload(); }
    else { alert('No more redo steps.'); }
  };

  function loadContent(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (data.text) {
        return { html: buildFullHtml(data.text, data.images || []) };
      }
      return data;
    } catch(e) {
      return { html: raw };
    }
  }

  // --- IMAGE BUILDING ---

  function buildImgTag(img) {
    return '<img src="' + img.src + '" class="editable-img align-' + img.align + '" style="width:' + img.size + '%" alt="">';
  }

  function buildFullHtml(text, images) {
    const imgsHtml = images.map(buildImgTag).join('');
    const textHtml = textToHtml(text);
    return imgsHtml + textHtml;
  }

  function loadSavedContent(el, key) {
    const data = loadContent(key);
    if (!data) return;
    el.innerHTML = data.html || '';
  }

  function loadFromServer(prefix, callback) {
    fetch('/api/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: prefix })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) { callback(data); })
    .catch(function() { callback({}); });
  }

  // --- TOOLBAR ---

  function createToolbar() {
    toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    toolbar.style.display = 'none';

    // Prevent toolbar clicks from triggering blur on the editor
    toolbar.addEventListener('mousedown', function(e) {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
      e.preventDefault();
    });

    // --- Group 1: Text Formatting ---
    var btnBold = makeBtn('B', 'Bold (Ctrl+B)', function() {
      document.execCommand('bold', false, null);
    });
    btnBold.style.fontWeight = '700';

    var btnItalic = makeBtn('I', 'Italic (Ctrl+I)', function() {
      document.execCommand('italic', false, null);
    });
    btnItalic.style.fontStyle = 'italic';

    var btnUnderline = makeBtn('U', 'Underline (Ctrl+U)', function() {
      document.execCommand('underline', false, null);
    });
    btnUnderline.style.textDecoration = 'underline';

    toolbar.appendChild(btnBold);
    toolbar.appendChild(btnItalic);
    toolbar.appendChild(btnUnderline);

    toolbar.appendChild(makeDivider());

    // --- Group 2: Alignment ---
    var btnAlignL = makeBtn('', 'Align Left', function() {
      document.execCommand('justifyLeft', false, null);
    });
    btnAlignL.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>';

    var btnAlignC = makeBtn('', 'Align Center', function() {
      document.execCommand('justifyCenter', false, null);
    });
    btnAlignC.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';

    var btnAlignR = makeBtn('', 'Align Right', function() {
      document.execCommand('justifyRight', false, null);
    });
    btnAlignR.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>';

    toolbar.appendChild(btnAlignL);
    toolbar.appendChild(btnAlignC);
    toolbar.appendChild(btnAlignR);

    toolbar.appendChild(makeDivider());

    // --- Group 3: Text Direction ---
    var btnLTR = makeBtn('', 'Left to Right', function() {
      var editor = getActiveEditor();
      if (!editor) return;
      var sel = window.getSelection();
      if (sel.rangeCount) {
        var block = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
        while (block && block !== editor && !block.matches('p,h1,h2,h3,h4,div,li')) block = block.parentElement;
        if (block && block !== editor) { block.dir = 'ltr'; block.style.textAlign = 'left'; }
        else { editor.dir = 'ltr'; editor.style.textAlign = 'left'; }
      }
    });
    btnLTR.innerHTML = '<span style="font-size:11px;font-weight:700;">LTR</span>';

    var btnRTL = makeBtn('', 'Right to Left', function() {
      var editor = getActiveEditor();
      if (!editor) return;
      var sel = window.getSelection();
      if (sel.rangeCount) {
        var block = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
        while (block && block !== editor && !block.matches('p,h1,h2,h3,h4,div,li')) block = block.parentElement;
        if (block && block !== editor) { block.dir = 'rtl'; block.style.textAlign = 'right'; }
        else { editor.dir = 'rtl'; editor.style.textAlign = 'right'; }
      }
    });
    btnRTL.innerHTML = '<span style="font-size:11px;font-weight:700;">RTL</span>';

    toolbar.appendChild(btnLTR);
    toolbar.appendChild(btnRTL);

    toolbar.appendChild(makeDivider());

    // --- Group 4: Block Type ---
    var blockSelect = document.createElement('select');
    blockSelect.className = 'edt-block-select';
    blockSelect.setAttribute('tabindex', '-1');
    blockSelect.innerHTML = '<option value="p">Text</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option><option value="h4">H4</option>';
    blockSelect.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    blockSelect.addEventListener('change', function() {
      document.execCommand('formatBlock', false, '<' + blockSelect.value + '>');
      var editor = getActiveEditor();
      if (editor) editor.focus();
    });
    toolbar.appendChild(blockSelect);

    // --- Load Google Fonts ---
    if (!document.getElementById('editor-google-fonts')) {
      var gfLink = document.createElement('link');
      gfLink.id = 'editor-google-fonts';
      gfLink.rel = 'stylesheet';
      gfLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display:wght@400;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Lato:wght@400;700&family=Montserrat:wght@400;700&family=Poppins:wght@400;700&family=Raleway:wght@400;700&family=Oswald:wght@400;700&family=Merriweather:wght@400;700&display=swap';
      document.head.appendChild(gfLink);
    }

    function wrapSelection(styleProp, styleVal) {
      var sel = window.getSelection();
      if (!sel.rangeCount) return;
      var range = sel.getRangeAt(0);
      if (range.collapsed) return;
      var contents = range.extractContents();
      var span = document.createElement('span');
      span.style[styleProp] = styleVal;
      span.appendChild(contents);
      range.insertNode(span);
      sel.removeAllRanges();
      var newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
    }

    // --- Font Size select ---
    var sizeSelect = document.createElement('select');
    sizeSelect.className = 'edt-block-select';
    sizeSelect.setAttribute('tabindex', '-1');
    sizeSelect.title = 'Font Size';
    sizeSelect.innerHTML = '<option value="">Size</option>' +
      '<option value="12px">12</option><option value="14px">14</option>' +
      '<option value="16px">16</option><option value="18px">18</option>' +
      '<option value="20px">20</option><option value="24px">24</option>' +
      '<option value="28px">28</option><option value="32px">32</option>' +
      '<option value="36px">36</option><option value="42px">42</option>' +
      '<option value="48px">48</option><option value="56px">56</option>' +
      '<option value="64px">64</option>';
    sizeSelect.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    sizeSelect.addEventListener('change', function() {
      if (!sizeSelect.value) return;
      wrapSelection('fontSize', sizeSelect.value);
      sizeSelect.value = '';
      var editor = getActiveEditor();
      if (editor) editor.focus();
    });
    toolbar.appendChild(sizeSelect);

    // --- Font Family select ---
    var fontSelect = document.createElement('select');
    fontSelect.className = 'edt-block-select';
    fontSelect.setAttribute('tabindex', '-1');
    fontSelect.title = 'Font Family';
    fontSelect.style.minWidth = '80px';
    fontSelect.innerHTML = '<option value="">Font</option>' +
      '<option value="inherit">Default</option>' +
      '<option value="Inter, sans-serif" style="font-family:Inter,sans-serif">Inter</option>' +
      '<option value="Roboto, sans-serif" style="font-family:Roboto,sans-serif">Roboto</option>' +
      '<option value="Open Sans, sans-serif" style="font-family:Open Sans,sans-serif">Open Sans</option>' +
      '<option value="Lato, sans-serif" style="font-family:Lato,sans-serif">Lato</option>' +
      '<option value="Montserrat, sans-serif" style="font-family:Montserrat,sans-serif">Montserrat</option>' +
      '<option value="Poppins, sans-serif" style="font-family:Poppins,sans-serif">Poppins</option>' +
      '<option value="Raleway, sans-serif" style="font-family:Raleway,sans-serif">Raleway</option>' +
      '<option value="Playfair Display, serif" style="font-family:Playfair Display,serif">Playfair</option>' +
      '<option value="Merriweather, serif" style="font-family:Merriweather,serif">Merriweather</option>' +
      '<option value="Oswald, sans-serif" style="font-family:Oswald,sans-serif">Oswald</option>';
    fontSelect.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    fontSelect.addEventListener('change', function() {
      if (!fontSelect.value) return;
      wrapSelection('fontFamily', fontSelect.value);
      fontSelect.value = '';
      var editor = getActiveEditor();
      if (editor) editor.focus();
    });
    toolbar.appendChild(fontSelect);

    toolbar.appendChild(makeDivider());

    // --- Group 5: Color ---
    colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#000000';
    colorInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';
    colorInput.addEventListener('input', function() {
      document.execCommand('foreColor', false, colorInput.value);
      var editor = getActiveEditor();
      if (editor) {
        var fonts = editor.querySelectorAll('font[color]');
        for (var i = 0; i < fonts.length; i++) {
          fonts[i].style.webkitTextFillColor = fonts[i].getAttribute('color');
          fonts[i].dataset.userColor = '1';
        }
      }
    });

    var btnColor = makeBtn('A', 'Text Color', function() {
      colorInput.click();
    });
    // Style the A with a colored underline bar
    btnColor.style.position = 'relative';
    var colorBar = document.createElement('span');
    colorBar.className = 'edt-color-bar';
    btnColor.appendChild(colorBar);
    toolbar.appendChild(btnColor);
    toolbar.appendChild(colorInput);

    // Keep color bar in sync
    colorInput.addEventListener('input', function() {
      colorBar.style.background = colorInput.value;
    });

    // --- Default Color (applies to all text at once) ---
    var defaultColorInput = document.createElement('input');
    defaultColorInput.type = 'color';
    defaultColorInput.value = '#222222';
    defaultColorInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';
    defaultColorInput.addEventListener('input', function() {
      var editor = getActiveEditor();
      if (!editor) return;
      var c = defaultColorInput.value;
      editor.style.color = c;
      editor.style.webkitTextFillColor = c;
      var children = editor.querySelectorAll('*');
      for (var i = 0; i < children.length; i++) {
        var el = children[i];
        if (el.querySelector('font[color]') || el.tagName === 'FONT') continue;
        if (el.style.color && el.dataset.userColor) continue;
        el.style.color = c;
        el.style.webkitTextFillColor = c;
      }
      defaultColorBar.style.background = c;
    });
    var btnDefaultColor = makeBtn('Aa', 'Default Color (all text)', function() {
      defaultColorInput.click();
    });
    btnDefaultColor.style.position = 'relative';
    btnDefaultColor.style.fontSize = '11px';
    btnDefaultColor.style.fontWeight = '700';
    var defaultColorBar = document.createElement('span');
    defaultColorBar.className = 'edt-color-bar';
    defaultColorBar.style.background = '#222';
    btnDefaultColor.appendChild(defaultColorBar);
    toolbar.appendChild(btnDefaultColor);
    toolbar.appendChild(defaultColorInput);

    // Divider
    toolbar.appendChild(makeDivider());

    // --- Group 3: Insert ---
    // Link button
    var btnLink = makeBtn('', 'Insert Link', function() {
      var url = prompt('Enter URL:');
      if (url && url.trim()) {
        document.execCommand('createLink', false, url.trim());
      }
    });
    var linkSvg = document.createElement('span');
    linkSvg.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    btnLink.appendChild(linkSvg);

    // Image upload button
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var editor = getActiveEditor();
        if (editor) {
          editor.focus();
          var img = document.createElement('img');
          img.src = ev.target.result;
          img.className = 'editable-img align-left';
          img.style.maxWidth = '100%';
          img.alt = '';

          // Insert at cursor or append
          var sel = window.getSelection();
          if (sel.rangeCount && editor.contains(sel.anchorNode)) {
            var range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            // Move cursor after the image
            range.setStartAfter(img);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            editor.appendChild(img);
          }
        }
      };
      reader.readAsDataURL(file);
      // Reset so same file can be chosen again
      fileInput.value = '';
    });

    var btnImage = makeBtn('', 'Insert Image', function() {
      fileInput.click();
    });
    var imgSvg = document.createElement('span');
    imgSvg.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    btnImage.appendChild(imgSvg);

    toolbar.appendChild(btnLink);
    toolbar.appendChild(btnImage);
    toolbar.appendChild(fileInput);

    // Divider
    toolbar.appendChild(makeDivider());

    // --- Group 4: View ---
    var btnInspect = makeBtn('', 'Toggle HTML View', function() {
      var editor = getActiveEditor();
      if (!editor) return;

      var existingWrap = currentEl.querySelector('.edt-html-wrap');
      var existing = currentEl.querySelector('.edt-html-view');

      if (existing) {
        editor.innerHTML = existing.value;
        if (existingWrap) existingWrap.remove(); else existing.remove();
        editor.style.display = '';
        inspectMode = false;
        btnInspect.classList.remove('edt-active');
      } else {
        // Switch to HTML view
        var wrap = document.createElement('div');
        wrap.className = 'edt-html-wrap';
        var ta = document.createElement('textarea');
        ta.className = 'edt-html-view';
        ta.style.cssText = 'font-family:Consolas,Courier New,monospace;font-size:16px;line-height:1.4;font-weight:400;font-style:normal;text-transform:none;letter-spacing:0;color:#000;background:#fff;-webkit-text-fill-color:#000;background-clip:border-box;-webkit-background-clip:border-box;';
        ta.value = editor.innerHTML;
        var htmlBar = document.createElement('div');
        htmlBar.className = 'edt-html-bar';
        var expandBtn = document.createElement('button');
        expandBtn.className = 'edt-tb-btn';
        expandBtn.style.cssText = 'width:auto;padding:4px 12px;font-size:12px;font-weight:700;background:#333;color:#fff !important;border:none;border-radius:4px;cursor:pointer;';
        expandBtn.textContent = 'Expand';
        expandBtn.title = 'Expand / Collapse';
        expandBtn.addEventListener('mousedown', function(e) {
          e.preventDefault(); e.stopPropagation();
          ta.classList.toggle('expanded');
          if (ta.classList.contains('expanded')) {
            expandBtn.textContent = 'Collapse';
            expandBtn.style.background = '#c0392b';
          } else {
            expandBtn.textContent = 'Expand';
            expandBtn.style.background = '#333';
          }
          ta.focus();
        });
        var zoomSlider = document.createElement('input');
        zoomSlider.type = 'range';
        zoomSlider.min = '50';
        zoomSlider.max = '250';
        zoomSlider.step = '10';
        zoomSlider.value = '100';
        var zoomLabel = document.createElement('span');
        zoomLabel.className = 'zoom-label';
        zoomLabel.textContent = '100%';
        zoomSlider.addEventListener('input', function() {
          var pct = parseInt(zoomSlider.value);
          ta.style.fontSize = (16 * pct / 100) + 'px';
          zoomLabel.textContent = pct + '%';
        });
        zoomSlider.addEventListener('mousedown', function(e) { e.stopPropagation(); });
        htmlBar.appendChild(expandBtn);
        htmlBar.appendChild(zoomSlider);
        htmlBar.appendChild(zoomLabel);
        wrap.appendChild(htmlBar);
        wrap.appendChild(ta);
        editor.parentNode.insertBefore(wrap, editor.nextSibling);
        editor.style.display = 'none';
        ta.focus();
        inspectMode = true;
        btnInspect.classList.add('edt-active');

        ta.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            editor.innerHTML = ta.value;
            wrap.remove();
            editor.style.display = '';
            inspectMode = false;
            btnInspect.classList.remove('edt-active');
            editor.focus();
          }
          if (e.key === 'Escape') {
            wrap.remove();
            editor.style.display = '';
            inspectMode = false;
            btnInspect.classList.remove('edt-active');
            editor.focus();
          }
        });

        ta.addEventListener('blur', function(e) {
          var related = e.relatedTarget;
          if (related && (toolbar.contains(related) || wrap.contains(related))) return;
          setTimeout(function() {
            if (!currentEl) return;
            if (currentEl.contains(document.activeElement)) return;
            editor.innerHTML = ta.value;
            wrap.remove();
            editor.style.display = '';
            inspectMode = false;
            btnInspect.classList.remove('edt-active');
            editor.dispatchEvent(new FocusEvent('blur', { relatedTarget: null }));
          }, 100);
        });
      }
    });
    var inspectIcon = document.createElement('span');
    inspectIcon.textContent = '</>';
    inspectIcon.style.cssText = 'font-size:12px;font-family:monospace;font-weight:700;';
    btnInspect.appendChild(inspectIcon);

    toolbar.appendChild(btnInspect);

    document.body.appendChild(toolbar);

    // --- Image editing panel ---
    imgPanel = document.createElement('div');
    imgPanel.className = 'edt-img-panel';
    imgPanel.style.display = 'none';
    imgPanel.addEventListener('mousedown', function(e) {
      if (e.target.tagName !== 'INPUT') e.preventDefault();
    });
    imgPanel.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span style="font-size:12px;font-weight:700;color:#333;">Size:</span>' +
        '<input type="range" class="edt-img-size" min="10" max="100" value="100" style="flex:1;">' +
        '<span class="edt-img-size-val" style="font-size:12px;color:var(--gold);font-weight:700;min-width:35px;">100%</span>' +
      '</div>' +
      '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
        '<button class="edt-img-align edt-tb-btn" data-align="left" title="Left">&#8612;</button>' +
        '<button class="edt-img-align edt-tb-btn" data-align="center" title="Center">&#8633;</button>' +
        '<button class="edt-img-align edt-tb-btn" data-align="right" title="Right">&#8614;</button>' +
        '<span class="edt-tb-divider"></span>' +
        '<button class="edt-img-delete edt-tb-btn" title="Delete" style="color:#e00;">&#10005;</button>' +
      '</div>';
    document.body.appendChild(imgPanel);

    var imgSlider = imgPanel.querySelector('.edt-img-size');
    var imgSizeVal = imgPanel.querySelector('.edt-img-size-val');
    var imgAlignBtns = imgPanel.querySelectorAll('.edt-img-align');
    var imgDeleteBtn = imgPanel.querySelector('.edt-img-delete');

    imgSlider.addEventListener('input', function() {
      imgSizeVal.textContent = imgSlider.value + '%';
      if (activeImg) {
        activeImg.style.width = imgSlider.value + '%';
        activeImg.style.maxWidth = imgSlider.value + '%';
      }
    });

    imgAlignBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!activeImg) return;
        imgAlignBtns.forEach(function(b) { b.classList.remove('edt-active'); });
        btn.classList.add('edt-active');
        var align = btn.dataset.align;
        activeImg.className = 'editable-img align-' + align;
      });
    });

    imgDeleteBtn.addEventListener('click', function() {
      if (activeImg) {
        activeImg.remove();
        hideImgPanel();
      }
    });
  }

  function showImgPanel(img) {
    activeImg = img;
    var rect = img.getBoundingClientRect();
    imgPanel.style.top = (rect.top + window.scrollY - imgPanel.offsetHeight - 6) + 'px';
    imgPanel.style.left = rect.left + 'px';
    imgPanel.style.display = '';

    var slider = imgPanel.querySelector('.edt-img-size');
    var sizeVal = imgPanel.querySelector('.edt-img-size-val');
    var w = parseInt(img.style.width) || 100;
    slider.value = w;
    sizeVal.textContent = w + '%';

    var currentAlign = 'left';
    if (img.classList.contains('align-center')) currentAlign = 'center';
    if (img.classList.contains('align-right')) currentAlign = 'right';
    imgPanel.querySelectorAll('.edt-img-align').forEach(function(b) {
      b.classList.toggle('edt-active', b.dataset.align === currentAlign);
    });

    img.style.outline = '2px solid var(--gold)';
  }

  function hideImgPanel() {
    imgPanel.style.display = 'none';
    if (activeImg) {
      activeImg.style.outline = '';
      activeImg = null;
    }
  }

  function makeBtn(label, title, handler) {
    var btn = document.createElement('button');
    btn.className = 'edt-tb-btn';
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute('tabindex', '-1');
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      handler();
    });
    return btn;
  }

  function makeDivider() {
    var d = document.createElement('span');
    d.className = 'edt-tb-divider';
    return d;
  }

  function getActiveEditor() {
    if (!currentEl) return null;
    return currentEl.querySelector('[contenteditable]');
  }

  function showToolbar(editorDiv) {
    // Position above the editor, inside the .editable wrapper
    // Insert toolbar before the editor div so it sits on top
    if (toolbar.parentNode !== currentEl) {
      currentEl.insertBefore(toolbar, editorDiv);
    }
    toolbar.style.display = '';
  }

  function hideToolbar() {
    toolbar.style.display = 'none';
    // Move back to body to avoid being cleared with innerHTML
    if (toolbar.parentNode !== document.body) {
      document.body.appendChild(toolbar);
    }
    inspectMode = false;
  }

  // --- EDITABLE ---

  function stripShimmerStyles(root) {
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var s = el.style;
      if (s.webkitTextFillColor) s.webkitTextFillColor = '';
      if (s.webkitBackgroundClip === 'text') { s.webkitBackgroundClip = ''; s.backgroundClip = ''; }
      if (s.backgroundImage && s.backgroundImage.indexOf('linear-gradient') !== -1 && s.webkitBackgroundClip === '') {
        // only clear background-image if it was a text-clip gradient (shimmer)
      }
    }
    root.style.color = '#222';
    root.style.webkitTextFillColor = '#222';
  }

  function initEditable(el, key) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!editMode) return;
      if (this.classList.contains('editing')) return;

      currentEl = this;
      this.classList.add('editing');

      var originalHTML = this.innerHTML;
      var savedClasses = this.className;

      // Create contenteditable div
      var editor = document.createElement('div');
      editor.contentEditable = 'true';
      editor.className = 'edt-content';
      editor.innerHTML = originalHTML;
      stripShimmerStyles(editor);

      this.innerHTML = '';
      this.appendChild(editor);

      showToolbar(editor);
      editor.focus();

      var self = this;

      var save = function() {
        hideImgPanel();
        var htmlView = self.querySelector('.edt-html-view');
        if (htmlView) {
          editor.innerHTML = htmlView.value;
          var htmlWrap = self.querySelector('.edt-html-wrap');
          if (htmlWrap) htmlWrap.remove(); else htmlView.remove();
          editor.style.display = '';
        }
        var newHTML = editor.innerHTML;
        hideToolbar();
        self.innerHTML = newHTML;
        self.classList.remove('editing');
        saveContent(key, newHTML, []);
        currentEl = null;
        if (window.updateHistoryBadges) window.updateHistoryBadges();
      };

      var cancel = function() {
        hideImgPanel();
        hideToolbar();
        self.innerHTML = originalHTML;
        self.classList.remove('editing');
        currentEl = null;
      };

      editor.addEventListener('blur', function(e) {
        var related = e.relatedTarget;
        if (related) {
          if (toolbar.contains(related)) return;
          if (imgPanel && imgPanel.contains(related)) return;
          if (related === fileInput || related === colorInput) return;
          var htmlWrap = self.querySelector('.edt-html-wrap');
          if (htmlWrap && htmlWrap.contains(related)) return;
          var htmlView = self.querySelector('.edt-html-view');
          if (htmlView && (htmlView === related || htmlView.contains(related))) return;
        }
        setTimeout(function() {
          if (imgPanel && imgPanel.contains(document.activeElement)) return;
          var htmlWrap = self.querySelector('.edt-html-wrap');
          if (htmlWrap && htmlWrap.contains(document.activeElement)) return;
          var htmlView = self.querySelector('.edt-html-view');
          if (htmlView && document.activeElement === htmlView) return;
          if (self.contains(document.activeElement)) return;
          save();
        }, 100);
      });

      editor.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault();
          save();
        }
        if (e.key === 'Escape') {
          cancel();
        }
      });

      editor.addEventListener('click', function(e) {
        if (e.target.tagName === 'IMG') {
          e.stopPropagation();
          showImgPanel(e.target);
        } else {
          hideImgPanel();
        }
      });
    });

    // Double-click to copy (only when NOT editing)
    el.addEventListener('dblclick', function(e) {
      if (this.classList.contains('editing')) return;
      e.stopPropagation();
      navigator.clipboard.writeText(this.innerText);
      var tooltip = document.createElement('div');
      tooltip.className = 'copy-tooltip';
      tooltip.textContent = 'Copied!';
      document.body.appendChild(tooltip);
      setTimeout(function() { tooltip.remove(); }, 2000);
    });
  }

  // --- MAIN INIT ---

  function init() {
    var prefix = getPageKey();

    createToolbar();

    var editables = document.querySelectorAll('.editable');

    // Check if localStorage has any content for this page
    var hasLocal = false;
    for (var li = 0; li < editables.length; li++) {
      if (localStorage.getItem(prefix + li)) { hasLocal = true; break; }
    }

    if (hasLocal) {
      editables.forEach(function(el, i) {
        var key = prefix + i;
        loadSavedContent(el, key);
        initEditable(el, key);
      });
    } else {
      // No localStorage — try loading from server DB
      loadFromServer(prefix, function(serverData) {
        var keys = Object.keys(serverData);
        if (keys.length > 0) {
          keys.forEach(function(k) {
            try { localStorage.setItem(k, serverData[k]); } catch(e) {}
          });
          editables.forEach(function(el, i) {
            var key = prefix + i;
            loadSavedContent(el, key);
          });
        }
      });
      editables.forEach(function(el, i) {
        initEditable(el, prefix + i);
      });
    }

    document.addEventListener('click', function(e) {
      if (!editMode) return;
      var link = e.target.closest('a');
      if (link && !link.closest('.nav') && !link.closest('.demo-banner') && !link.closest('.footer')) {
        e.preventDefault();
      }
    }, true);

    window.toggleEditMode = function() {
      editMode = !editMode;
      document.body.classList.toggle('view-mode', !editMode);
      var btn = document.getElementById('btn-mode');
      if (btn) {
        btn.innerHTML = editMode ? '&#9998;' : '&#128065;';
        btn.title = editMode ? 'Edit mode (click to switch to view)' : 'View mode (click to switch to edit)';
      }
    };

    console.log('Editor ready. Click to edit, Ctrl+Enter to save.');
    window.updateHistoryBadges();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
