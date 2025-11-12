import { getContext, eventSource, event_types } from '../../../script.js';
import { extension_settings, renderExtensionTemplate } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

// ตั้งค่าเริ่มต้น
const defaultSettings = {
    enabled: true,
    autoPostFrequency: 3,
    enabledPlatforms: ['twitter', 'facebook', 'instagram'],
    maxPosts: 20,
    enableNotifications: true,
    posts: []
};

// กำหนด extension namespace
const extensionName = 'socialMediaPosts';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}/`;

// กำหนด template ต่างๆ
const postTemplates = {
    reflective: [
        "คิดเกี่ยวกับเรื่องนี้มาตลอด... {{context}}",
        "บางครั้งก็สงสัยว่า... {{context}}",
        "ได้บทเรียนใหม่จากเรื่องนี้... {{context}}"
    ],
    emotional: [
        "รู้สึกแบบนี้จริงๆ... {{context}}",
        "วันนี้ emotions มันพลุ่งพล่าน... {{context}}",
        "ไม่คิดว่าจะรู้สึกแบบนี้ได้... {{context}}"
    ],
    casual: [
        "แชร์เรื่องเล็กๆ น้อยๆ... {{context}}",
        "ชีวิตประจำวัน... {{context}}",
        "เพิ่งเจอเรื่องแบบนี้... {{context}}"
    ],
    dramatic: [
        "ไม่น่าเชื่อว่าจะเกิดเรื่องแบบนี้! {{context}}",
        "เรื่องน่าตกใจเกิดขึ้น... {{context}}",
        "ตอนนี้กำลังเกิดขึ้น... {{context}}"
    ]
};

const platforms = {
    'twitter': { name: 'Twitter', icon: '🐦', maxLength: 280 },
    'facebook': { name: 'Facebook', icon: '📘', maxLength: 5000 },
    'instagram': { name: 'Instagram', icon: '📷', maxLength: 2200 },
    'threads': { name: 'Threads', icon: '🧵', maxLength: 500 }
};

// ฟังก์ชันโหลดการตั้งค่า
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    
    // รวมการตั้งค่าเริ่มต้น
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = value;
        }
    }
    
    // โหลดโพสต์จาก localStorage
    const savedPosts = localStorage.getItem(`${extensionName}_posts`);
    if (savedPosts) {
        extension_settings[extensionName].posts = JSON.parse(savedPosts);
    }
}

// บันทึกการตั้งค่า
function saveSettings() {
    localStorage.setItem(`${extensionName}_posts`, JSON.stringify(extension_settings[extensionName].posts));
    saveSettingsDebounced();
}

// สร้าง UI
async function createUI() {
    const container = document.getElementById('extensions_settings2');
    if (!container) {
        console.error('Extensions container not found');
        return;
    }

    try {
        const template = await renderExtensionTemplate(extensionFolderPath, 'template.html', {
            settings: extension_settings[extensionName],
            platforms: platforms,
            postTemplates: postTemplates
        });

        container.insertAdjacentHTML('beforeend', template);
        attachEventListeners();
        updatePostsFeed(); // อัพเดตฟีดโพสต์เมื่อโหลด UI
    } catch (error) {
        console.error('Error creating social media extension UI:', error);
    }
}

// ผูก event listeners
function attachEventListeners() {
    // Toggle extension
    const toggle = document.getElementById('socialMediaToggle');
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            extension_settings[extensionName].enabled = e.target.checked;
            saveSettings();
        });
    }

    // Create post button
    const createBtn = document.getElementById('createPostBtn');
    if (createBtn) {
        createBtn.addEventListener('click', createManualPost);
    }

    // Auto-post frequency
    const freqInput = document.getElementById('autoPostFreq');
    if (freqInput) {
        freqInput.addEventListener('change', (e) => {
            extension_settings[extensionName].autoPostFrequency = parseInt(e.target.value);
            saveSettings();
        });
    }

    // Platform checkboxes
    document.querySelectorAll('.platform-checkboxes input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateEnabledPlatforms);
    });

    // Clear posts button
    const clearBtn = document.getElementById('clearPostsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllPosts);
    }
}

// อัพเดตแพลตฟอร์มที่เปิดใช้งาน
function updateEnabledPlatforms() {
    const enabled = [];
    document.querySelectorAll('.platform-checkboxes input[type="checkbox"]:checked').forEach(checkbox => {
        enabled.push(checkbox.value);
    });
    extension_settings[extensionName].enabledPlatforms = enabled;
    saveSettings();
}

// สร้างโพสต์ manual
function createManualPost() {
    if (!extension_settings[extensionName].enabled) {
        toastr.warning('กรุณาเปิดใช้งาน extension ก่อนสร้างโพสต์');
        return;
    }

    const platformSelect = document.getElementById('postPlatform');
    const templateSelect = document.getElementById('postTemplate');
    
    if (!platformSelect || !templateSelect) {
        console.error('Form elements not found');
        return;
    }

    const platform = platformSelect.value;
    const templateType = templateSelect.value;
    
    const post = generatePost(platform, templateType);
    addNewPost(post);
    showPostNotification(post);
}

// สร้างโพสต์
function generatePost(platform, templateType = 'random') {
    const recentChat = getRecentChatContext(3);
    const context = extractPostContext(recentChat);
    const charName = getCurrentCharName();
    
    // เลือก template
    const actualTemplateType = templateType === 'random' ? getRandomTemplateType() : templateType;
    
    // สร้างเนื้อหาโพสต์
    let content = generatePostContent(context, actualTemplateType);
    
    // ตัดให้เหมาะสมกับแพลตฟอร์ม
    const maxLength = platforms[platform].maxLength;
    if (content.length > maxLength) {
        content = content.substring(0, maxLength - 3) + '...';
    }
    
    // เพิ่ม hashtag
    if (platform === 'instagram' || platform === 'twitter') {
        content += generateHashtags();
    }

    return {
        id: Date.now(),
        content: content,
        platform: platform,
        platformName: platforms[platform].name,
        platformIcon: platforms[platform].icon,
        character: charName,
        timestamp: new Date().toLocaleString('th-TH'),
        likes: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 20),
        shares: Math.floor(Math.random() * 10),
        template: actualTemplateType
    };
}

// สร้างเนื้อหาโพสต์
function generatePostContent(context, templateType) {
    const templates = postTemplates[templateType];
    const template = templates[Math.floor(Math.random() * templates.length)];
    return template.replace('{{context}}', context);
}

// ดึง context จากบทสนทนา
function extractPostContext(recentChat) {
    if (recentChat.length === 0) {
        return "มีเรื่องราวน่าสนใจเกิดขึ้น...";
    }

    const lastUserMsg = recentChat.find(msg => msg.is_user);
    const lastCharMsg = recentChat.find(msg => !msg.is_user);

    if (lastUserMsg && lastCharMsg) {
        return `หลังจากที่ ${lastUserMsg.name} พูดว่า "${shortenText(lastUserMsg.mes, 60)}" ทำให้รู้สึกว่า "${shortenText(lastCharMsg.mes, 80)}"`;
    } else if (lastCharMsg) {
        return shortenText(lastCharMsg.mes, 120);
    }

    return "กำลังคิดเกี่ยวกับเรื่องที่เกิดขึ้น...";
}

// สุ่ม hashtag
function generateHashtags() {
    const hashtags = [
        ' #ชีวิตประจำวัน', ' #ความคิด', ' #ความรู้สึก', 
        ' #เรื่องราว', ' #บทสนทนา', ' #RPG'
    ];
    return hashtags[Math.floor(Math.random() * hashtags.length)];
}

// สุ่มประเภท template
function getRandomTemplateType() {
    const types = Object.keys(postTemplates);
    return types[Math.floor(Math.random() * types.length)];
}

// สุ่มแพลตฟอร์ม
function getRandomPlatform() {
    const enabled = extension_settings[extensionName].enabledPlatforms;
    if (enabled.length === 0) return 'twitter';
    return enabled[Math.floor(Math.random() * enabled.length)];
}

// เพิ่มโพสต์ใหม่
function addNewPost(post) {
    if (!extension_settings[extensionName].posts) {
        extension_settings[extensionName].posts = [];
    }
    
    extension_settings[extensionName].posts.unshift(post);
    
    // จำกัดจำนวนโพสต์
    if (extension_settings[extensionName].posts.length > extension_settings[extensionName].maxPosts) {
        extension_settings[extensionName].posts = extension_settings[extensionName].posts.slice(0, extension_settings[extensionName].maxPosts);
    }
    
    saveSettings();
    updatePostsFeed();
}

// อัพเดตฟีดโพสต์
function updatePostsFeed() {
    const feed = document.getElementById('postsFeed');
    if (feed) {
        feed.innerHTML = renderPostsFeed();
    }
}

// เรนเดอร์ฟีดโพสต์
function renderPostsFeed() {
    const posts = extension_settings[extensionName].posts || [];
    
    if (posts.length === 0) {
        return '<div class="no-posts">ยังไม่มีโพสต์</div>';
    }

    return posts.map(post => `
        <div class="social-post ${post.platform}" data-post-id="${post.id}">
            <div class="post-header">
                <span class="platform-icon">${post.platformIcon}</span>
                <span class="platform-name">${post.platformName}</span>
                <span class="post-time">${post.timestamp}</span>
            </div>
            <div class="post-content">${post.content}</div>
            <div class="post-stats">
                <span>👍 ${post.likes}</span>
                <span>💬 ${post.comments}</span>
                <span>🔄 ${post.shares}</span>
                <span class="post-char">โดย ${post.character}</span>
            </div>
        </div>
    `).join('');
}

// แสดงการแจ้งเตือน
function showPostNotification(post) {
    if (!extension_settings[extensionName].enableNotifications) return;

    if (typeof toastr !== 'undefined') {
        toastr.success(`โพสต์ใหม่บน ${post.platformName}!`, "Social Media Posts", {
            timeOut: 3000,
            extendedTimeOut: 1000
        });
    }
    
    // Log to console for debugging
    console.log(`📱 [${post.platformName}] ${post.character}: ${post.content}`);
}

// ฟังก์ชัน utility
function getRecentChatContext(messageCount) {
    const context = getContext();
    return context.chat?.slice(-messageCount) || [];
}

function getCurrentCharName() {
    const context = getContext();
    return context.characters[context.characterId]?.name || "{{char}}";
}

function shortenText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

function clearAllPosts() {
    extension_settings[extensionName].posts = [];
    saveSettings();
    updatePostsFeed();
    toastr.info('ล้างโพสต์ทั้งหมดแล้ว');
}

// ตรวจจับการส่งข้อความ
let messageCounter = 0;
function onChatMessageSent() {
    if (!extension_settings[extensionName]?.enabled) return;
    
    messageCounter++;
    
    if (messageCounter >= extension_settings[extensionName].autoPostFrequency) {
        setTimeout(() => {
            const platform = getRandomPlatform();
            const post = generatePost(platform, 'random');
            addNewPost(post);
            showPostNotification(post);
        }, 2000);
        messageCounter = 0;
    }
}

// ตรวจจับการตอบกลับของ AI
function onAiResponseGenerated() {
    if (!extension_settings[extensionName]?.enabled) return;
    
    const context = getContext();
    const lastMessage = context.chat?.[context.chat.length - 1];
    
    if (lastMessage && !lastMessage.is_user) {
        const response = lastMessage.mes;
        if (shouldCreatePostFromResponse(response)) {
            if (Math.random() > 0.6) {
                setTimeout(() => {
                    const platform = getRandomPlatform();
                    const context = shortenText(response, 100);
                    const charName = getCurrentCharName();
                    
                    const post = {
                        id: Date.now(),
                        content: `รู้สึกแบบนี้เลย... "${context}"`,
                        platform: platform,
                        platformName: platforms[platform].name,
                        platformIcon: platforms[platform].icon,
                        character: charName,
                        timestamp: new Date().toLocaleString('th-TH'),
                        likes: Math.floor(Math.random() * 100),
                        comments: Math.floor(Math.random() * 20),
                        shares: Math.floor(Math.random() * 10),
                        template: 'emotional'
                    };
                    
                    addNewPost(post);
                    showPostNotification(post);
                }, 3000);
            }
        }
    }
}

function shouldCreatePostFromResponse(response) {
    if (!response) return false;
    
    const emotionalIndicators = [
        'รู้สึก', 'คิดว่า', 'ไม่น่าเชื่อ', 'ประหลาดใจ', 'สุขใจ', 'เสียใจ',
        'โกรธ', 'กลัว', 'รัก', 'เกลียด', 'ตื่นเต้น', 'ดีใจ', 'เสียดาย'
    ];
    
    return emotionalIndicators.some(indicator => 
        response.toLowerCase().includes(indicator.toLowerCase())
    ) || response.length > 80;
}

// เริ่มต้น extension
jQuery(async () => {
    // รอจน SillyTavern โหลดเสร็จ
    let attempts = 0;
    const maxAttempts = 50;
    
    const waitForLoad = setInterval(() => {
        attempts++;
        
        if (getContext() && extension_settings) {
            clearInterval(waitForLoad);
            loadSettings();
            createUI();
            
            // ลงทะเบียน event listeners
            eventSource.on(event_types.MESSAGE_SENT, onChatMessageSent);
            eventSource.on(event_types.MESSAGE_RECEIVED, onAiResponseGenerated);
            
            console.log('📱 Social Media Posts Extension โหลดเสร็จแล้ว!');
        } else if (attempts >= maxAttempts) {
            clearInterval(waitForLoad);
            console.error('Social Media Posts Extension: Failed to load - SillyTavern context not found');
        }
    }, 100);
});

// Export สำหรับ testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generatePost,
        extractPostContext,
        loadSettings,
        saveSettings
    };
      }
