(function() {
    'use strict';

    // ตรวจสอบว่า extension ถูกโหลดแล้วหรือไม่
    if (window.socialPostExtensionLoaded) {
        console.log('Social Post Extension already loaded');
        return;
    }
    window.socialPostExtensionLoaded = true;

    console.log('Loading Character Social Post Generator...');

    // Configuration
    const MODULE_NAME = 'characterSocialPostGenerator';
    const DEFAULT_SETTINGS = {
        platform: 'facebook',
        style: 'complaint',
        includeRecentMessages: 3,
        autoGenerate: false,
        enabled: true
    };

    // Global variables
    let settings = { ...DEFAULT_SETTINGS };
    let socialPosts = [];

    // Utility functions
    function getContext() {
        return window.SillyTavern?.getContext?.() || null;
    }

    function loadSettings() {
        try {
            const ctx = getContext();
            if (ctx?.extensionSettings?.[MODULE_NAME]) {
                settings = { ...DEFAULT_SETTINGS, ...ctx.extensionSettings[MODULE_NAME] };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            settings = { ...DEFAULT_SETTINGS };
        }
        return settings;
    }

    function saveSettings() {
        try {
            const ctx = getContext();
            if (ctx) {
                if (!ctx.extensionSettings) {
                    ctx.extensionSettings = {};
                }
                ctx.extensionSettings[MODULE_NAME] = settings;
                if (ctx.saveSettings) {
                    ctx.saveSettings();
                } else if (ctx.saveSettingsDebounced) {
                    ctx.saveSettingsDebounced();
                }
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    function loadPosts() {
        try {
            const saved = localStorage.getItem('socialPosts');
            if (saved) {
                socialPosts = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading posts:', error);
            socialPosts = [];
        }
    }

    function savePosts() {
        try {
            localStorage.setItem('socialPosts', JSON.stringify(socialPosts));
        } catch (error) {
            console.error('Error saving posts:', error);
        }
    }

    // Core functionality
    function getRecentConversation(limit = 3) {
        const ctx = getContext();
        if (!ctx?.chat) {
            return [];
        }

        const recentMessages = ctx.chat.slice(-limit);
        return recentMessages.map(msg => {
            return {
                name: msg.name || (msg.is_user ? 'User' : 'Character'),
                message: msg.mes || '',
                is_user: msg.is_user
            };
        }).filter(msg => msg.message.trim().length > 0);
    }

    function createPrompt(conversation, charName, platform, style) {
        const platformNames = {
            'facebook': 'เฟสบุ๊ค',
            'twitter': 'ทวิตเตอร์', 
            'instagram': 'อินสตาแกรม'
        };

        const styleNames = {
            'complaint': 'บ่น/ประชด',
            'funny': 'ตลก',
            'serious': 'จริงจัง',
            'excited': 'ตื่นเต้น',
            'sad': 'เศร้า'
        };

        const conversationText = conversation.map(msg => 
            `${msg.name}: ${msg.message}`
        ).join('\n');

        return `บทบาท: คุณคือ ${charName} ที่กำลังเขียนโพสต์${platformNames[platform]}ในสไตล์${styleNames[style]}

บทสนทนาล่าสุด:
${conversationText}

คำแนะนำสำหรับการเขียนโพสต์:
- เขียนโพสต์สั้นๆ กระทัดรัด
- สไตล์: ${styleNames[style]}
- แพลตฟอร์ม: ${platformNames[platform]}
- ต้องสอดคล้องกับบทสนทนาที่เกิดขึ้น
- ใช้ภาษาธรรมดาเหมือนคนโพสต์จริง
- ไม่ต้องมีคำนำหน้าเช่น "โพสต์:" หรือเครื่องหมายคำพูด

โพสต์:`;
    }

    async function generateSocialPost() {
        try {
            const conversation = getRecentConversation(settings.includeRecentMessages);
            if (conversation.length === 0) {
                throw new Error('ไม่มีบทสนทนาพอสำหรับสร้างโพสต์');
            }

            const charName = conversation.find(msg => !msg.is_user)?.name || 'ตัวละคร';
            const prompt = createPrompt(conversation, charName, settings.platform, settings.style);

            // ใช้ API ของ SillyTavern สำหรับสร้างข้อความ
            const ctx = getContext();
            if (!ctx) {
                throw new Error('ไม่สามารถเชื่อมต่อกับ SillyTavern ได้');
            }

            let generatedText = '';
            
            // ลองใช้วิธีการต่างๆ ในการสร้างข้อความ
            if (ctx.generateQuietPrompt) {
                generatedText = await ctx.generateQuietPrompt(prompt);
            } else if (ctx.sendMessageAsUser) {
                // สร้างข้อความแบบจำลอง
                generatedText = await simulateAIResponse(prompt);
            } else {
                generatedText = await simulateAIResponse(prompt);
            }

            if (!generatedText || generatedText.trim().length === 0) {
                throw new Error('AI ไม่ได้สร้างข้อความ');
            }

            // ทำความสะอาดข้อความ
            const cleanText = generatedText.trim()
                .replace(/^["']|["']$/g, '')
                .replace(/^(โพสต์|ทวิต|โพสต์:|ทวิต:)\s*/i, '')
                .split('\n')[0];

            const newPost = {
                id: Date.now().toString(),
                content: cleanText,
                platform: settings.platform,
                character: charName,
                timestamp: new Date().toLocaleString('th-TH'),
                style: settings.style,
                conversation: conversation
            };

            socialPosts.unshift(newPost);
            savePosts();

            return newPost;

        } catch (error) {
            console.error('Error generating social post:', error);
            throw error;
        }
    }

    // Fallback function สำหรับเมื่อไม่มี AI จริง
    async function simulateAIResponse(prompt) {
        // สร้างข้อความตัวอย่างตามสไตล์และแพลตฟอร์ม
        const responses = {
            'facebook': {
                'complaint': ['เหนื่อยจังกับเรื่องนี้เลย...', 'บางครั้งก็อยากให้สิ่งต่างๆ มันง่ายๆ บ้างนะ', 'ทำไมชีวิตมันต้องยุ่งยากขนาดนี้'],
                'funny': ['ฮาๆ เรื่องนี้มันตลกดีนะ 555', 'วันนี้มีเรื่องเล่าให้ขำๆ 😂', 'ชีวิตต้องมีเสียงหัวเราะนะ!'],
                'serious': ['เรื่องนี้ทำให้ผมต้องคิดอย่างจริงจัง...', 'บางครั้งเราก็ต้องเผชิญกับความจริง', 'การเติบโตมักมาพร้อมกับบทเรียน'],
                'excited': ['ว้าว! ตื่นเต้นกับสิ่งที่เกิดขึ้น! 🎉', 'นี่คือช่วงเวลาที่รอคอย!', 'รู้สึกดีใจมากกับเรื่องนี้!'],
                'sad': ['รู้สึกเศร้าจังกับสิ่งที่เกิดขึ้น...', 'บางวันก็รู้สึกเหงาจัง', 'หวังว่าพรุ่งนี้จะดีกว่านี้']
            },
            'twitter': {
                'complaint': ['เหนื่อยใจ #ชีวิต', 'ทำไมมันต้องยุ่งยากนะ', 'บางครั้งก็อยากพักจากทุกอย่าง'],
                'funny': ['ฮาจริง 555 #ตลก', 'มีเรื่องมาให้ขำๆ 😂', 'ชีวิตต้องฮา!'],
                'serious': ['ต้องคิดให้มากกับเรื่องนี้...', 'บทเรียนชีวิต', 'การตัดสินใจที่สำคัญ'],
                'excited': ['ตื่นเต้นมาก! 🎉', 'นี่มันเจ๋งไปเลย!', 'ดีใจสุดๆ!'],
                'sad': ['รู้สึกไม่ค่อยดี today...', 'วันนี้ไม่อยากคุยกับใคร', 'หวังว่าจะดีขึ้น']
            },
            'instagram': {
                'complaint': ['เหนื่อย... 💔 #ชีวิตประจำวัน', 'บางเรื่องก็ทำให้รู้สึกไม่โอเค', 'ต้องการการพักผ่อนจริงๆ'],
                'funny': ['มีเรื่องตลกมาแบ่งปัน! 😂 #ความสุข', 'ชีวิตต้องมีเสียงหัวเราะ!', 'ยิ้มเข้าไว้!'],
                'serious': ['การคิดทบทวน... ✨ #การเติบโต', 'บางเรื่องต้องใช้เวลา', 'บทเรียนที่มีค่า'],
                'excited': ['รู้สึกตื่นเต้นมาก! 🌟 #ความสุข', 'นี่คือช่วงเวลาที่พิเศษ!', 'เต็มที่กับทุกโอกาส!'],
                'sad': ['ความรู้สึกวันนี้... 🥺 #ชีวิต', 'บางครั้งก็ต้องยอมรับความจริง', 'กำลังใจสำคัญที่สุด']
            }
        };

        const platformResponses = responses[settings.platform] || responses.facebook;
        const styleResponses = platformResponses[settings.style] || platformResponses.complaint;
        const randomResponse = styleResponses[Math.floor(Math.random() * styleResponses.length)];
        
        // สุ่มเพิ่ม emoji บ้าง
        const emojis = ['😊', '😂', '🥺', '❤️', '✨', '👍', '🙏'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        return Math.random() > 0.5 ? randomResponse : `${randomResponse} ${randomEmoji}`;
    }

    // UI Components
    function createToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            z-index: 100001;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    function createModal() {
        if (document.getElementById('social-post-modal')) {
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'social-post-modal';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div id="social-post-modal__content">
                <div id="social-post-modal__header">
                    <h3 id="social-post-modal__title">โพสต์โซเชียลมีเดีย</h3>
                    <button id="social-post-modal__close">&times;</button>
                </div>
                <div id="social-post-modal__posts-container">
                    <div id="social-post-modal__loading" style="display: none;">กำลังสร้างโพสต์...</div>
                    <div id="social-post-modal__empty" style="display: none;">ยังไม่มีโพสต์ที่สร้าง</div>
                    <div id="social-post-modal__posts"></div>
                </div>
                <div style="margin-top: 16px; text-align: center;">
                    <button id="social-post-modal__new" style="margin-right: 8px;">สร้างโพสต์ใหม่</button>
                    <button id="social-post-modal__clear">ล้างทั้งหมด</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('social-post-modal__close').addEventListener('click', hideModal);
        document.getElementById('social-post-modal__new').addEventListener('click', generateAndShowPost);
        document.getElementById('social-post-modal__clear').addEventListener('click', clearAllPosts);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    }

    function showModal() {
        const modal = document.getElementById('social-post-modal');
        modal.style.display = 'flex';
        renderPosts();
    }

    function hideModal() {
        const modal = document.getElementById('social-post-modal');
        modal.style.display = 'none';
    }

    function renderPosts() {
        const postsContainer = document.getElementById('social-post-modal__posts');
        const emptyMessage = document.getElementById('social-post-modal__empty');
        const loading = document.getElementById('social-post-modal__loading');

        loading.style.display = 'none';
        postsContainer.innerHTML = '';

        if (socialPosts.length === 0) {
            emptyMessage.style.display = 'block';
            return;
        }

        emptyMessage.style.display = 'none';

        socialPosts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.className = `social-post ${post.platform}`;
            postElement.innerHTML = `
                <div class="social-post__header">
                    <div class="social-post__avatar">${post.character.charAt(0)}</div>
                    <div class="social-post__info">
                        <div class="social-post__name">${post.character}</div>
                        <div class="social-post__meta">
                            ${post.timestamp}
                            <span class="social-post__platform">${post.platform}</span>
                            <span class="social-post__platform">${post.style}</span>
                        </div>
                    </div>
                </div>
                <div class="social-post__content">${post.content}</div>
                <div class="social-post__actions">
                    <button class="social-post__action copy-post" data-id="${post.id}">📋 คัดลอก</button>
                    <button class="social-post__action delete-post" data-id="${post.id}">🗑️ ลบ</button>
                </div>
            `;
            postsContainer.appendChild(postElement);
        });

        // Add event listeners for dynamic elements
        postsContainer.querySelectorAll('.copy-post').forEach(btn => {
            btn.addEventListener('click', function() {
                const postId = this.getAttribute('data-id');
                const post = socialPosts.find(p => p.id === postId);
                if (post) {
                    navigator.clipboard.writeText(post.content).then(() => {
                        createToast('คัดลอกโพสต์แล้ว!');
                    }).catch(() => {
                        createToast('คัดลอกไม่สำเร็จ', 'error');
                    });
                }
            });
        });

        postsContainer.querySelectorAll('.delete-post').forEach(btn => {
            btn.addEventListener('click', function() {
                const postId = this.getAttribute('data-id');
                socialPosts = socialPosts.filter(p => p.id !== postId);
                savePosts();
                renderPosts();
                createToast('ลบโพสต์แล้ว!');
            });
        });
    }

    async function generateAndShowPost() {
        const loading = document.getElementById('social-post-modal__loading');
        const postsContainer = document.getElementById('social-post-modal__posts');
        
        loading.style.display = 'block';
        postsContainer.style.display = 'none';

        try {
            await generateSocialPost();
            renderPosts();
            createToast('สร้างโพสต์สำเร็จ!');
        } catch (error) {
            createToast('สร้างโพสต์ไม่สำเร็จ: ' + error.message, 'error');
            console.error('Generation error:', error);
        } finally {
            loading.style.display = 'none';
            postsContainer.style.display = 'block';
        }
    }

    function clearAllPosts() {
        if (confirm('ต้องการลบโพสต์ทั้งหมดใช่ไหม?')) {
            socialPosts = [];
            savePosts();
            renderPosts();
            createToast('ล้างโพสต์ทั้งหมดแล้ว!');
        }
    }

    function createMainUI() {
        if (document.getElementById('social-post-ext__container')) {
            return;
        }

        const container = document.createElement('div');
        container.id = 'social-post-ext__container';

        const button = document.createElement('button');
        button.id = 'social-post-ext__btn';
        button.innerHTML = '📱 สร้างโพสต์';
        button.title = 'สร้างโพสต์โซเชียลมีเดียจากบทสนทนา';

        const menu = document.createElement('div');
        menu.id = 'social-post-ext__menu';
        menu.innerHTML = `
            <label>
                <span>แพลตฟอร์ม:</span>
                <select id="social-post-platform">
                    <option value="facebook">Facebook</option>
                    <option value="twitter">Twitter</option>
                    <option value="instagram">Instagram</option>
                </select>
            </label>
            <label>
                <span>สไตล์:</span>
                <select id="social-post-style">
                    <option value="complaint">บ่น/ประชด</option>
                    <option value="funny">ตลก</option>
                    <option value="serious">จริงจัง</option>
                    <option value="excited">ตื่นเต้น</option>
                    <option value="sad">เศร้า</option>
                </select>
            </label>
            <label>
                <span>จำนวนข้อความ:</span>
                <input type="number" id="social-post-count" min="1" max="10" value="3" style="width: 50px;">
            </label>
            <label>
                <input type="checkbox" id="social-post-auto">
                <span>สร้างอัตโนมัติ</span>
            </label>
        `;

        container.appendChild(button);
        container.appendChild(menu);

        // Find where to place the UI
        const possibleParents = [
            '.chat-input-container',
            '.input-group', 
            '.send-form',
            '#send_form',
            '.chat-controls',
            '.st-user-input'
        ];

        let parent = document.body;
        for (const selector of possibleParents) {
            const element = document.querySelector(selector);
            if (element) {
                parent = element;
                break;
            }
        }

        if (parent === document.body) {
            container.style.position = 'fixed';
            container.style.bottom = '80px';
            container.style.left = '20px';
            container.style.zIndex = '9999';
        }

        parent.appendChild(container);

        // Load current settings to UI
        document.getElementById('social-post-platform').value = settings.platform;
        document.getElementById('social-post-style').value = settings.style;
        document.getElementById('social-post-count').value = settings.includeRecentMessages;
        document.getElementById('social-post-auto').checked = settings.autoGenerate;

        // Event listeners
        let menuOpen = false;

        button.addEventListener('click', async () => {
            if (!menuOpen) {
                showModal();
            }
        });

        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            menuOpen = !menuOpen;
            menu.style.display = menuOpen ? 'flex' : 'none';
        });

        // Settings change listeners
        document.getElementById('social-post-platform').addEventListener('change', function() {
            settings.platform = this.value;
            saveSettings();
        });

        document.getElementById('social-post-style').addEventListener('change', function() {
            settings.style = this.value;
            saveSettings();
        });

        document.getElementById('social-post-count').addEventListener('change', function() {
            settings.includeRecentMessages = parseInt(this.value);
            saveSettings();
        });

        document.getElementById('social-post-auto').addEventListener('change', function() {
            settings.autoGenerate = this.checked;
            saveSettings();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                menuOpen = false;
                menu.style.display = 'none';
            }
        });
    }

    // Auto-generation feature
    function setupAutoGeneration() {
        const ctx = getContext();
        if (!ctx?.eventSource) {
            return;
        }

        ctx.eventSource.on(ctx.event_types.MESSAGE_SENT, () => {
            if (settings.autoGenerate && Math.random() < 0.2) { // 20% chance
                setTimeout(async () => {
                    try {
                        await generateSocialPost();
                        createToast('สร้างโพสต์อัตโนมัติสำเร็จ!');
                    } catch (error) {
                        console.log('Auto-generation failed:', error);
                    }
                }, 1000);
            }
        });
    }

    // Initialize extension
    function initialize() {
        try {
            console.log('Initializing Character Social Post Generator...');
            
            loadSettings();
            loadPosts();
            createModal();
            createMainUI();
            setupAutoGeneration();

            console.log('Character Social Post Generator initialized successfully');

        } catch (error) {
            console.error('Failed to initialize extension:', error);
            createToast('Extension เริ่มต้นไม่สำเร็จ', 'error');
        }
    }

    // Start the extension
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        setTimeout(initialize, 1000);
    }

    // Export for debugging
    window.CharacterSocialPostGenerator = {
        initialize,
        generateSocialPost,
        showModal,
        hideModal,
        getSettings: () => settings,
        getPosts: () => socialPosts
    };

})();
