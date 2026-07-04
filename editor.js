(function() {
  'use strict';

  let currentEl = null;
  let toolbar = null;
  let fileInput = null;
  let colorInput = null;
  let inspectMode = false;
  let imgPanel = null;
  let activeImg = null;
  let editMode = sessionStorage.getItem('enerband_view_mode') !== 'true';

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

  function closeHtmlExpand() {
    var bd = document.querySelector('.edt-html-backdrop');
    if (bd) bd.remove();
    document.body.style.overflow = '';
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

  function showSaveToast(msg) {
    var t = document.createElement('div');
    t.textContent = msg || 'Saved to server';
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

    var btnStrike = makeBtn('S', 'Strikethrough', function() {
      document.execCommand('strikeThrough', false, null);
    });
    btnStrike.style.textDecoration = 'line-through';
    toolbar.appendChild(btnStrike);

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

    // --- Line Height select ---
    var lineHSelect = document.createElement('select');
    lineHSelect.className = 'edt-block-select';
    lineHSelect.setAttribute('tabindex', '-1');
    lineHSelect.title = 'Line Height';
    lineHSelect.innerHTML = '<option value="">Line H.</option>' +
      '<option value="1.0">1.0</option><option value="1.2">1.2</option>' +
      '<option value="1.4">1.4</option><option value="1.5">1.5</option>' +
      '<option value="1.6">1.6</option><option value="1.8">1.8</option>' +
      '<option value="2.0">2.0</option><option value="2.5">2.5</option>' +
      '<option value="3.0">3.0</option>';
    lineHSelect.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    lineHSelect.addEventListener('change', function() {
      if (!lineHSelect.value) return;
      wrapSelection('lineHeight', lineHSelect.value);
      lineHSelect.value = '';
      var editor = getActiveEditor();
      if (editor) editor.focus();
    });
    toolbar.appendChild(lineHSelect);

    // --- Letter Spacing select ---
    var spacingSelect = document.createElement('select');
    spacingSelect.className = 'edt-block-select';
    spacingSelect.setAttribute('tabindex', '-1');
    spacingSelect.title = 'Letter Spacing';
    spacingSelect.innerHTML = '<option value="">Spacing</option>' +
      '<option value="0px">0</option><option value="0.5px">0.5px</option>' +
      '<option value="1px">1px</option><option value="1.5px">1.5px</option>' +
      '<option value="2px">2px</option><option value="3px">3px</option>' +
      '<option value="5px">5px</option>';
    spacingSelect.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    spacingSelect.addEventListener('change', function() {
      if (!spacingSelect.value) return;
      wrapSelection('letterSpacing', spacingSelect.value);
      spacingSelect.value = '';
      var editor = getActiveEditor();
      if (editor) editor.focus();
    });
    toolbar.appendChild(spacingSelect);

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

    // --- Background Color / Highlight ---
    var bgColorInput = document.createElement('input');
    bgColorInput.type = 'color';
    bgColorInput.value = '#FFFF00';
    bgColorInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';
    bgColorInput.addEventListener('input', function() {
      // hiliteColor for WebKit/Blink, backColor for Firefox
      if (!document.execCommand('hiliteColor', false, bgColorInput.value)) {
        document.execCommand('backColor', false, bgColorInput.value);
      }
    });

    var btnBgColor = makeBtn('A', 'Highlight / Background Color', function() {
      bgColorInput.click();
    });
    btnBgColor.style.position = 'relative';
    btnBgColor.style.fontWeight = '700';
    var bgColorBar = document.createElement('span');
    bgColorBar.className = 'edt-color-bar';
    bgColorBar.style.background = '#FFFF00';
    btnBgColor.style.backgroundColor = 'rgba(255,255,0,0.15)';
    btnBgColor.appendChild(bgColorBar);
    toolbar.appendChild(btnBgColor);
    toolbar.appendChild(bgColorInput);

    bgColorInput.addEventListener('input', function() {
      bgColorBar.style.background = bgColorInput.value;
      btnBgColor.style.backgroundColor = bgColorInput.value + '26';
    });

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

      var existingWrap = currentEl._htmlWrap || currentEl.querySelector('.edt-html-wrap');
      var existing = existingWrap ? existingWrap.querySelector('.edt-html-view') : null;

      if (existing) {
        editor.innerHTML = existing.value;
        existingWrap.remove();
        currentEl._htmlWrap = null;
        closeHtmlExpand();
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
        expandBtn.style.cssText = 'width:auto;padding:4px 12px;font-size:12px;font-weight:700;background:#333;color:#fff !important;-webkit-text-fill-color:#fff !important;border:none;border-radius:4px;cursor:pointer;';
        expandBtn.textContent = 'Expand';
        expandBtn.title = 'Expand / Collapse';
        var setExpanded = function(on) {
          wrap.classList.toggle('expanded', on);
          document.body.style.overflow = on ? 'hidden' : '';
          if (on) {
            // Relocate to <body> so position:fixed is relative to the viewport,
            // not a transformed/filtered ancestor (which would shrink it).
            if (wrap.parentNode !== document.body) document.body.appendChild(wrap);
          } else {
            if (homeParent) homeParent.insertBefore(wrap, homeNext);
          }
          expandBtn.textContent = on ? 'Collapse' : 'Expand';
          expandBtn.style.background = on ? '#c0392b' : '#333';
        };
        expandBtn.addEventListener('mousedown', function(e) {
          e.preventDefault(); e.stopPropagation();
          setExpanded(!wrap.classList.contains('expanded'));
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
        var homeParent = wrap.parentNode;
        var homeNext = wrap.nextSibling;
        var ownerEl = currentEl;
        ownerEl._htmlWrap = wrap;
        editor.style.display = 'none';
        ta.focus();
        inspectMode = true;
        btnInspect.classList.add('edt-active');

        ta.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            editor.innerHTML = ta.value;
            closeHtmlExpand();
            wrap.remove();
            ownerEl._htmlWrap = null;
            editor.style.display = '';
            inspectMode = false;
            btnInspect.classList.remove('edt-active');
            editor.focus();
          }
          if (e.key === 'Escape') {
            if (wrap.classList.contains('expanded')) {
              setExpanded(false);
              ta.focus();
              return;
            }
            closeHtmlExpand();
            wrap.remove();
            ownerEl._htmlWrap = null;
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
            if (wrap.contains(document.activeElement)) return;
            editor.innerHTML = ta.value;
            closeHtmlExpand();
            wrap.remove();
            ownerEl._htmlWrap = null;
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

    // --- Effect dropdown ---
    var effectSelect = document.createElement('select');
    effectSelect.className = 'edt-block-select';
    effectSelect.setAttribute('tabindex', '-1');
    effectSelect.title = 'Text Effect';
    effectSelect.style.minWidth = '80px';
    effectSelect.innerHTML = '<option value="">Effect</option>' +
      '<option value="none">None</option>' +
      '<option value="shadow">Shadow</option>' +
      '<option value="glow">Glow</option>' +
      '<option value="outline">Outline</option>' +
      '<option value="uppercase">Uppercase</option>' +
      '<option value="lowercase">Lowercase</option>' +
      '<option value="capitalize">Capitalize</option>';
    effectSelect.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    effectSelect.addEventListener('change', function() {
      if (!effectSelect.value) return;
      var val = effectSelect.value;
      var sel = window.getSelection();
      if (!sel.rangeCount) { effectSelect.value = ''; return; }
      var range = sel.getRangeAt(0);

      if (val === 'none') {
        // Clear effects from selected text
        if (!range.collapsed) {
          var contents = range.extractContents();
          var span = document.createElement('span');
          span.style.textShadow = 'none';
          span.style.webkitTextStroke = '0';
          span.style.textTransform = 'none';
          span.appendChild(contents);
          range.insertNode(span);
          sel.removeAllRanges();
          var nr = document.createRange();
          nr.selectNodeContents(span);
          sel.addRange(nr);
        }
      } else if (val === 'shadow') {
        wrapSelection('textShadow', '2px 2px 4px rgba(0,0,0,0.3)');
      } else if (val === 'glow') {
        wrapSelection('textShadow', '0 0 10px rgba(219,189,133,0.8), 0 0 20px rgba(219,189,133,0.4)');
      } else if (val === 'outline') {
        wrapSelection('webkitTextStroke', '1px currentColor');
      } else if (val === 'uppercase') {
        wrapSelection('textTransform', 'uppercase');
      } else if (val === 'lowercase') {
        wrapSelection('textTransform', 'lowercase');
      } else if (val === 'capitalize') {
        wrapSelection('textTransform', 'capitalize');
      }

      effectSelect.value = '';
      var editor = getActiveEditor();
      if (editor) editor.focus();
    });
    toolbar.appendChild(effectSelect);

    toolbar.appendChild(makeDivider());

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
      if (reorderMode) return;
      if (!editMode) return;
      if (this.classList.contains('editing')) return;

      currentEl = this;
      this.classList.add('editing');

      // If this editable lives inside a sized button, temporarily free the
      // button from its fixed size so the editing toolbar/area can display.
      var hostBtn = this.closest('.btn');
      var hostBtnRestore = null;
      if (hostBtn) {
        hostBtnRestore = {
          height: hostBtn.style.height,
          minHeight: hostBtn.style.minHeight,
          maxHeight: hostBtn.style.maxHeight,
          width: hostBtn.style.width,
          overflow: hostBtn.style.overflow,
          display: hostBtn.style.display
        };
        hostBtn.style.height = 'auto';
        hostBtn.style.minHeight = '0';
        hostBtn.style.maxHeight = 'none';
        hostBtn.style.width = 'auto';
        hostBtn.style.overflow = 'visible';
        hostBtn.style.display = 'block';
        this.style.display = 'block';
      }
      var restoreHostBtn = function() {
        if (!hostBtn || !hostBtnRestore) return;
        hostBtn.style.height = hostBtnRestore.height;
        hostBtn.style.minHeight = hostBtnRestore.minHeight;
        hostBtn.style.maxHeight = hostBtnRestore.maxHeight;
        hostBtn.style.width = hostBtnRestore.width;
        hostBtn.style.overflow = hostBtnRestore.overflow;
        hostBtn.style.display = hostBtnRestore.display;
        self.style.display = '';
      };

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
        var htmlWrap = self._htmlWrap || self.querySelector('.edt-html-wrap');
        var htmlView = htmlWrap ? htmlWrap.querySelector('.edt-html-view') : self.querySelector('.edt-html-view');
        if (htmlView) {
          editor.innerHTML = htmlView.value;
          if (htmlWrap) htmlWrap.remove(); else htmlView.remove();
          self._htmlWrap = null;
          closeHtmlExpand();
          editor.style.display = '';
        }
        var newHTML = editor.innerHTML;
        hideToolbar();
        restoreHostBtn();
        self.innerHTML = newHTML;
        self.classList.remove('editing');
        if (key) saveContent(key, newHTML, []);
        currentEl = null;
        var dynHost = self.closest('[data-dynamic]');
        if (dynHost) updateDynamicStrip(dynHost);
        if (window.updateHistoryBadges) window.updateHistoryBadges();
      };

      var cancel = function() {
        hideImgPanel();
        hideToolbar();
        restoreHostBtn();
        if (self._htmlWrap) { self._htmlWrap.remove(); self._htmlWrap = null; }
        closeHtmlExpand();
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
          var htmlWrap = self._htmlWrap || self.querySelector('.edt-html-wrap');
          if (htmlWrap && htmlWrap.contains(related)) return;
        }
        setTimeout(function() {
          if (imgPanel && imgPanel.contains(document.activeElement)) return;
          var htmlWrap = self._htmlWrap || self.querySelector('.edt-html-wrap');
          if (htmlWrap && htmlWrap.contains(document.activeElement)) return;
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

    // Reconstruct dynamic strips first. Local renders synchronously (handled by
    // the loadStripOrder call at the end of init); the server-only path renders
    // async and re-applies ordering itself once the strips exist.
    loadDynamicStrips();

    // Original editables exclude any inside dynamic strips, so original
    // index-based keys never shift no matter how many strips are added.
    var editables = Array.prototype.filter.call(
      document.querySelectorAll('.editable'),
      function(el) { return !el.closest('[data-dynamic]'); }
    );

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
      if (!editMode) {
        /* entering view mode — close any open editables cleanly */
        if (document.activeElement) document.activeElement.blur();
        document.querySelectorAll('[contenteditable]').forEach(function(el) {
          el.removeAttribute('contenteditable');
          el.classList.remove('editing');
        });
        document.querySelectorAll('.editor-toolbar').forEach(function(t) {
          t.style.display = 'none';
        });
        sessionStorage.setItem('enerband_view_mode', 'true');
      } else {
        sessionStorage.removeItem('enerband_view_mode');
      }
      document.body.classList.toggle('view-mode', !editMode);
      var btn = document.getElementById('btn-mode');
      if (btn) {
        btn.innerHTML = editMode ? '&#128065;' : '&#9998;';
        btn.title = editMode ? 'Switch to view mode' : 'Switch to edit mode';
      }
    };

    /* create floating edit FAB — visible only in view mode */
    (function() {
      var fab = document.createElement('button');
      fab.id = 'btn-edit-fab';
      fab.innerHTML = '&#9998;';
      fab.title = 'Switch to edit mode';
      fab.onclick = window.toggleEditMode;
      document.body.appendChild(fab);
    })();

    /* apply stored view mode on fresh page load */
    if (!editMode) {
      document.body.classList.add('view-mode');
      var modeBtn = document.getElementById('btn-mode');
      if (modeBtn) { modeBtn.innerHTML = '&#9998;'; modeBtn.title = 'Switch to edit mode'; }
    }

    console.log('Editor ready. Click to edit, Ctrl+Enter to save.');
    window.updateHistoryBadges();
    initStripManager();
    initGapInserter();
    initButtonResizer();
    if ('IntersectionObserver' in window) {
      ensureAnimObserver();
      document.body.classList.add('anim-ready');
    }
    loadStripOrder();
    pruneStripOrder();
    loadStripStyles();
  }

  // === STRIP MANAGER ===

  var stripSelector = 'section, .section-image-strip';
  var stripBtn = null;
  var stripMenu = null;
  var activeStrip = null;
  var reorderMode = false;
  var dragStrip = null;
  var dragPlaceholder = null;
  var dragOffsetY = 0;
  var REORDER_SCALE = 0.6;
  var REORDER_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var reorderSnapshot = null;
  var stripStyles = {};         // sid -> design options object
  var animObserver = null;      // IntersectionObserver for scroll-in effects
  var designStrip = null;       // strip currently being designed
  var designPending = {};       // live-edited design values
  var designSnapshot = {};      // values to restore on cancel
  var designCtl = {};           // references to design form controls

  function getStrips() {
    return Array.from(document.querySelectorAll(stripSelector)).filter(function(s) {
      return !s.closest('.nav') && !s.closest('.footer') && !s.closest('.demo-banner');
    });
  }

  // --- Strip order persistence ---

  function getStripOrderKey() { return getPageKey() + 'strip_order'; }

  // Assign a stable id to each strip based on its ORIGINAL HTML order.
  // On a fresh load the DOM is always in original order, so the same strip
  // always gets the same id across reloads — making saved orders portable.
  function assignStripIds() {
    // Number ORIGINALS among originals only (skip dynamic + already-assigned),
    // so the Nth original always gets sid_<N> regardless of dynamic strips.
    var i = 0;
    getStrips().forEach(function(s) {
      if (s.dataset.stripId) return;
      s.dataset.stripId = 'sid_' + i;
      i++;
    });
  }

  function applyStripOrder(orderArr) {
    if (!orderArr || !orderArr.length) return;
    var strips = getStrips();
    if (!strips.length) return;
    var byId = {};
    strips.forEach(function(s) { byId[s.dataset.stripId] = s; });
    var parent = strips[0].parentNode;
    var endAnchor = strips[strips.length - 1].nextSibling;
    orderArr.forEach(function(id) {
      var el = byId[id];
      if (el && el.parentNode === parent) parent.insertBefore(el, endAnchor);
    });
  }

  function saveStripOrder(silent) {
    var order = getStrips().map(function(s) { return s.dataset.stripId; });
    var val = JSON.stringify(order);
    var key = getStripOrderKey();
    try { localStorage.setItem(key, val); } catch(e) {}
    // Indicate immediately (localStorage is the primary cache)
    if (!silent) showSaveToast('סדר הסטריפים נשמר ✓');
    try {
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, value: val })
      }).catch(function() {});
    } catch(e) {}
  }

  function loadStripOrder() {
    assignStripIds();
    var key = getStripOrderKey();
    var local = localStorage.getItem(key);
    if (local) {
      try { applyStripOrder(JSON.parse(local)); } catch(e) {}
      return;
    }
    fetch('/api/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: key })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data[key]) {
        try { localStorage.setItem(key, data[key]); } catch(e) {}
        try { applyStripOrder(JSON.parse(data[key])); } catch(e) {}
      }
    })
    .catch(function() {});
  }

  // === DYNAMIC STRIPS (page builder) ===

  var dynamicStrips = [];       // in-memory mirror of persisted [{id, html}]
  var gapBtn = null;            // the gold "+" between-strips button
  var gapBeforeNode = null;     // strip the new one is inserted before (null = before footer)
  var pickerOverlay = null;     // template picker modal
  var pickerContext = null;     // { mode:'add'|'change', beforeNode?, strip? }

  function getDynamicStripsKey() { return getPageKey() + 'dynamic_strips'; }

  var SAMPLE_IMAGES = {
    face: '../images/hero-face.png',
    eyes: '../images/eyes-closeup.jpg',
    prof: '../images/prof-shemer.png',
    product: '../images/enerband-product.gif',
    t1: '../images/testimonial-heather.png',
    t2: '../images/testimonial-jennifer.png',
    t3: '../images/testimonial-sandra.png',
    t4: '../images/testimonial-alisa.png'
  };

  // --- Template builders ---

  function _imgEditable(src) {
    return '<div class="editable"><img src="' + src + '" alt="" class="editable-img align-center" style="width:100%;border-radius:16px;"></div>';
  }

  function _bannerImg(src) {
    return function() {
      return '<section class="section-dark" style="background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url(\'' + src + '\');background-size:cover;background-position:center;">' +
        '<div class="section-inner" style="text-align:center;">' +
          '<h2 class="h2 editable" style="color:#fff;">Text or Title</h2>' +
          '<p class="lead editable" style="color:#eee;max-width:680px;margin:0 auto;">Text or Title</p>' +
        '</div></section>';
    };
  }

  function _solid(bgClass) {
    return function() {
      return '<section class="' + bgClass + '">' +
        '<div class="section-inner" style="text-align:center;">' +
          '<h2 class="h2 editable">Text or Title</h2>' +
          '<p class="lead editable" style="max-width:680px;margin:0 auto;">Text or Title</p>' +
        '</div></section>';
    };
  }

  function _imgText(imgLeft, ratio, src) {
    return function() {
      var imgCol = _imgEditable(src);
      var txtCol = '<div><h2 class="h2 editable">Text or Title</h2><p class="editable">Text or Title</p></div>';
      var cols = imgLeft ? (imgCol + txtCol) : (txtCol + imgCol);
      var gridCols = imgLeft ? (ratio + ' 1fr') : ('1fr ' + ratio);
      return '<section class="section-white">' +
        '<div class="section-inner"><div class="grid-2 builder-imgtext" style="grid-template-columns:' + gridCols + ';">' + cols + '</div></div>' +
      '</section>';
    };
  }

  function _cols(n) {
    return function() {
      var cell = '<div><h3 class="h3 editable">Text or Title</h3><p class="editable">Text or Title</p></div>';
      var cells = '';
      for (var i = 0; i < n; i++) cells += cell;
      return '<section class="section-light">' +
        '<div class="section-inner"><div class="builder-cols" style="display:grid;grid-template-columns:repeat(' + n + ',1fr);gap:24px;">' + cells + '</div></div>' +
      '</section>';
    };
  }

  function _asym(narrowLeft) {
    return function() {
      var cell = '<div><h3 class="h3 editable">Text or Title</h3><p class="editable">Text or Title</p></div>';
      var cols = narrowLeft ? '0.5fr 1fr' : '1fr 0.5fr';
      return '<section class="section-light">' +
        '<div class="section-inner"><div class="grid-2 builder-imgtext" style="grid-template-columns:' + cols + ';">' + cell + cell + '</div></div>' +
      '</section>';
    };
  }

  function _colsThumb(n) {
    var bars = '';
    for (var i = 0; i < n; i++) bars += '<div style="flex:1;background:#d8d2c4;border-radius:2px;"></div>';
    return '<div style="display:flex;gap:2px;width:100%;height:100%;padding:8px;box-sizing:border-box;">' + bars + '</div>';
  }

  function _imgTextThumb(imgLeft, small) {
    var img = '<div style="flex:' + (small ? '0.5' : '1') + ';background:#bbb;border-radius:3px;"></div>';
    var txt = '<div style="flex:1.3;background:#e7e2d6;border-radius:3px;"></div>';
    return '<div style="display:flex;gap:4px;width:100%;height:100%;padding:8px;box-sizing:border-box;">' + (imgLeft ? img + txt : txt + img) + '</div>';
  }

  var STRIP_TEMPLATES = [
    // Banner / solid
    { id: 'banner-face', label: 'באנר תמונה', category: 'banner', thumb: '<div style="width:100%;height:100%;background:linear-gradient(135deg,#444,#111);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:11px;font-weight:700;">IMG + טקסט</div>', build: _bannerImg(SAMPLE_IMAGES.face) },
    { id: 'banner-eyes', label: 'באנר תמונה 2', category: 'banner', thumb: '<div style="width:100%;height:100%;background:linear-gradient(135deg,#5a4632,#211a12);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:11px;font-weight:700;">IMG + טקסט</div>', build: _bannerImg(SAMPLE_IMAGES.eyes) },
    { id: 'solid-dark', label: 'טקסט על כהה', category: 'banner', thumb: '<div style="width:100%;height:100%;background:#1b1b1b;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">טקסט</div>', build: _solid('section-dark') },
    { id: 'solid-gold', label: 'טקסט על זהב', category: 'banner', thumb: '<div style="width:100%;height:100%;background:linear-gradient(135deg,var(--gold-light),var(--gold));display:flex;align-items:center;justify-content:center;color:#1b1b1b;font-size:11px;font-weight:700;">טקסט</div>', build: _solid('section-gold') },
    { id: 'solid-light', label: 'טקסט על בהיר', category: 'banner', thumb: '<div style="width:100%;height:100%;background:#f3f2f1;display:flex;align-items:center;justify-content:center;color:#222;font-size:11px;font-weight:700;border:1px solid #e0e0e0;">טקסט</div>', build: _solid('section-light') },
    // Image + text
    { id: 'imgtext-left-50', label: 'תמונה שמאל', category: 'imageText', thumb: _imgTextThumb(true, false), build: _imgText(true, '1fr', SAMPLE_IMAGES.product) },
    { id: 'imgtext-right-50', label: 'תמונה ימין', category: 'imageText', thumb: _imgTextThumb(false, false), build: _imgText(false, '1fr', SAMPLE_IMAGES.product) },
    { id: 'imgtext-left-30', label: 'תמונה קטנה שמאל', category: 'imageText', thumb: _imgTextThumb(true, true), build: _imgText(true, '0.5fr', SAMPLE_IMAGES.prof) },
    { id: 'imgtext-right-30', label: 'תמונה קטנה ימין', category: 'imageText', thumb: _imgTextThumb(false, true), build: _imgText(false, '0.5fr', SAMPLE_IMAGES.prof) },
    // Columns
    { id: 'cols-2', label: '2 טורים', category: 'columns', thumb: _colsThumb(2), build: _cols(2) },
    { id: 'cols-3', label: '3 טורים', category: 'columns', thumb: _colsThumb(3), build: _cols(3) },
    { id: 'cols-4', label: '4 טורים', category: 'columns', thumb: _colsThumb(4), build: _cols(4) },
    { id: 'cols-5', label: '5 טורים', category: 'columns', thumb: _colsThumb(5), build: _cols(5) },
    { id: 'cols-6', label: '6 טורים', category: 'columns', thumb: _colsThumb(6), build: _cols(6) },
    // Asymmetric
    { id: 'asym-narrow-left', label: 'צר + רחב', category: 'asymmetric', thumb: _imgTextThumb(true, true), build: _asym(true) },
    { id: 'asym-narrow-right', label: 'רחב + צר', category: 'asymmetric', thumb: _imgTextThumb(false, true), build: _asym(false) }
  ];

  // --- Dynamic strip persistence ---

  function cleanStripHtml(stripEl) {
    var clone = stripEl.cloneNode(true);
    clone.removeAttribute('data-strip-id');
    clone.removeAttribute('data-dynamic');
    clone.style.cursor = '';
    clone.style.outline = '';
    var chrome = clone.querySelectorAll('.editor-toolbar, .edt-html-wrap, .edt-img-panel, .edt-btn-panel');
    Array.prototype.forEach.call(chrome, function(n) { n.remove(); });
    Array.prototype.forEach.call(clone.querySelectorAll('[contenteditable]'), function(n) { n.removeAttribute('contenteditable'); });
    Array.prototype.forEach.call(clone.querySelectorAll('.editing'), function(n) { n.classList.remove('editing'); });
    return clone.outerHTML;
  }

  function saveDynamicStrips() {
    var val = JSON.stringify(dynamicStrips);
    var key = getDynamicStripsKey();
    try { localStorage.setItem(key, val); } catch(e) {}
    try {
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, value: val })
      }).catch(function() {});
    } catch(e) {}
  }

  function updateDynamicStrip(stripEl) {
    var id = stripEl.dataset.stripId;
    if (!id) return;
    var html = cleanStripHtml(stripEl);
    var found = false;
    for (var i = 0; i < dynamicStrips.length; i++) {
      if (dynamicStrips[i].id === id) { dynamicStrips[i].html = html; found = true; break; }
    }
    if (!found) dynamicStrips.push({ id: id, html: html });
    saveDynamicStrips();
  }

  function wireDynamicStrip(section) {
    Array.prototype.forEach.call(section.querySelectorAll('.editable'), function(el) {
      initEditable(el, null);
    });
  }

  function renderDynamicStrips() {
    var footer = document.querySelector('footer');
    dynamicStrips.forEach(function(entry) {
      if (document.querySelector('[data-strip-id="' + entry.id + '"]')) return;
      var tmp = document.createElement('div');
      tmp.innerHTML = entry.html;
      var section = tmp.querySelector('section') || tmp.firstElementChild;
      if (!section) return;
      section.dataset.stripId = entry.id;
      section.dataset.dynamic = '1';
      if (footer && footer.parentNode === document.body) {
        document.body.insertBefore(section, footer);
      } else {
        document.body.appendChild(section);
      }
      wireDynamicStrip(section);
      if (section.dataset.anim) observeStripAnim(section);
    });
  }

  function loadDynamicStrips() {
    var key = getDynamicStripsKey();
    var local = localStorage.getItem(key);
    if (local) {
      // Synchronous render; ordering is applied by the loadStripOrder call at
      // the end of init() (the strips already exist in the DOM by then).
      try { dynamicStrips = JSON.parse(local) || []; } catch(e) { dynamicStrips = []; }
      renderDynamicStrips();
      return;
    }
    // Server-only path: render async, then re-apply ordering now that the
    // dynamic strips exist (the sync loadStripOrder in init ran before this).
    fetch('/api/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: key })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data[key]) {
        try { localStorage.setItem(key, data[key]); } catch(e) {}
        try { dynamicStrips = JSON.parse(data[key]) || []; } catch(e) { dynamicStrips = []; }
        renderDynamicStrips();
        loadStripOrder();
        pruneStripOrder();
        loadStripStyles();
      }
    })
    .catch(function() {});
  }

  // Remove from strip_order any dynamic id no longer present (self-heal)
  function pruneStripOrder() {
    var key = getStripOrderKey();
    var raw = localStorage.getItem(key);
    if (!raw) return;
    var arr;
    try { arr = JSON.parse(raw); } catch(e) { return; }
    var present = {};
    getStrips().forEach(function(s) { present[s.dataset.stripId] = true; });
    // Keep ids of dynamic strips that exist in memory even if not yet rendered
    dynamicStrips.forEach(function(d) { present[d.id] = true; });
    var pruned = arr.filter(function(id) { return present[id]; });
    if (pruned.length !== arr.length) {
      var val = JSON.stringify(pruned);
      try { localStorage.setItem(key, val); } catch(e) {}
      try { fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key, value: val }) }).catch(function() {}); } catch(e) {}
    }
  }

  // --- Insertion + layout change ---

  function insertStripAtGap(template, beforeNode) {
    var tmp = document.createElement('div');
    tmp.innerHTML = template.build();
    var section = tmp.querySelector('section') || tmp.firstElementChild;
    if (!section) return;
    var id = 'dyn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    section.dataset.stripId = id;
    section.dataset.dynamic = '1';
    if (beforeNode && beforeNode.parentNode === document.body) {
      document.body.insertBefore(section, beforeNode);
    } else {
      var footer = document.querySelector('footer');
      if (footer && footer.parentNode === document.body) document.body.insertBefore(section, footer);
      else document.body.appendChild(section);
    }
    wireDynamicStrip(section);
    dynamicStrips.push({ id: id, html: cleanStripHtml(section) });
    saveDynamicStrips();
    assignStripIds();
    saveStripOrder(true);
    showSaveToast('סטריפ נוסף ✓');
    section.style.outline = '3px solid var(--gold)';
    setTimeout(function() { section.style.outline = ''; }, 1200);
  }

  function changeStripTemplate(stripEl, template) {
    var tmp = document.createElement('div');
    tmp.innerHTML = template.build();
    var fresh = tmp.querySelector('section') || tmp.firstElementChild;
    if (!fresh) return;
    stripEl.className = fresh.className;
    stripEl.setAttribute('style', fresh.getAttribute('style') || '');
    stripEl.innerHTML = fresh.innerHTML;
    wireDynamicStrip(stripEl);
    updateDynamicStrip(stripEl);
    showSaveToast('הסטריפ עודכן ✓');
  }

  // --- Per-strip design options persistence ---

  function getStripStylesKey() { return getPageKey() + 'strip_styles'; }

  function getStripStyle(id) {
    return stripStyles[id] ? JSON.parse(JSON.stringify(stripStyles[id])) : {};
  }

  function setStripStyle(id, obj) {
    var clean = {};
    Object.keys(obj || {}).forEach(function(k) {
      var v = obj[k];
      if (v !== '' && v != null && v !== 'none' && !(k === 'radius' && (v === 0 || v === '0')) &&
          !(k === 'marginTop' && (v === 0 || v === '0')) && !(k === 'minHeight' && (v === 0 || v === '0')) &&
          !(k === 'layoutWidth' && (v === 100 || v === '100')) &&
          !(k === 'contentWidth' && !v)) {
        clean[k] = v;
      }
    });
    if (Object.keys(clean).length) stripStyles[id] = clean; else delete stripStyles[id];
  }

  function saveStripStyles() {
    var val = JSON.stringify(stripStyles);
    var key = getStripStylesKey();
    try { localStorage.setItem(key, val); } catch(e) {}
    try {
      fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, value: val }) }).catch(function() {});
    } catch(e) {}
  }

  function applyAllStripStyles() {
    getStrips().forEach(function(s) {
      var d = stripStyles[s.dataset.stripId];
      if (d) applyStripStyle(s, d);
      else if (s.dataset.anim) observeStripAnim(s);
    });
  }

  function loadStripStyles() {
    var key = getStripStylesKey();
    var local = localStorage.getItem(key);
    if (local) {
      try { stripStyles = JSON.parse(local) || {}; } catch(e) { stripStyles = {}; }
      applyAllStripStyles();
      return;
    }
    fetch('/api/load', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: key }) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data[key]) {
        try { localStorage.setItem(key, data[key]); } catch(e) {}
        try { stripStyles = JSON.parse(data[key]) || {}; } catch(e) { stripStyles = {}; }
        applyAllStripStyles();
      }
    })
    .catch(function() {});
  }

  // Apply a design-options object to a strip as inline styles. backgroundColor /
  // (gradient) backgroundImage are design-only territory; we only touch the
  // banner's backgroundImage when the user explicitly sets a gradient.
  function applyStripStyle(stripEl, d) {
    d = d || {};
    var lw = d.layoutWidth || 100;
    stripEl.dataset.layoutWidth = lw;
    stripEl.style.setProperty('--lw', lw);
    var cw = d.contentWidth || '';
    if (cw === 'full') {
      stripEl.dataset.cw = 'full';
      stripEl.style.removeProperty('--cw');
    } else if (cw) {
      stripEl.dataset.cw = '1';
      stripEl.style.setProperty('--cw', cw + 'px');
    } else if (stripEl.dataset.cw) {
      stripEl.dataset.cw = '1';
      stripEl.style.removeProperty('--cw');
    }
    stripEl.style.backgroundColor = d.bg1 || '';
    if (d.bg1 && d.bg2) {
      stripEl.style.backgroundImage = 'linear-gradient(135deg,' + d.bg1 + ',' + d.bg2 + ')';
      stripEl.dataset.designGrad = '1';
    } else if (stripEl.dataset.designGrad) {
      stripEl.style.backgroundImage = '';
      delete stripEl.dataset.designGrad;
    }
    stripEl.style.color = d.textColor || '';
    if (d.radius && +d.radius > 0) { stripEl.style.borderRadius = d.radius + 'px'; stripEl.style.overflow = 'hidden'; }
    else { stripEl.style.borderRadius = ''; stripEl.style.overflow = ''; }
    stripEl.style.marginTop = (d.marginTop && +d.marginTop > 0) ? (d.marginTop + 'px') : '';
    stripEl.style.minHeight = (d.minHeight && +d.minHeight > 0) ? (d.minHeight + 'px') : '';
    if (d.anim && d.anim !== 'none') { stripEl.dataset.anim = d.anim; stripEl.classList.remove('anim-run'); }
    else { delete stripEl.dataset.anim; stripEl.classList.remove('anim-run'); }
    observeStripAnim(stripEl);
  }

  // --- Scroll-in animation ---

  function ensureAnimObserver() {
    if (animObserver || !('IntersectionObserver' in window)) return;
    animObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(en) { if (en.isIntersecting) en.target.classList.add('anim-run'); });
    }, { threshold: 0.15 });
  }

  function observeStripAnim(stripEl) {
    if (!stripEl.dataset.anim) return;
    ensureAnimObserver();
    if (animObserver) animObserver.observe(stripEl);
  }

  // --- Template picker + design options modal (tabbed) ---

  var ANIM_OPTIONS = [
    { v: 'none', label: 'ללא' },
    { v: 'fade', label: 'Fade In' },
    { v: 'fade-up', label: 'Fade In Up' },
    { v: 'fade-down', label: 'Fade In Down' },
    { v: 'fade-left', label: 'Fade In Left' },
    { v: 'fade-right', label: 'Fade In Right' },
    { v: 'zoom', label: 'Zoom In' },
    { v: 'slide-up', label: 'Slide In Up' },
    { v: 'bounce', label: 'Bounce In' }
  ];

  function buildTemplateGrid(container) {
    var cats = [
      { key: 'banner', label: 'באנר / טקסט' },
      { key: 'imageText', label: 'תמונה וטקסט' },
      { key: 'columns', label: 'טורים' },
      { key: 'asymmetric', label: 'א-סימטרי' }
    ];
    cats.forEach(function(cat) {
      var inCat = STRIP_TEMPLATES.filter(function(t) { return t.category === cat.key; });
      if (!inCat.length) return;
      var h = document.createElement('div');
      h.className = 'strip-picker-cat';
      h.textContent = cat.label;
      container.appendChild(h);
      var grid = document.createElement('div');
      grid.className = 'strip-picker-grid';
      inCat.forEach(function(t) {
        var cell = document.createElement('div');
        cell.className = 'tpl-cell';
        cell.innerHTML = '<div class="tpl-thumb">' + t.thumb + '</div><div class="tpl-label">' + t.label + '</div>';
        cell.addEventListener('click', function() {
          var ctx = pickerContext;
          if (ctx && ctx.mode === 'change' && ctx.strip) {
            changeStripTemplate(ctx.strip, t);
            closeStripPicker();
          } else {
            closeStripPicker();
            insertStripAtGap(t, ctx ? ctx.beforeNode : null);
          }
        });
        grid.appendChild(cell);
      });
      container.appendChild(grid);
    });
  }

  function _designRange(min, max, step) {
    var r = document.createElement('input');
    r.type = 'range'; r.min = min; r.max = max; r.step = step;
    return r;
  }

  function buildDesignForm(panel) {
    function field(labelText, node, valNode) {
      var f = document.createElement('div'); f.className = 'sp-field';
      var l = document.createElement('label'); l.className = 'sp-field-label'; l.textContent = labelText;
      f.appendChild(l);
      var ctl = document.createElement('div'); ctl.className = 'sp-field-ctl';
      ctl.appendChild(node);
      if (valNode) ctl.appendChild(valNode);
      f.appendChild(ctl);
      return f;
    }

    var CW_OPTIONS = [
      { v: '', label: 'ברירת מחדל (1200px)' },
      { v: 'full', label: 'פריסה מלאה (edge-to-edge)' },
      { v: '1400', label: 'רחב — 1400px' },
      { v: '1100', label: 'בינוני — 1100px' },
      { v: '960', label: 'צר — 960px' },
      { v: '720', label: 'עמוד — 720px' }
    ];
    designCtl.contentWidth = document.createElement('select');
    CW_OPTIONS.forEach(function(o) {
      var op = document.createElement('option');
      op.value = o.v;
      op.textContent = o.label;
      designCtl.contentWidth.appendChild(op);
    });
    designCtl.contentWidth.addEventListener('change', function() { setDesign('contentWidth', designCtl.contentWidth.value); });

    designCtl.bg1 = document.createElement('input'); designCtl.bg1.type = 'color';
    designCtl.bg1.addEventListener('input', function() { setDesign('bg1', designCtl.bg1.value); });
    designCtl.bg2 = document.createElement('input'); designCtl.bg2.type = 'color';
    designCtl.bg2.addEventListener('input', function() { setDesign('bg2', designCtl.bg2.value); });
    designCtl.textColor = document.createElement('input'); designCtl.textColor.type = 'color';
    designCtl.textColor.addEventListener('input', function() { setDesign('textColor', designCtl.textColor.value); });

    designCtl.anim = document.createElement('select');
    ANIM_OPTIONS.forEach(function(o) { var op = document.createElement('option'); op.value = o.v; op.textContent = o.label; designCtl.anim.appendChild(op); });
    designCtl.anim.addEventListener('change', function() { setDesign('anim', designCtl.anim.value); });

    designCtl.radius = _designRange(0, 60, 1);
    designCtl.radiusVal = document.createElement('span'); designCtl.radiusVal.className = 'sp-val';
    designCtl.radius.addEventListener('input', function() { setDesign('radius', designCtl.radius.value); });
    designCtl.marginTop = _designRange(0, 200, 1);
    designCtl.marginTopVal = document.createElement('span'); designCtl.marginTopVal.className = 'sp-val';
    designCtl.marginTop.addEventListener('input', function() { setDesign('marginTop', designCtl.marginTop.value); });
    designCtl.minHeight = _designRange(0, 800, 10);
    designCtl.minHeightVal = document.createElement('span'); designCtl.minHeightVal.className = 'sp-val';
    designCtl.minHeight.addEventListener('input', function() { setDesign('minHeight', designCtl.minHeight.value); });

    panel.appendChild(field('רוחב תוכן (Desktop)', designCtl.contentWidth));
    panel.appendChild(field('צבע רקע', designCtl.bg1));
    panel.appendChild(field('צבע רקע 2 (גרדיאנט)', designCtl.bg2));
    panel.appendChild(field('צבע טקסט', designCtl.textColor));
    panel.appendChild(field('אפקט הופעה בגלילה', designCtl.anim));
    panel.appendChild(field('פינות מעוגלות', designCtl.radius, designCtl.radiusVal));
    panel.appendChild(field('מרווח עליון', designCtl.marginTop, designCtl.marginTopVal));
    panel.appendChild(field('גובה מינימלי', designCtl.minHeight, designCtl.minHeightVal));

    var reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'sp-reset'; reset.textContent = 'נקה רקע';
    reset.addEventListener('click', function() {
      designPending.bg1 = ''; designPending.bg2 = '';
      if (designStrip) applyStripStyle(designStrip, designPending);
    });
    panel.appendChild(reset);
  }

  function populateDesignForm(d) {
    designCtl.contentWidth.value = d.contentWidth || '';
    designCtl.bg1.value = d.bg1 || '#ffffff';
    designCtl.bg2.value = d.bg2 || '#ffffff';
    designCtl.textColor.value = d.textColor || '#222222';
    designCtl.anim.value = d.anim || 'none';
    designCtl.radius.value = d.radius || 0; designCtl.radiusVal.textContent = (d.radius || 0) + 'px';
    designCtl.marginTop.value = d.marginTop || 0; designCtl.marginTopVal.textContent = (d.marginTop || 0) + 'px';
    designCtl.minHeight.value = d.minHeight || 0; designCtl.minHeightVal.textContent = (d.minHeight || 0) + 'px';
  }

  function setDesign(key, val) {
    designPending[key] = val;
    if (key === 'radius') designCtl.radiusVal.textContent = val + 'px';
    if (key === 'marginTop') designCtl.marginTopVal.textContent = val + 'px';
    if (key === 'minHeight') designCtl.minHeightVal.textContent = val + 'px';
    if (designStrip) applyStripStyle(designStrip, designPending);
  }

  function openDesignFor(strip) {
    designStrip = strip;
    designPending = getStripStyle(strip.dataset.stripId);
    designSnapshot = JSON.parse(JSON.stringify(designPending));
    populateDesignForm(designPending);
  }

  function commitDesign() {
    if (!designStrip) return;
    setStripStyle(designStrip.dataset.stripId, designPending);
    applyStripStyle(designStrip, designPending);
    saveStripStyles();
    if (designStrip.dataset.dynamic) updateDynamicStrip(designStrip);
    showSaveToast('העיצוב נשמר ✓');
  }

  function revertDesign() {
    if (!designStrip) return;
    applyStripStyle(designStrip, designSnapshot);
  }

  function showPickerTab(name) {
    var showDesign = name === 'design';
    document.getElementById('sp-panel-template').style.display = showDesign ? 'none' : '';
    document.getElementById('sp-panel-design').style.display = showDesign ? '' : 'none';
    document.getElementById('sp-footer').style.display = showDesign ? 'flex' : 'none';
    document.getElementById('sp-tab-template').classList.toggle('active', !showDesign);
    document.getElementById('sp-tab-design').classList.toggle('active', showDesign);
  }

  function buildStripPicker() {
    pickerOverlay = document.createElement('div');
    pickerOverlay.className = 'welcome-overlay';
    pickerOverlay.id = 'strip-picker-overlay';
    pickerOverlay.style.display = 'none';

    var card = document.createElement('div');
    card.className = 'welcome-card strip-picker-card';

    var close = document.createElement('button');
    close.className = 'welcome-close';
    close.innerHTML = '&times;';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', closeStripPicker);
    card.appendChild(close);

    var tabs = document.createElement('div');
    tabs.className = 'sp-tabs';
    var tabT = document.createElement('button'); tabT.className = 'sp-tab'; tabT.id = 'sp-tab-template'; tabT.textContent = 'תבנית';
    var tabD = document.createElement('button'); tabD.className = 'sp-tab'; tabD.id = 'sp-tab-design'; tabD.textContent = 'אפשרויות עיצוב';
    tabT.addEventListener('click', function() { showPickerTab('template'); });
    tabD.addEventListener('click', function() { showPickerTab('design'); });
    tabs.appendChild(tabT); tabs.appendChild(tabD);
    card.appendChild(tabs);

    var tplPanel = document.createElement('div');
    tplPanel.className = 'sp-panel'; tplPanel.id = 'sp-panel-template';
    buildTemplateGrid(tplPanel);
    card.appendChild(tplPanel);

    var designPanel = document.createElement('div');
    designPanel.className = 'sp-panel'; designPanel.id = 'sp-panel-design'; designPanel.style.display = 'none';
    buildDesignForm(designPanel);
    card.appendChild(designPanel);

    var footer = document.createElement('div');
    footer.className = 'sp-footer'; footer.id = 'sp-footer'; footer.style.display = 'none';
    var cancelBtn = document.createElement('button'); cancelBtn.className = 'sp-btn-cancel'; cancelBtn.textContent = 'ביטול';
    cancelBtn.addEventListener('click', function() { revertDesign(); closeStripPicker(); });
    var saveBtn = document.createElement('button'); saveBtn.className = 'sp-btn-save'; saveBtn.textContent = 'שמור שינויים';
    saveBtn.addEventListener('click', function() { commitDesign(); closeStripPicker(); });
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn);
    card.appendChild(footer);

    pickerOverlay.appendChild(card);
    pickerOverlay.addEventListener('click', function(e) {
      if (e.target === pickerOverlay) {
        if (pickerContext && pickerContext.mode === 'change') revertDesign();
        closeStripPicker();
      }
    });
    document.body.appendChild(pickerOverlay);
  }

  function pickerEsc(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (pickerContext && pickerContext.mode === 'change') revertDesign();
      closeStripPicker();
    }
  }

  function openStripPicker(context) {
    pickerContext = context || {};
    if (!pickerOverlay) buildStripPicker();
    var isChange = pickerContext.mode === 'change';
    var strip = pickerContext.strip;
    var dyn = strip && strip.dataset.dynamic;
    document.getElementById('sp-tab-template').style.display = (!isChange || dyn) ? '' : 'none';
    document.getElementById('sp-tab-design').style.display = isChange ? '' : 'none';
    if (isChange) {
      openDesignFor(strip);
      showPickerTab('design');
    } else {
      showPickerTab('template');
    }
    pickerOverlay.style.display = 'flex';
    document.addEventListener('keydown', pickerEsc, true);
  }

  function closeStripPicker() {
    if (!pickerOverlay) return;
    pickerOverlay.style.display = 'none';
    pickerContext = null;
    designStrip = null;
    document.removeEventListener('keydown', pickerEsc, true);
  }

  // --- Gap "+" inserter ---

  function hideGapBtn() {
    if (!gapBtn) return;
    gapBtn.style.opacity = '0';
    gapBtn.style.pointerEvents = 'none';
    gapBeforeNode = null;
  }

  function initGapInserter() {
    gapBtn = document.createElement('button');
    gapBtn.id = 'strip-gap-add-btn';
    gapBtn.innerHTML = '+';
    gapBtn.title = 'הוסף סטריפ כאן';
    gapBtn.style.cssText = 'position:absolute;z-index:1000;width:40px;height:40px;border-radius:50%;background:var(--gold);color:#1b1b1b;border:none;font-size:26px;font-weight:700;line-height:1;cursor:pointer;opacity:0;transition:opacity 0.15s,transform 0.15s;pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(gapBtn);

    gapBtn.addEventListener('mouseenter', function() { gapBtn.style.transform = 'translateX(-50%) scale(1.15)'; });
    gapBtn.addEventListener('mouseleave', function() { gapBtn.style.transform = 'translateX(-50%)'; });
    gapBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openStripPicker({ mode: 'add', beforeNode: gapBeforeNode });
    });

    document.addEventListener('mousemove', function(e) {
      if (reorderMode || !editMode) { hideGapBtn(); return; }
      if (e.target.closest('#strip-gap-add-btn') || e.target.closest('#strip-picker-overlay') ||
          e.target.closest('#strip-menu') || e.target.closest('#strip-settings-btn')) return;
      var strips = getStrips();
      var threshold = 36;
      var gapFound = false, bn = null, edgeY = 0;
      for (var i = 0; i < strips.length; i++) {
        var r = strips[i].getBoundingClientRect();
        if (Math.abs(e.clientY - r.top) < threshold && e.clientX > r.left && e.clientX < r.right) {
          gapFound = true; bn = strips[i]; edgeY = r.top + window.scrollY; break;
        }
      }
      if (!gapFound && strips.length) {
        var last = strips[strips.length - 1];
        var lr = last.getBoundingClientRect();
        if (Math.abs(e.clientY - lr.bottom) < threshold && e.clientX > lr.left && e.clientX < lr.right) {
          gapFound = true; bn = null; edgeY = lr.bottom + window.scrollY;
        }
      }
      if (gapFound) {
        gapBeforeNode = bn;
        gapBtn.style.top = (edgeY - 20) + 'px';
        gapBtn.style.left = '50%';
        gapBtn.style.transform = 'translateX(-50%)';
        gapBtn.style.opacity = '1';
        gapBtn.style.pointerEvents = 'auto';
      } else {
        hideGapBtn();
      }
    });
  }

  function initStripManager() {
    // Settings button
    stripBtn = document.createElement('button');
    stripBtn.id = 'strip-settings-btn';
    stripBtn.textContent = 'הגדרות';
    stripBtn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:1000;background:#333;color:#fff;border:none;border-radius:6px;padding:6px 16px;font-size:13px;font-weight:700;cursor:pointer;opacity:0;transition:opacity 0.2s;pointer-events:none;font-family:inherit;direction:rtl;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    document.body.appendChild(stripBtn);

    // Dropdown menu
    stripMenu = document.createElement('div');
    stripMenu.id = 'strip-menu';
    stripMenu.style.cssText = 'position:absolute;z-index:1001;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.18);min-width:160px;display:none;overflow:hidden;direction:rtl;';
    var items = [
      { label: 'מאפיינים', icon: '⚙️', action: 'properties' },
      { label: 'שכפול', icon: '📋', action: 'duplicate' },
      { label: 'מחיקה', icon: '🗑', action: 'delete' },
      { label: 'שנה מיקום', icon: '↕️', action: 'reorder' }
    ];
    items.forEach(function(item) {
      var row = document.createElement('div');
      row.dataset.action = item.action;
      row.style.cssText = 'padding:10px 16px;cursor:pointer;font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;transition:background 0.15s;color:#222;';
      row.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
      row.addEventListener('mouseenter', function() { row.style.background = '#f5f0e6'; });
      row.addEventListener('mouseleave', function() { row.style.background = ''; });
      row.addEventListener('click', function(e) {
        e.stopPropagation();
        handleStripAction(item.action);
      });
      stripMenu.appendChild(row);
    });
    document.body.appendChild(stripMenu);

    // Hover detection on strips
    document.addEventListener('mousemove', function(e) {
      if (reorderMode) return;
      var el = e.target.closest(stripSelector);
      if (el && !el.closest('.nav') && !el.closest('.footer') && !el.closest('.demo-banner')) {
        if (activeStrip !== el) {
          activeStrip = el;
          positionStripBtn();
        }
      } else if (!e.target.closest('#strip-settings-btn') && !e.target.closest('#strip-menu')) {
        activeStrip = null;
        stripBtn.style.opacity = '0';
        stripBtn.style.pointerEvents = 'none';
        stripMenu.style.display = 'none';
      }
    });

    stripBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (stripMenu.style.display === 'none') {
        // "מאפיינים" shows for ALL strips: originals use it for design options
        // (bg / animation / radius); layout-change is gated to dynamic strips
        // via the template tab inside openStripPicker, not by hiding this row.
        var propsRow = stripMenu.querySelector('[data-action="properties"]');
        if (propsRow) propsRow.style.display = 'flex';
        var r = stripBtn.getBoundingClientRect();
        stripMenu.style.top = (r.bottom + window.scrollY + 4) + 'px';
        stripMenu.style.left = (r.left) + 'px';
        stripMenu.style.right = 'auto';
        stripMenu.style.display = '';
      } else {
        stripMenu.style.display = 'none';
      }
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('#strip-menu') && !e.target.closest('#strip-settings-btn')) {
        stripMenu.style.display = 'none';
      }
    });
  }

  function positionStripBtn() {
    if (!activeStrip) return;
    var r = activeStrip.getBoundingClientRect();
    stripBtn.style.top = (r.top + window.scrollY + 8) + 'px';
    // Position at end of first third from right: ~67% from left
    stripBtn.style.left = (Math.round(window.innerWidth * 0.67)) + 'px';
    stripBtn.style.right = 'auto';
    stripBtn.style.opacity = '1';
    stripBtn.style.pointerEvents = 'auto';
  }

  function handleStripAction(action) {
    stripMenu.style.display = 'none';
    if (!activeStrip) return;

    if (action === 'duplicate') {
      var isDyn = activeStrip.dataset.dynamic;
      var clone = activeStrip.cloneNode(true);
      var newId;
      if (isDyn) {
        newId = 'dyn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        clone.dataset.stripId = newId;
        clone.dataset.dynamic = '1';
      } else {
        clone.dataset.stripId = 'sid_dup_' + Date.now();
      }
      activeStrip.parentNode.insertBefore(clone, activeStrip.nextSibling);
      if (isDyn) {
        wireDynamicStrip(clone);
        dynamicStrips.push({ id: newId, html: cleanStripHtml(clone) });
        saveDynamicStrips();
        assignStripIds();
        saveStripOrder(true);
      }
      clone.style.outline = '3px solid var(--gold)';
      setTimeout(function() { clone.style.outline = ''; }, 1500);
      showSaveToast();
    }

    if (action === 'delete') {
      if (confirm('למחוק את הסטריפ הזה?')) {
        var wasDyn = activeStrip.dataset.dynamic;
        var delId = activeStrip.dataset.stripId;
        activeStrip.remove();
        activeStrip = null;
        stripBtn.style.opacity = '0';
        stripBtn.style.pointerEvents = 'none';
        if (wasDyn) {
          dynamicStrips = dynamicStrips.filter(function(d) { return d.id !== delId; });
          saveDynamicStrips();
          saveStripOrder(true);
          showSaveToast('הסטריפ נמחק');
        }
      }
    }

    if (action === 'properties') {
      if (activeStrip) openStripPicker({ mode: 'change', strip: activeStrip });
    }

    if (action === 'reorder') {
      enterReorderMode();
    }
  }

  function enterReorderMode() {
    reorderMode = true;
    document.body.classList.add('reordering');
    stripBtn.style.opacity = '0';
    stripBtn.style.pointerEvents = 'none';
    if (stripMenu) stripMenu.style.display = 'none';

    // Snapshot the original order with stable anchor markers, so Cancel can
    // restore the exact starting layout from before any drag.
    var strips = getStrips();
    reorderSnapshot = strips.map(function(s) {
      var marker = document.createComment('reorder-anchor');
      s.parentNode.insertBefore(marker, s);
      return { el: s, marker: marker };
    });

    // Shrink page 40% and pin left — easing applied to both transform & width
    document.body.style.transition = 'transform 0.4s ' + REORDER_EASE + ', width 0.4s ' + REORDER_EASE;
    document.body.style.transformOrigin = 'top left';
    document.body.style.display = 'inline-block';
    document.body.style.width = '100%';
    document.body.style.transform = 'scale(1)';
    // Commit the start state before animating to the shrunk state
    void document.body.offsetWidth;
    document.body.style.transform = 'scale(' + REORDER_SCALE + ')';
    document.body.style.width = '60%';

    // Control panel — appended to <html>, NOT <body>, so it escapes the
    // body's transform and stays full-size in the empty right area.
    var panel = document.createElement('div');
    panel.id = 'reorder-panel';
    panel.style.cssText = 'position:fixed;top:32px;right:32px;z-index:100000;width:300px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);padding:24px;direction:rtl;text-align:center;font-family:inherit;';
    panel.innerHTML =
      '<div style="font-size:20px;font-weight:800;color:#222;margin-bottom:8px;">שינוי מיקום</div>' +
      '<div style="font-size:14px;color:#666;line-height:1.5;margin-bottom:20px;">↕️ גרור סטריפים מצד שמאל כדי לשנות את הסדר</div>';

    var saveBtn = document.createElement('button');
    saveBtn.id = 'reorder-save-btn';
    saveBtn.textContent = 'שמור';
    saveBtn.style.cssText = 'width:100%;background:#ff4757;color:#fff;border:none;border-radius:10px;padding:14px;font-size:17px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(255,71,87,0.3);transition:transform 0.2s,box-shadow 0.2s;font-family:inherit;';
    saveBtn.addEventListener('mouseenter', function() { saveBtn.style.transform = 'scale(1.03)'; saveBtn.style.boxShadow = '0 6px 24px rgba(255,71,87,0.4)'; });
    saveBtn.addEventListener('mouseleave', function() { saveBtn.style.transform = ''; saveBtn.style.boxShadow = '0 4px 16px rgba(255,71,87,0.3)'; });
    saveBtn.addEventListener('click', function() { saveStripOrder(); exitReorderMode(true); });
    panel.appendChild(saveBtn);

    var cancelBtn = document.createElement('button');
    cancelBtn.id = 'reorder-cancel-btn';
    cancelBtn.textContent = 'ביטול (Esc)';
    cancelBtn.style.cssText = 'width:100%;background:#f1f1f1;color:#555;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;margin-top:10px;transition:background 0.2s;font-family:inherit;';
    cancelBtn.addEventListener('mouseenter', function() { cancelBtn.style.background = '#e4e4e4'; });
    cancelBtn.addEventListener('mouseleave', function() { cancelBtn.style.background = '#f1f1f1'; });
    cancelBtn.addEventListener('click', function() { exitReorderMode(false); });
    panel.appendChild(cancelBtn);

    document.documentElement.appendChild(panel);

    // Mark strips
    strips.forEach(function(s) {
      s.style.cursor = 'move';
      s.style.outline = '2px dashed rgba(219,189,133,0.5)';
      s.style.transition = 'outline 0.2s, opacity 0.2s';
      s.setAttribute('draggable', 'false');

      s.addEventListener('mousedown', stripDragStart);
    });

    document.addEventListener('keydown', reorderEsc);
  }

  function reorderEsc(e) {
    if (e.key === 'Escape') exitReorderMode(false);
  }

  // Put each strip back immediately after its anchor marker, restoring the
  // exact order from before reorder mode was entered.
  function restoreReorderSnapshot() {
    if (!reorderSnapshot) return;
    reorderSnapshot.forEach(function(item) {
      if (item.marker.parentNode) {
        item.marker.parentNode.insertBefore(item.el, item.marker.nextSibling);
      }
    });
  }

  function clearReorderMarkers() {
    if (!reorderSnapshot) return;
    reorderSnapshot.forEach(function(item) {
      if (item.marker.parentNode) item.marker.parentNode.removeChild(item.marker);
    });
    reorderSnapshot = null;
  }

  function exitReorderMode(keepOrder) {
    reorderMode = false;
    document.body.classList.remove('reordering');

    // If a strip is still floating mid-drag, drop it back into the flow first
    if (dragStrip) stripDragEnd();

    // Cancel restores the original order; Save keeps the new one.
    if (keepOrder) {
      clearReorderMarkers();
    } else {
      restoreReorderSnapshot();
      clearReorderMarkers();
    }

    var strips = getStrips();
    strips.forEach(function(s) {
      s.style.cursor = '';
      s.style.outline = '';
      s.style.position = '';
      s.style.top = '';
      s.style.left = '';
      s.style.width = '';
      s.style.margin = '';
      s.style.transform = '';
      s.style.transformOrigin = '';
      s.style.zIndex = '';
      s.style.opacity = '';
      s.style.boxShadow = '';
      s.style.pointerEvents = '';
      s.removeEventListener('mousedown', stripDragStart);
    });
    if (dragPlaceholder && dragPlaceholder.parentNode) dragPlaceholder.remove();
    dragPlaceholder = null;
    dragStrip = null;

    // Grow back with the same easing (animate to concrete values, not auto)
    document.body.style.transition = 'transform 0.4s ' + REORDER_EASE + ', width 0.4s ' + REORDER_EASE;
    document.body.style.transform = 'scale(1)';
    document.body.style.width = '100%';
    // display can't transition — restore everything after the grow completes
    setTimeout(function() {
      if (!reorderMode) {
        document.body.style.display = '';
        document.body.style.width = '';
        document.body.style.transform = '';
        document.body.style.transformOrigin = '';
        document.body.style.transition = '';
      }
    }, 420);

    var panel = document.getElementById('reorder-panel');
    if (panel) panel.remove();

    document.removeEventListener('keydown', reorderEsc);
  }

  function stripDragStart(e) {
    if (!reorderMode) return;
    e.preventDefault();
    dragStrip = this;
    var rect = dragStrip.getBoundingClientRect(); // viewport coords (already scaled)
    dragOffsetY = e.clientY - rect.top;

    // Placeholder stays in the scaled <body>; its height is in body coords so
    // it visually occupies the same slot the strip did (height / scale → *scale).
    dragPlaceholder = document.createElement('div');
    dragPlaceholder.className = 'reorder-placeholder';
    dragPlaceholder.style.cssText = 'height:' + (rect.height / REORDER_SCALE) + 'px;background:repeating-linear-gradient(45deg,rgba(219,189,133,0.12),rgba(219,189,133,0.12) 12px,rgba(219,189,133,0.22) 12px,rgba(219,189,133,0.22) 24px);border:3px dashed var(--gold);border-radius:10px;margin:0;box-shadow:inset 0 0 24px rgba(219,189,133,0.25);transition:height 0.18s ease;';
    dragStrip.parentNode.insertBefore(dragPlaceholder, dragStrip);

    // Float the strip on <html> (NOT body) so it escapes the body transform.
    // Coords are pure viewport; the strip carries its own scale to match the
    // surrounding shrunk page. This avoids any scroll/transform offset jumps.
    dragStrip.style.position = 'fixed';
    dragStrip.style.top = rect.top + 'px';
    dragStrip.style.left = rect.left + 'px';
    dragStrip.style.width = (rect.width / REORDER_SCALE) + 'px';
    dragStrip.style.margin = '0';
    dragStrip.style.transform = 'scale(' + REORDER_SCALE + ')';
    dragStrip.style.transformOrigin = 'top left';
    dragStrip.style.zIndex = '99999';
    dragStrip.style.opacity = '0.55';
    dragStrip.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)';
    dragStrip.style.pointerEvents = 'none';
    dragStrip.style.outline = '2px solid var(--gold)';
    document.documentElement.appendChild(dragStrip);

    document.addEventListener('mousemove', stripDragMove);
    document.addEventListener('mouseup', stripDragEnd);
  }

  function stripDragMove(e) {
    if (!dragStrip) return;
    // Pure viewport positioning — strip lives on <html>, no transform context
    dragStrip.style.top = (e.clientY - dragOffsetY) + 'px';

    // Find nearest strip to the cursor (rects are viewport coords, e.clientY too)
    var strips = getStrips().filter(function(s) { return s !== dragStrip; });
    var closest = null;
    var closestDist = Infinity;
    strips.forEach(function(s) {
      var r = s.getBoundingClientRect();
      var mid = r.top + r.height / 2;
      var dist = Math.abs(e.clientY - mid);
      if (dist < closestDist) {
        closestDist = dist;
        closest = s;
      }
    });

    if (closest && dragPlaceholder) {
      var r = closest.getBoundingClientRect();
      var mid = r.top + r.height / 2;
      if (e.clientY < mid) {
        closest.parentNode.insertBefore(dragPlaceholder, closest);
      } else {
        closest.parentNode.insertBefore(dragPlaceholder, closest.nextSibling);
      }
    }
  }

  function stripDragEnd() {
    if (!dragStrip) return;
    document.removeEventListener('mousemove', stripDragMove);
    document.removeEventListener('mouseup', stripDragEnd);

    // Strip off the floating styles
    dragStrip.style.position = '';
    dragStrip.style.top = '';
    dragStrip.style.left = '';
    dragStrip.style.width = '';
    dragStrip.style.margin = '';
    dragStrip.style.transform = '';
    dragStrip.style.transformOrigin = '';
    dragStrip.style.zIndex = '';
    dragStrip.style.opacity = '';
    dragStrip.style.boxShadow = '';
    dragStrip.style.pointerEvents = '';
    dragStrip.style.outline = '2px dashed rgba(219,189,133,0.5)';

    // Move it back into the page flow (into <body>) at the placeholder slot
    if (dragPlaceholder && dragPlaceholder.parentNode) {
      dragPlaceholder.parentNode.insertBefore(dragStrip, dragPlaceholder);
      dragPlaceholder.remove();
    }

    dragPlaceholder = null;
    dragStrip = null;
  }

  // === BUTTON RESIZER ===

  var btnPanel = null;
  var activeBtn = null;
  var btnWSlider, btnHSlider, btnWVal, btnHVal;

  function getButtons() {
    return Array.from(document.querySelectorAll('.btn')).filter(function(b) {
      return !b.closest('.nav') && !b.closest('.demo-banner') && !b.closest('.footer') &&
        !b.closest('[data-dynamic]') &&
        b.id !== 'btn-mode' && b.id !== 'btn-undo' && b.id !== 'btn-redo';
    });
  }

  function buttonStorageKey() {
    return getPageKey() + 'buttons';
  }

  function createButtonPanel() {
    btnPanel = document.createElement('div');
    btnPanel.className = 'edt-btn-panel';
    btnPanel.style.cssText = 'position:absolute;z-index:10003;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.18);padding:12px;width:250px;display:none;direction:ltr;font-family:inherit;';
    btnPanel.addEventListener('mousedown', function(e) {
      if (e.target.tagName !== 'INPUT') e.preventDefault();
    });
    btnPanel.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
        '<span style="font-size:12px;font-weight:700;color:#333;min-width:46px;">Width</span>' +
        '<input type="range" class="btn-w-slider" min="80" max="640" step="2" style="flex:1;">' +
        '<span class="btn-w-val" style="font-size:12px;color:var(--gold);font-weight:700;min-width:46px;text-align:right;">auto</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
        '<span style="font-size:12px;font-weight:700;color:#333;min-width:46px;">Height</span>' +
        '<input type="range" class="btn-h-slider" min="32" max="120" step="2" style="flex:1;">' +
        '<span class="btn-h-val" style="font-size:12px;color:var(--gold);font-weight:700;min-width:46px;text-align:right;">auto</span>' +
      '</div>' +
      '<div style="display:flex;gap:6px;">' +
        '<button class="btn-size-reset edt-tb-btn" style="flex:1;width:auto;font-size:12px;font-weight:700;">Reset</button>' +
        '<button class="btn-size-done edt-tb-btn" style="flex:1;width:auto;font-size:12px;font-weight:700;background:#2ed573;color:#fff;">Done</button>' +
      '</div>';
    document.body.appendChild(btnPanel);

    btnWSlider = btnPanel.querySelector('.btn-w-slider');
    btnHSlider = btnPanel.querySelector('.btn-h-slider');
    btnWVal = btnPanel.querySelector('.btn-w-val');
    btnHVal = btnPanel.querySelector('.btn-h-val');

    btnWSlider.addEventListener('input', function() {
      if (!activeBtn) return;
      activeBtn.style.width = btnWSlider.value + 'px';
      activeBtn.style.justifyContent = 'center';
      btnWVal.textContent = btnWSlider.value + 'px';
    });
    btnHSlider.addEventListener('input', function() {
      if (!activeBtn) return;
      activeBtn.style.height = btnHSlider.value + 'px';
      btnHVal.textContent = btnHSlider.value + 'px';
    });

    btnPanel.querySelector('.btn-size-reset').addEventListener('click', function() {
      if (!activeBtn) return;
      activeBtn.style.width = '';
      activeBtn.style.height = '';
      activeBtn.style.justifyContent = '';
      var r = activeBtn.getBoundingClientRect();
      btnWSlider.value = Math.round(r.width);
      btnHSlider.value = Math.round(r.height);
      btnWVal.textContent = 'auto';
      btnHVal.textContent = 'auto';
      saveButtonSizes();
    });
    btnPanel.querySelector('.btn-size-done').addEventListener('click', function() {
      saveButtonSizes();
      hideButtonPanel();
    });
  }

  function showButtonPanel(btn) {
    activeBtn = btn;
    var rect = btn.getBoundingClientRect();
    btnPanel.style.display = '';
    btnPanel.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    btnPanel.style.left = (rect.left + window.scrollX) + 'px';

    var w = btn.style.width;
    var h = btn.style.height;
    btnWSlider.value = w ? parseInt(w) : Math.round(rect.width);
    btnHSlider.value = h ? parseInt(h) : Math.round(rect.height);
    btnWVal.textContent = w ? parseInt(w) + 'px' : 'auto';
    btnHVal.textContent = h ? parseInt(h) + 'px' : 'auto';

    btn.style.outline = '2px solid var(--gold)';
    btn.style.outlineOffset = '2px';
  }

  function hideButtonPanel() {
    btnPanel.style.display = 'none';
    if (activeBtn) {
      activeBtn.style.outline = '';
      activeBtn.style.outlineOffset = '';
      activeBtn = null;
    }
  }

  function saveButtonSizes() {
    var buttons = getButtons();
    var data = {};
    buttons.forEach(function(b, i) {
      if (b.style.width || b.style.height) {
        data[i] = { w: b.style.width || '', h: b.style.height || '' };
      }
    });
    var key = buttonStorageKey();
    var val = JSON.stringify(data);
    try { localStorage.setItem(key, val); } catch(e) {}
    try {
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, value: val })
      }).then(function(r) { if (r.ok) showSaveToast(); }).catch(function() {});
    } catch(e) {}
  }

  function applyButtonSizes() {
    var key = buttonStorageKey();
    function apply(raw) {
      if (!raw) return;
      var data;
      try { data = JSON.parse(raw); } catch(e) { return; }
      var buttons = getButtons();
      Object.keys(data).forEach(function(i) {
        var b = buttons[i];
        if (!b) return;
        if (data[i].w) { b.style.width = data[i].w; b.style.justifyContent = 'center'; }
        if (data[i].h) b.style.height = data[i].h;
      });
    }
    var local = localStorage.getItem(key);
    if (local) { apply(local); return; }
    fetch('/api/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: key })
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d && d[key]) {
        try { localStorage.setItem(key, d[key]); } catch(e) {}
        apply(d[key]);
      }
    }).catch(function() {});
  }

  function initButtonResizer() {
    createButtonPanel();
    applyButtonSizes();
    getButtons().forEach(function(b) {
      b.addEventListener('click', function(e) {
        if (reorderMode) return;
        if (!editMode) return;
        e.preventDefault();
        e.stopPropagation();
        if (activeBtn === b) return;
        if (activeBtn) hideButtonPanel();
        showButtonPanel(b);
      });
    });
    document.addEventListener('click', function(e) {
      if (!activeBtn) return;
      if (btnPanel.contains(e.target)) return;
      if (e.target.closest('.btn') === activeBtn) return;
      hideButtonPanel();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
