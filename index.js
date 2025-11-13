/* ===== RP Social Post — index.js ===== */
(() => {
  if (typeof window === 'undefined') {
    global.window = {};
  }
  if (window.RP_POST_EXT_LOADED) return;
  window.RP_POST_EXT_LOADED = true;

  const MODULE = 'rpPostExt';
  const DEFAULTS = {
    maxMessages: 16,
    autoGenerateOnCharMessage: false,
    history: [] // { time, text }
  };

  // ---------- Context & Settings ----------

  function getCtx() {
    try {
      return window.SillyTavern?.getContext?.() || null;
    } catch (_) {
      return null;
    }
  }

  function ensureSettings() {
    const ctx = getCtx();
    if (!ctx) return structuredClone(DEFAULTS);

    const store = ctx.extensionSettings || (ctx.extensionSettings = {});
    if (!store[MODULE]) store[MODULE] = {};
    const st = store[MODULE];

    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (typeof st[k] === 'undefined') {
        st[k] = structuredClone(v);
      }
    }

    // history ป้องกัน null/ไม่ใช่ array
    if (!Array.isArray(st.history)) st.history = [];
    return st;
  }

  function saveSettings() {
    const ctx = getCtx();
    (ctx?.saveSettingsDebounced || ctx?.saveSettings || (() => {})).call(ctx);
  }

  // ---------- Util ----------

  function toast(msg) {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('rp-post-ext__toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rp-post-ext__toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = '0';
    }, 1400);
  }

  function safeText(x) {
    return (x == null) ? '' : String(x);
  }

  function truncate(str, n) {
    str = safeText(str).replace(/\s+/g, ' ').trim();
    if (str.length <= n) return str;
    return str.slice(0, n - 1) + '…';
  }

  function formatTime(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
  }

  // ---------- Core: สร้างโพสต์จากบทโรล ----------

  function collectRecentMessages() {
    const ctx = getCtx();
    const st = ensureSettings();
    const chat = ctx?.chat || [];
    if (!Array.isArray(chat) || chat.length === 0) return [];

    const max = Math.max(4, Math.min(50, st.maxMessages || DEFAULTS.maxMessages));

    // เก็บจากท้ายสุดย้อนกลับ แล้วค่อย reverse
    const slice = [];
    for (let i = chat.length - 1; i >= 0 && slice.length < max; i--) {
      const m = chat[i];
      if (!m || typeof m.mes !== 'string') continue;
      // ตัด system/บรรยายแปลก ๆ แบบหยาบ ๆ (แล้วแต่ format ของ user เอง)
      // ที่แน่ ๆ เก็บแต่ user/char ไว้
      const isUser = !!m.is_user;
      // SillyTavern default: is_user true/false
      slice.push({
        isUser,
        text: m.mes
      });
    }

    return slice.reverse();
  }

  function buildPostFromChat() {
    const messages = collectRecentMessages();
    const ctx = getCtx();
    const st = ensureSettings();

    if (!messages.length) {
      return {
        text: 'ยังไม่มีบทโรลในแชทเลย เลื่อนโรลก่อนแล้วค่อยกดสร้างโพสต์นะ ;)',
        empty: true
      };
    }

    // ทำ list เหตุการณ์ง่าย ๆ
    const bullets = messages.map((m) => {
      const who = m.isUser ? '{{user}}' : '{{char}}';
      const body = truncate(m.text.replace(/[\r\n]+/g, ' / '), 120);
      return `• ${who}: ${body}`;
    }).join('\n');

    // template โพสต์ (ปรับคำ/emoji ได้ตามชอบ)
    const post = [
      `โพสต์บ่นของ {{char}} เกี่ยวกับโรลกับ {{user}} วันนี้ 📝`,
      '',
      `วันนี้โรลกับ {{user}} แล้วมันเป็นแบบนี้แหละ:`,
      bullets,
      '',
      `#RP #SillyTavern #{{char}}`
    ].join('\n');

    return { text: post, empty: false };
  }

  function pushHistory(text) {
    const st = ensureSettings();
    st.history.unshift({
      time: Date.now(),
      text: safeText(text)
    });

    // limit history
    if (st.history.length > 30) {
      st.history.length = 30;
    }
    saveSettings();
  }

  // ---------- Popup UI ----------

  function ensurePopup() {
    if (typeof document === 'undefined') return null;

    let backdrop = document.getElementById('rp-post-ext__backdrop');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.id = 'rp-post-ext__backdrop';

    const popup = document.createElement('div');
    popup.id = 'rp-post-ext__popup';

    const header = document.createElement('div');
    header.id = 'rp-post-ext__popup-header';

    const title = document.createElement('div');
    title.id = 'rp-post-ext__popup-title';
    title.textContent = 'โพสต์โรลของ {{char}}';

    const btnClose = document.createElement('button');
    btnClose.id = 'rp-post-ext__popup-close';
    btnClose.type = 'button';
    btnClose.innerHTML = '&times;';

    header.append(title, btnClose);

    const body = document.createElement('div');
    body.id = 'rp-post-ext__popup-body';

    const latestLabel = document.createElement('div');
    latestLabel.id = 'rp-post-ext__latest-label';
    latestLabel.textContent = 'โพสต์ล่าสุด (แก้คำก่อนก็ได้ แล้วค่อย copy ไปแปะเฟส/ทวิต):';

    const textarea = document.createElement('textarea');
    textarea.id = 'rp-post-ext__textarea';
    textarea.spellcheck = false;

    const actions = document.createElement('div');
    actions.id = 'rp-post-ext__actions';

    const btnCopy = document.createElement('button');
    btnCopy.className = 'rp-post-ext__btn-primary';
    btnCopy.type = 'button';
    btnCopy.textContent = 'Copy ไปคลิปบอร์ด';

    const btnRegenerate = document.createElement('button');
    btnRegenerate.className = 'rp-post-ext__btn-secondary';
    btnRegenerate.type = 'button';
    btnRegenerate.textContent = 'สร้างใหม่จากบทโรลปัจจุบัน';

    actions.append(btnRegenerate, btnCopy);

    // history area
    const historyWrap = document.createElement('div');
    historyWrap.id = 'rp-post-ext__history';

    const historySummary = document.createElement('div');
    historySummary.id = 'rp-post-ext__history-summary';

    const hTitle = document.createElement('span');
    hTitle.textContent = 'โพสต์ก่อนหน้าในห้องนี้';

    const hHint = document.createElement('span');
    hHint.style.opacity = '.7';
    hHint.style.fontSize = '11px';
    hHint.textContent = 'คลิกเพื่อโหลดมาแก้/ก็อป';

    historySummary.append(hTitle, hHint);

    const historyList = document.createElement('div');
    historyList.id = 'rp-post-ext__history-list';

    historyWrap.append(historySummary, historyList);

    body.append(latestLabel, textarea, actions, historyWrap);
    popup.append(header, body);
    backdrop.appendChild(popup);
    document.body.appendChild(backdrop);

    // events
    function closePopup() {
      backdrop.classList.remove('rp-post-ext__open');
    }

    btnClose.addEventListener('click', closePopup);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closePopup();
    });

    btnCopy.addEventListener('click', async () => {
      const txt = textarea.value || '';
      try {
        await navigator.clipboard?.writeText(txt);
        toast('คัดลอกโพสต์แล้ว ✨');
      } catch (_) {
        // fallback
        textarea.select();
        document.execCommand('copy');
        toast('คัดลอกโพสต์แล้ว (fallback) ✨');
      }
    });

    btnRegenerate.addEventListener('click', () => {
      const { text } = buildPostFromChat();
      textarea.value = text;
      pushHistory(text);
      renderHistory(historyList, textarea);
      toast('สร้างโพสต์ใหม่จากบทโรลล่าสุดแล้ว');
    });

    // expose refs
    backdrop._popupRefs = {
      textarea,
      historyList,
      open: () => backdrop.classList.add('rp-post-ext__open'),
      close: closePopup
    };

    return backdrop;
  }

  function renderHistory(listEl, textarea) {
    const st = ensureSettings();
    if (!listEl) return;

    listEl.innerHTML = '';
    if (!Array.isArray(st.history) || st.history.length === 0) {
      const empty = document.createElement('div');
      empty.style.opacity = '.7';
      empty.style.fontSize = '11px';
      empty.textContent = 'ยังไม่มีโพสต์เก็บไว้ใน history';
      listEl.appendChild(empty);
      return;
    }

    st.history.forEach((item, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'rp-post-ext__history-item';

      const meta = document.createElement('div');
      meta.className = 'rp-post-ext__history-meta';
      meta.textContent = `#${idx + 1} · ${formatTime(item.time)}`;

      const preview = document.createElement('div');
      preview.className = 'rp-post-ext__history-preview';
      preview.textContent = truncate(item.text, 100);

      wrap.append(meta, preview);
      wrap.addEventListener('click', () => {
        textarea.value = item.text;
        toast(`โหลดโพสต์ #${idx + 1} มาแก้แล้ว`);
      });

      listEl.appendChild(wrap);
    });
  }

  function openPopupWithCurrentPost() {
    const backdrop = ensurePopup();
    if (!backdrop) return;

    const refs = backdrop._popupRefs;
    if (!refs) return;

    const { textarea, historyList, open } = refs;
    const { text } = buildPostFromChat();
    textarea.value = text;
    pushHistory(text);
    renderHistory(historyList, textarea);
    open();
  }

  // ---------- Main Button UI ----------

  function addMainButton() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('rp-post-ext__container')) return;

    const mount =
      document.querySelector(
        '.chat-input-container,.input-group,.send-form,#send_form,.chat-controls,.st-user-input'
      ) || document.body;

    const box = document.createElement('div');
    box.id = 'rp-post-ext__container';

    const btn = document.createElement('button');
    btn.id = 'rp-post-ext__btn';
    btn.type = 'button';
    btn.title = 'สร้างโพสต์บ่น/เมาท์จากบทโรลล่าสุด';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = '✎';

    const textSpan = document.createElement('span');
    textSpan.textContent = 'โพสต์โรล';

    btn.append(iconSpan, textSpan);

    // mini settings
    const st = ensureSettings();
    const menu = document.createElement('div');
    menu.id = 'rp-post-ext__menu';

    const labelAuto = document.createElement('label');
    const chkAuto = document.createElement('input');
    chkAuto.type = 'checkbox';
    chkAuto.checked = !!st.autoGenerateOnCharMessage;
    const spanAuto = document.createElement('span');
    spanAuto.textContent = 'Auto เมื่อ {{char}} ตอบ';
    labelAuto.append(chkAuto, spanAuto);

    const labelMax = document.createElement('label');
    const spanMax = document.createElement('span');
    spanMax.textContent = 'ใช้ข้อความล่าสุด:';
    const inpMax = document.createElement('input');
    inpMax.type = 'number';
    inpMax.min = '4';
    inpMax.max = '50';
    inpMax.value = st.maxMessages || DEFAULTS.maxMessages;
    const spanTail = document.createElement('span');
    spanTail.textContent = 'บรรทัด';
    labelMax.append(spanMax, inpMax, spanTail);

    menu.append(labelAuto, labelMax);

    box.append(btn, menu);

    // events
    btn.addEventListener('click', () => {
      openPopupWithCurrentPost();
    });

    chkAuto.addEventListener('change', () => {
      const st2 = ensureSettings();
      st2.autoGenerateOnCharMessage = chkAuto.checked;
      saveSettings();
      toast(`Auto Generate: ${chkAuto.checked ? 'ON' : 'OFF'}`);
    });

    inpMax.addEventListener('change', () => {
      const v = parseInt(inpMax.value, 10);
      const st2 = ensureSettings();
      if (!Number.isFinite(v)) return;
      st2.maxMessages = Math.max(4, Math.min(50, v));
      inpMax.value = st2.maxMessages;
      saveSettings();
      toast(`ใช้ข้อความล่าสุด ${st2.maxMessages} บรรทัด`);
    });

    if (mount === document.body) {
      box.style.position = 'fixed';
      box.style.bottom = '12px';
      box.style.left = '12px';
      box.style.zIndex = '9999';
      document.body.appendChild(box);
    } else {
      mount.appendChild(box);
    }

    // auto re-add ถ้า DOM เปลี่ยน
    observeUI();
  }

  function observeUI() {
    if (observeUI._observer || typeof document === 'undefined') return;
    const mo = new MutationObserver(() => {
      if (!document.getElementById('rp-post-ext__container')) {
        addMainButton();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    observeUI._observer = mo;
  }

  // ---------- Event wiring ----------

  function wireWithEvents() {
    const ctx = getCtx();
    if (!ctx) return false;
    const { eventSource, event_types } = ctx || {};
    if (!eventSource || !event_types) return false;

    // เมื่อมี message ใหม่เข้ามา
    eventSource.on?.(event_types.MESSAGE_RECEIVED, () => {
      const st = ensureSettings();
      if (!st.autoGenerateOnCharMessage) return;

      // สร้างโพสต์แล้วเก็บ history เฉย ๆ (ไม่เด้ง popup เพื่อจะได้ไม่กวน)
      const { text, empty } = buildPostFromChat();
      if (!empty) {
        pushHistory(text);
        toast('สร้างโพสต์ใหม่จากบทโรล (auto) แล้ว');
      }
    });

    const initUI = () => {
      addMainButton();
    };

    if (event_types.APP_READY) {
      eventSource.on(event_types.APP_READY, initUI);
    } else {
      document.addEventListener('DOMContentLoaded', initUI, { once: true });
      setTimeout(initUI, 800);
    }

    return true;
  }

  function wireFallback() {
    if (typeof document === 'undefined') return;

    const initUI = () => {
      addMainButton();
    };

    document.addEventListener('DOMContentLoaded', initUI, { once: true });
    setTimeout(initUI, 800);
  }

  // ---------- Boot ----------

  function boot() {
    try {
      ensureSettings();
      const ok = wireWithEvents();
      if (!ok) wireFallback();
      setTimeout(() => addMainButton(), 1000);
    } catch (e) {
      console.error('[RP Social Post] init failed', e);
    }
  }

  if (typeof document !== 'undefined') {
    boot();
  }

  // export (optional)
  window.RpSocialPost = {
    buildPostFromChat,
    openPopupWithCurrentPost
  };
})();
