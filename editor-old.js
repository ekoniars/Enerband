(function() {
  'use strict';

  // --- STATE ---
  let currentEl = null;
  let currentKey = null;
  let pendingImages = [];
  let imgToolbar = null;
  let imgWidget = null;

  // --- UTILS ---

  function getPageKey() {
    const path = window.location.pathname;
    const name = path.split('/').pop().replace('.html', '') || 'index';
    return 'enerband_' + name + '_';
  }

  function textToHtml(text) {
    // תיקון שורות ריקות: ללא filter! רק המר \n ל-<br>
    return text.split('\n').join('<br>');
  }

  function htmlToEditableText(html) {
    // המר HTML חזרה לtext עריך: <br> → \n, הסר img tags
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<img[^>]*>/gi, '')
      .trim();
  }

  // --- STORAGE ---

  function saveContent(key, text, images) {
    const data = { text, images };
    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log('✅ Saved:', key);
    } catch(e) {
      console.warn('Storage full:', e);
    }
  }

  function loadContent(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return data;
    } catch(e) {
      // Legacy: plain string (back-compat)
      return { text: raw, images: [] };
    }
  }

  // --- IMAGE BUILDING ---

  function buildImgTag(img) {
    return `<img src="${img.src}" class="editable-img align-${img.align}" style="width:${img.size}%" alt="">`;
  }

  function buildFullHtml(text, images) {
    const imgsHtml = images.map(buildImgTag).join('');
    const textHtml = textToHtml(text);
    return imgsHtml + textHtml;
  }

  function loadSavedContent(el, key) {
    const data = loadContent(key);
    if (!data) return;
    el.innerHTML = buildFullHtml(data.text, data.images || []);
  }

  // --- TOOLBAR & WIDGET ---

  function createToolbarSingleton() {
    console.log('🛠️ Creating toolbar singleton...');
    // Image toolbar
    imgToolbar = document.createElement('div');
    imgToolbar.className = 'editor-img-toolbar hidden';
    imgToolbar.innerHTML = `
      <span style="font-size:13px; font-weight:700; color:var(--gold); margin-right:8px; letter-spacing:1px;">🖼️ ADD IMAGE:</span>
      <button class="edt-btn" data-action="upload">📁 Upload</button>
      <button class="edt-btn" data-action="url">🔗 URL</button>
      <input type="file" class="edt-file-input" accept="image/*" style="display:none">
    `;
    document.body.appendChild(imgToolbar);
    console.log('✅ Toolbar created and added to DOM');

    // Image widget
    imgWidget = document.createElement('div');
    imgWidget.className = 'editor-img-widget';
    imgWidget.innerHTML = `
      <h3 style="margin:0 0 12px 0; font-size:14px; font-weight:700; color:var(--black);">📸 Image Settings</h3>
      <img class="edt-preview" src="" alt="">
      <label style="font-size:13px; font-weight:700; display:block; margin-top:12px; margin-bottom:6px; color:var(--black);">
        Size: <span class="edt-size-val" style="color:var(--gold);">100%</span>
      </label>
      <input type="range" class="edt-size-slider" min="10" max="100" value="100">
      <div style="font-size:13px; font-weight:700; margin:12px 0 8px; color:var(--black);">Position:</div>
      <div class="edt-align-group">
        <button class="edt-align-btn active" data-align="left">← Left</button>
        <button class="edt-align-btn" data-align="center">Center</button>
        <button class="edt-align-btn" data-align="right">Right →</button>
      </div>
      <button class="edt-insert-btn" id="edt-insert-btn-main">✓ Insert Image</button>
      <button class="edt-cancel-img-btn" id="edt-cancel-img-btn-main">✕ Cancel</button>
    `;
    document.body.appendChild(imgWidget);

    wireToolbarEvents();
  }

  function wireToolbarEvents() {
    const uploadBtn = imgToolbar.querySelector('[data-action="upload"]');
    const urlBtn = imgToolbar.querySelector('[data-action="url"]');
    const fileInput = imgToolbar.querySelector('.edt-file-input');

    // מנע blur כשלוחצים על הtoolbar - אבל תן לclick events להיעבור
    imgToolbar.addEventListener('mousedown', (e) => {
      // אל תעצור את ה-event, רק הודע שלא צריך לשמור
    });
    // setTimeout כדי להוודא שה-DOM נטען לחלוטין
    setTimeout(() => {
      const slider = imgWidget.querySelector('.edt-size-slider');
      const sizeVal = imgWidget.querySelector('.edt-size-val');
      const alignBtns = imgWidget.querySelectorAll('.edt-align-btn');
      const insertBtn = imgWidget.querySelector('.edt-insert-btn');
      const cancelImgBtn = imgWidget.querySelector('.edt-cancel-img-btn');
      const preview = imgWidget.querySelector('.edt-preview');

      // בדוק שכל הenements קיימים
      console.log('🔍 Widget elements found:', {
        insertBtn: !!insertBtn,
        cancelImgBtn: !!cancelImgBtn,
        preview: !!preview,
        slider: !!slider,
        alignBtns: alignBtns.length
      });

      if (!insertBtn) {
        console.error('❌ INSERT BUTTON NOT FOUND! HTML:', imgWidget.innerHTML.substring(0, 200));
        return;
      }

      // בדוק שבverify עם ID גם
      const byId = document.getElementById('edt-insert-btn-main');
      console.log('📍 Insert btn by ID:', !!byId);
      console.log('📍 Insert btn by class:', !!insertBtn);
      console.log('📍 Are they the same?', insertBtn === byId);

    let pendingSrc = '';
    let pendingAlign = 'left';
    let pendingSize = 100;

    uploadBtn.addEventListener('click', (e) => {
      console.log('📁 Upload button clicked');
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      console.log('📂 File selected:', e.target.files[0]?.name);
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        pendingSrc = ev.target.result;
        console.log('✅ File loaded as data-URI, length:', pendingSrc.length);
        showWidget(pendingSrc);
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });

    urlBtn.addEventListener('click', () => {
      const url = prompt('הכנס URL של תמונה:');
      if (url && url.trim()) {
        pendingSrc = url.trim();
        console.log('🔗 URL entered:', url);
        showWidget(pendingSrc);
      }
    });

    slider.addEventListener('input', () => {
      pendingSize = slider.value;
      sizeVal.textContent = pendingSize + '%';
      preview.style.width = pendingSize + '%';
    });

    // אל תעצור את ה-click events בwidget

    alignBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        alignBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        pendingAlign = btn.dataset.align;
        console.log('📍 Alignment:', pendingAlign);
      });
    });

    insertBtn.addEventListener('click', (e) => {
      console.log('🖱️ Insert button clicked!');
      console.log('pendingSrc:', pendingSrc ? pendingSrc.substring(0, 50) : 'EMPTY');
      console.log('pendingSize:', pendingSize);
      console.log('pendingAlign:', pendingAlign);

      if (!pendingSrc) {
        console.warn('⚠️ No image source selected!');
        return;
      }

      pendingImages.push({ src: pendingSrc, size: pendingSize, align: pendingAlign });
      console.log('➕ Image added. Total images:', pendingImages.length);
      hideWidget();

      // חזור לfocus בtextarea
      if (currentEl && currentEl.querySelector('textarea')) {
        console.log('✓ Focusing back to textarea');
        currentEl.querySelector('textarea').focus();
      }
    });

    cancelImgBtn.addEventListener('click', () => {
      console.log('❌ Image cancelled');
      hideWidget();
    });

    function showWidget(src) {
      preview.src = src;
      preview.style.width = '100%';
      slider.value = 100;
      sizeVal.textContent = '100%';
      pendingSize = 100;
      alignBtns.forEach((b, i) => b.classList.toggle('active', i === 0));
      pendingAlign = 'left';

      // Position near toolbar
      const tRect = imgToolbar.getBoundingClientRect();
      imgWidget.style.top = (tRect.bottom + 8 + window.scrollY) + 'px';
      imgWidget.style.left = tRect.left + 'px';
      imgWidget.style.display = 'block';
    }

    function hideWidget() {
      imgWidget.style.display = 'none';
      pendingSrc = '';
    }
  }

  function positionToolbar(el) {
    const rect = el.getBoundingClientRect();
    imgToolbar.style.top = (rect.top - 50 + window.scrollY) + 'px';
    imgToolbar.style.left = (rect.left + 10) + 'px';
    imgToolbar.classList.remove('hidden');
    console.log('🖼️ Toolbar positioned at:', rect.top, rect.left);
  }

  function hideToolbar() {
    imgToolbar.classList.add('hidden');
    imgWidget.style.display = 'none';
  }

  // --- COPY TOOLTIP ---

  function showCopyTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'copy-tooltip';
    tooltip.textContent = '✓ Copied to clipboard!';
    document.body.appendChild(tooltip);
    setTimeout(() => tooltip.remove(), 2000);
  }

  // --- EDITABLE INIT ---

  function initEditable(el, key) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      if (this.classList.contains('editing')) return;

      currentEl = this;
      currentKey = key;
      pendingImages = [];

      this.classList.add('editing');
      const originalHTML = this.innerHTML;
      const editableText = htmlToEditableText(this.innerHTML);

      const textarea = document.createElement('textarea');
      textarea.value = editableText;
      textarea.style.cssText = [
        'width:100%',
        'min-height:80px',
        'padding:8px',
        'font-family:inherit',
        'font-size:inherit',
        'font-weight:inherit',
        'border:2px solid var(--gold)',
        'border-radius:4px',
        'line-height:inherit',
        'resize:vertical',
        'background:rgba(255,255,255,0.95)',
        'color:#222',
        'box-sizing:border-box'
      ].join(';');

      this.innerHTML = '';
      this.appendChild(textarea);
      textarea.focus();
      textarea.select();

      console.log('🎯 Editing element:', key);
      positionToolbar(this);

      const save = () => {
        const newText = textarea.value;
        const fullHtml = buildFullHtml(newText, pendingImages);
        this.innerHTML = fullHtml;
        this.classList.remove('editing');
        saveContent(key, newText, pendingImages);
        hideToolbar();
        currentEl = null;
        pendingImages = [];
      };

      const cancel = () => {
        this.innerHTML = originalHTML;
        this.classList.remove('editing');
        hideToolbar();
        currentEl = null;
        pendingImages = [];
      };

      textarea.addEventListener('blur', (e) => {
        // אל תשמור אם הclick היה על toolbar או widget
        const isToolbar = imgToolbar.contains(e.relatedTarget);
        const isWidget = imgWidget.contains(e.relatedTarget);

        if (isToolbar || isWidget) {
          console.log('🛑 Not saving - focus moved to toolbar/widget');
          // חזור לfocus בtextarea אחרי קצת זמן
          setTimeout(() => textarea.focus(), 10);
          return;
        }
        console.log('💾 Auto-saving on blur');
        save();
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          console.log('💾 Ctrl+Enter pressed - saving');
          e.preventDefault();
          save();
        }
        if (e.key === 'Escape') {
          console.log('❌ Escape pressed - cancelling');
          cancel();
        }
      });
    });

    el.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      if (this.classList.contains('editing')) return;
      navigator.clipboard.writeText(this.innerText).then(() => {
        showCopyTooltip();
      });
    });
  }

  // --- MAIN INIT ---

  function init() {
    console.log('⚙️ Initializing Enerband Editor...');
    const prefix = getPageKey();
    console.log('📄 Page key:', prefix);
    createToolbarSingleton();

    const editables = document.querySelectorAll('.editable');
    console.log('🎯 Found', editables.length, 'editable elements');

    editables.forEach((el, index) => {
      const key = prefix + index;
      loadSavedContent(el, key);
      initEditable(el, key);
    });

    console.log('✅ Enerband Editor ready. Click to edit, Ctrl+Enter to save, Dbl-click to copy.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
