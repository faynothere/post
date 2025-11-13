/* ===== RP Social Post — index.js (simple version) ===== */
(() => {
  if (typeof window === 'undefined') return;
  if (window.RP_POST_EXT_LOADED) return;
  window.RP_POST_EXT_LOADED = true;

  const MODULE = 'rpPostExt';

  const DEFAULTS = {
    maxMessages: 12,
    feed: [] // { time, text, charName, userName }
  };

  // ---------- Context & Settings ----------

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function getCtx() {
    try {
      return window.SillyTavern?.getContext?.() || null;
    } catch {
      return null;
    }
  }

  function ensureSettings() {
    const ctx = getCtx();
    if (!ctx) return cloneDefaults();

    const store = ctx.extensionSettings || (ctx.extensionSettings = {});
    if (!store[MODULE]) {
      store[MODULE] = cloneDefaults();
    } else {
      const st = store[MODULE];
      for (const [k, v] of Object.entries(DEFAULTS)) {
        if (!(k in st)) {
          st[k] = Array.isArray(v) ? v.slice() : v;
        }
      }
      if (!Array.isArray(st.feed)) st.feed = [];
    }
    return store[MODULE];
  }

  function saveSettings() {
    const ctx = getCtx();
    if (!ctx) return;
    (ctx.saveSettingsDebounced || ctx.saveSettings || (() => {})).call(ctx);
  }

  // ---------- Utils ----------

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

  const safeText = (x) => (x == null ? '' : String(x));

  function truncate(str, n) {
    str = safeText(str).replace(/\s+/g, ' ').trim();
    if (str.length <= n) return str;
    return str.slice(0, n - 1) + '…';
  }

  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  function formatTime(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${pad2(d.getDate())}/${pad2(
      d.getMonth() + 1
    )}`;
  }

  function getCharName() {
    const ctx = getCtx() || {};
    return (
      ctx.characterName ||
      (ctx.characters && ctx.characterId != null && ctx.characters[ctx.characterId]?.name) ||
      ctx.name2 ||
      '{{char}}'
    );
  }

  function getUserName() {
    const ctx = getCtx() || {};
    return ctx.name1 || ctx.userName || '{{user}}';
  }

  const randomOf = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');

  // ---------- Chat → Post ----------

  function collectRecentMessages() {
    const ctx = getCtx();
    const st = ensureSettings();
    const chat = ctx?.chat;
    if (!Array.isArray(chat) || !chat.length) return [];

    const max = Math.max(4, Math.min(40, st.maxMessages || DEFAULTS.maxMessages));
    const result = [];

    for (let i = chat.length - 1; i >= 0 && result.length < max; i--) {
      const m = chat[i];
      if (!m || typeof m.mes !== 'string') continue;
      result.push({
        isUser: !!m.is_user,
        text: m.mes
      });
    }

    return result.reverse();
  }

  function buildPostFromChat() {
    const messages = collectRecentMessages();
    const charName = getCharName();
    const userName = getUserName();

    if (!messages.length) {
      return {
        text: `วันนี้ยังไม่มีโรลกับ ${userName} เลย จะให้ฉันบ่นอะไรก่อนล่ะเนี่ย 😤`,
        empty: true
      };
    }

    const bullets = messages
      .map((m) => {
        const who = m.isUser ? userName : charName;
        const body = truncate(m.text.replace(/[\r\n]+/g, ' / '), 120);
        return `• ${who}: ${body}`;
      })
      .join('\n');

    const intro = randomOf([
      `วันนี้โรลกับ ${userName} อีกแล้วนะ...`,
      `อืมม โรลเมื่อกี้กับ ${userName} นี่มัน...`,
      `อัพเดตชีวิตในห้องแชทกับ ${userName} หน่อยละกัน`,
      `บันทึกชาวบ้าน (จริง ๆ คือบ่น ${userName})`
    ]);

    const mood = randomOf([
      'คือมันทั้งฮา ทั้งน่าหัวร้อนในเวลาเดียวกันอะ 555',
      'เริ่มสงสัยแล้วล่ะว่าใครกันแน่ที่เป็นตัวสร้างเรื่อง 🤨',
      'ถ้าใครผ่านมาเห็นก็ช่วยเป็นพยานให้ฉันทีนะ...',
      'แต่ก็สนุกดีแหละ ไม่ได้บ่นจริงจังหรอก (มั้ง)'
    ]);

    return {
      text: [intro, '', bullets, '', mood].join('\n'),
      empty: false,
      charName,
      userName
    };
  }

  function pushPost(post) {
    const st = ensureSettings();
    st.feed.unshift({
      time: Date.now(),
      text: safeText(post.text),
      charName: post.charName || getCharName(),
      userName: post.userName || getUserName()
    });
    if (st.feed.length > 100) st.feed.length = 100;
    saveSettings();
  }

  // ---------- Feed UI ----------

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

    const titleWrap = document.createElement('div');

    const title = document.createElement('div');
    title.id = 'rp-post-ext__popup-title';
    title.textContent = 'โซเชียล RP ของ {{char}}';

    const subtitle = document.createElement('div');
    subtitle.id = 'rp-post-ext__popup-subtitle';
    subtitle.textContent = 'ฟีดปลอมสไตล์เฟส/ทวิต — ให้ {{char}} มาเมาท์โรลกับ {{user}}';

    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const btnClose = document.createElement('button');
    btnClose.id = 'rp-post-ext__popup-close';
    btnClose.type = 'button';
    btnClose.innerHTML = '&times;';

    header.appendChild(titleWrap);
    header.appendChild(btnClose);

    const body = document.createElement('div');
    body.id = 'rp-post-ext__popup-body';

    const toolbar = document.createElement('div');
    toolbar.id = 'rp-post-ext__toolbar';

    const toolbarLeft = document.createElement('div');
    toolbarLeft.id = 'rp-post-ext__toolbar-left';

    const toolbarTitle = document.createElement('div');
    toolbarTitle.textContent = 'ฟีดโพสต์ของตัวละครนี้';

    const toolbarText = document.createElement('div');
    toolbarText.id = 'rp-post-ext__toolbar-text';
    toolbarText.textContent = 'กดปุ่มด้านขวาเพื่อให้ {{char}} เอาโรลล่าสุดมาโพสต์';

    toolbarLeft.appendChild(toolbarTitle);
    toolbarLeft.appendChild(toolbarText);

    const toolbarRight = document.createElement('div');
    toolbarRight.id = 'rp-post-ext__toolbar-right';

    const btnNewPost = document.createElement('button');
    btnNewPost.className = 'rp-post-ext__btn-primary';
    btnNewPost.type = 'button';
    btnNewPost.textContent = 'โพสต์ใหม่จากโรลล่าสุด';

    toolbarRight.appendChild(btnNewPost);

    toolbar.appendChild(toolbarLeft);
    toolbar.appendChild(toolbarRight);

    const feed = document.createElement('div');
    feed.id = 'rp-post-ext__feed';

    body.appendChild(toolbar);
    body.appendChild(feed);

    popup.appendChild(header);
    popup.appendChild(body);
    backdrop.appendChild(popup);
    document.body.appendChild(backdrop);

    function closePopup() {
      backdrop.classList.remove('rp-post-ext__open');
    }

    btnClose.addEventListener('click', closePopup);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closePopup();
    });

    btnNewPost.addEventListener('click', () => {
      const res = buildPostFromChat();
      if (!res || res.empty) {
        toast('ยังไม่มีบทโรลให้เอามาโพสต์เลย');
        return;
      }
      pushPost(res);
      renderFeed(feed);
      toast(`โพสต์ใหม่ของ ${getCharName()} ถูกเพิ่มลงฟีดแล้ว ✨`);
    });

    backdrop._rpFeedRefs = {
      feed,
      open: () => backdrop.classList.add('rp-post-ext__open'),
      close: closePopup
    };

    return backdrop;
  }

  function renderFeed(feedEl) {
    const st = ensureSettings();
    if (!feedEl) return;
    feedEl.innerHTML = '';

    if (!Array.isArray(st.feed) || st.feed.length === 0) {
      const empty = document.createElement('div');
      empty.id = 'rp-post-ext__empty';
      empty.textContent = 'ยังไม่มีโพสต์เลย กด “โพสต์ใหม่จากโรลล่าสุด” เพื่อให้ {{char}} เริ่มเมาท์ก่อนสิ~';
      feedEl.appendChild(empty);
      return;
    }

    st.feed.forEach((item) => {
      const wrap = document.createElement('div');
      wrap.className = 'rp-post-ext__post';

      const avatar = document.createElement('div');
      avatar.className = 'rp-post-ext__avatar';
      const letter = safeText(item.charName || '{{char}}').trim().charAt(0) || '?';
      avatar.textContent = letter.toUpperCase();

      const main = document.createElement('div');
      main.className = 'rp-post-ext__post-main';

      const header = document.createElement('div');
      header.className = 'rp-post-ext__post-header';

      const name = document.createElement('div');
      name.className = 'rp-post-ext__post-name';
      name.textContent = item.charName || '{{char}}';

      const handle = document.createElement('div');
      handle.className = 'rp-post-ext__post-handle';
      handle.textContent =
        '@' + safeText(item.charName || 'char').toLowerCase().replace(/\s+/g, '_');

      const time = document.createElement('div');
      time.className = 'rp-post-ext__post-time';
      time.textContent = formatTime(item.time);

      header.appendChild(name);
      header.appendChild(handle);
      header.appendChild(time);

      const body = document.createElement('div');
      body.className = 'rp-post-ext__post-body';
      body.textContent = item.text;

      main.appendChild(header);
      main.appendChild(body);

      wrap.appendChild(avatar);
      wrap.appendChild(main);

      feedEl.appendChild(wrap);
    });
  }

  function openFeedAndMaybeAddNewPost() {
    const backdrop = ensurePopup();
    if (!backdrop || !backdrop._rpFeedRefs) return;

    const { feed, open } = backdrop._rpFeedRefs;

    // เวลา “กดปุ่มข้างช่องพิมพ์”
    // = สร้างโพสต์จากโรลล่าสุด 1 อัน แล้วเปิดฟีด
    const res = buildPostFromChat();
    if (res && !res.empty) {
      pushPost(res);
    }
    renderFeed(feed);
    open();
  }

  // ---------- Button near chat input ----------

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
    btn.title = 'เปิดฟีดโซเชียลปลอมของ {{char}}';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = '📣';

    const textSpan = document.createElement('span');
    textSpan.textContent = 'โซเชียล RP';

    btn.appendChild(iconSpan);
    btn.appendChild(textSpan);

    box.appendChild(btn);

    btn.addEventListener('click', () => {
      openFeedAndMaybeAddNewPost();
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

    observeUI();
  }

  function observeUI() {
    if (typeof document === 'undefined') return;
    if (observeUI._observer) return;

    const mo = new MutationObserver(() => {
      if (!document.getElementById('rp-post-ext__container')) {
        addMainButton();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    observeUI._observer = mo;
  }

  // ---------- Boot ----------

  function boot() {
    if (typeof document === 'undefined') return;
    const init = () => addMainButton();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }

  boot();

  // expose for console
  window.RpSocialPost = {
    buildPostFromChat,
    openFeedAndMaybeAddNewPost
  };
})();
