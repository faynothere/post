// Social Media Posts Extension for SillyTavern
// Based on SillyTavern extension standards

import { getContext, saveSettingsDebounced } from '../../../script.js';
import { extension_settings, renderExtensionTemplate } from '../../extensions.js';

const extensionName = 'socialMediaPosts';
const defaultSettings = {
    enabled: true,
    autoPostFrequency: 3,
    enabledPlatforms: ['twitter', 'facebook', 'instagram'],
    maxPosts: 20,
    enableNotifications: true,
    posts: []
};

// Platform configurations
const platforms = {
    'twitter': { name: 'Twitter', icon: '🐦', maxLength: 280 },
    'facebook': { name: 'Facebook', icon: '📘', maxLength: 5000 },
    'instagram': { name: 'Instagram', icon: '📷', maxLength: 2200 },
    'threads': { name: 'Threads', icon: '🧵', maxLength: 500 }
};

// Post templates
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
    ]
};

let messageCounter = 0;

// Load settings from localStorage
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || { ...defaultSettings };
    
    // Migrate from old storage if exists
    const oldPosts = localStorage.getItem(`${extensionName}_posts`);
    if (oldPosts && (!extension_settings[extensionName].posts || extension_settings[extensionName].posts.length === 0)) {
        extension_settings[extensionName].posts = JSON.parse(oldPosts);
    }
    
    // Ensure all settings exist
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = value;
        }
    }
}

// Save settings to SillyTavern's settings system
function saveSettings() {
    saveSettingsDebounced();
}

// Create the extension UI in settings
async function createSettings() {
    const settingsHtml = await renderExtensionTemplate(`scripts/extensions/third-party/${extensionName}`, 'settings.html', {
        settings: extension_settings[extensionName],
        platforms: platforms
    });
    
    $('#extensions_settings').append(settingsHtml);
    await loadPostsFeed();
    attachSettingsEvents();
}

// Load posts into the feed
async function loadPostsFeed() {
    const postsFeed = $('#socialMediaPostsFeed');
    if (postsFeed.length) {
        const postsHtml = await renderExtensionTemplate(`scripts/extensions/third-party/${extensionName}`, 'posts_feed.html', {
            posts: extension_settings[extensionName].posts || []
        });
        postsFeed.html(postsHtml);
    }
}

// Attach event handlers to settings
function attachSettingsEvents() {
    // Enable/disable toggle
    $('#socialMediaEnabled').on('change', function() {
        extension_settings[extensionName].enabled = this.checked;
        saveSettings();
    });

    // Auto-post frequency
    $('#socialMediaFrequency').on('change', function() {
        extension_settings[extensionName].autoPostFrequency = parseInt(this.value);
        saveSettings();
    });

    // Platform checkboxes
    $('.social-platform-checkbox').on('change', function() {
        updateEnabledPlatforms();
    });

    // Create post button
    $('#createSocialPost').on('click', function() {
        createManualPost();
    });

    // Clear posts button
    $('#clearSocialPosts').on('click', function() {
        clearAllPosts();
    });
}

// Update enabled platforms from checkboxes
function updateEnabledPlatforms() {
    const enabled = [];
    $('.social-platform-checkbox:checked').each(function() {
        enabled.push($(this).val());
    });
    extension_settings[extensionName].enabledPlatforms = enabled;
    saveSettings();
}

// Create a manual post
async function createManualPost() {
    const platform = $('#socialMediaPlatform').val();
    const templateType = $('#socialMediaTemplate').val();
    
    const post = generatePost(platform, templateType);
    addNewPost(post);
    showPostNotification(post);
    await loadPostsFeed();
}

// Generate a post
function generatePost(platform, templateType = 'random') {
    const recentChat = getRecentChatContext(3);
    const context = extractPostContext(recentChat);
    const charName = getCurrentCharName();
    
    const actualTemplateType = templateType === 'random' ? getRandomTemplateType() : templateType;
    let content = generatePostContent(context, actualTemplateType);
    
    // Trim to platform limits
    const maxLength = platforms[platform].maxLength;
    if (content.length > maxLength) {
        content = content.substring(0, maxLength - 3) + '...';
    }
    
    // Add platform-specific formatting
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

// Generate post content from template
function generatePostContent(context, templateType) {
    const templates = postTemplates[templateType];
    const template = templates[Math.floor(Math.random() * templates.length)];
    return template.replace('{{context}}', context);
}

// Extract context from recent chat
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

// Utility functions
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
    return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
}

function getRandomTemplateType() {
    const types = Object.keys(postTemplates);
    return types[Math.floor(Math.random() * types.length)];
}

function getRandomPlatform() {
    const enabled = extension_settings[extensionName].enabledPlatforms;
    return enabled.length > 0 ? enabled[Math.floor(Math.random() * enabled.length)] : 'twitter';
}

function generateHashtags() {
    const hashtags = [' #ชีวิตประจำวัน', ' #ความคิด', ' #ความรู้สึก'];
    return hashtags[Math.floor(Math.random() * hashtags.length)];
}

// Add new post to the list
function addNewPost(post) {
    if (!extension_settings[extensionName].posts) {
        extension_settings[extensionName].posts = [];
    }
    
    extension_settings[extensionName].posts.unshift(post);
    
    // Limit posts count
    if (extension_settings[extensionName].posts.length > extension_settings[extensionName].maxPosts) {
        extension_settings[extensionName].posts = extension_settings[extensionName].posts.slice(0, extension_settings[extensionName].maxPosts);
    }
    
    saveSettings();
}

// Show notification for new post
function showPostNotification(post) {
    if (extension_settings[extensionName].enableNotifications && toastr) {
        toastr.success(`New post on ${post.platformName}!`, "Social Media Posts", {
            timeOut: 3000,
            extendedTimeOut: 1000
        });
    }
}

// Clear all posts
async function clearAllPosts() {
    if (confirm('Are you sure you want to clear all posts? This action cannot be undone.')) {
        extension_settings[extensionName].posts = [];
        saveSettings();
        await loadPostsFeed();
        toastr.info('All posts have been cleared');
    }
}

// Handle incoming messages for auto-posting
function onMessageSent() {
    if (!extension_settings[extensionName]?.enabled) return;
    
    messageCounter++;
    
    if (messageCounter >= extension_settings[extensionName].autoPostFrequency) {
        setTimeout(() => {
            const platform = getRandomPlatform();
            const post = generatePost(platform, 'random');
            addNewPost(post);
            showPostNotification(post);
            loadPostsFeed();
        }, 2000);
        messageCounter = 0;
    }
}

// Handle AI responses for contextual posting
function onAiResponse() {
    if (!extension_settings[extensionName]?.enabled) return;
    
    const context = getContext();
    const lastMessage = context.chat?.[context.chat.length - 1];
    
    if (lastMessage && !lastMessage.is_user) {
        const response = lastMessage.mes;
        if (shouldCreatePostFromResponse(response)) {
            if (Math.random() > 0.6) {
                setTimeout(() => {
                    const platform = getRandomPlatform();
                    const charName = getCurrentCharName();
                    
                    const post = {
                        id: Date.now(),
                        content: `รู้สึกแบบนี้เลย... "${shortenText(response, 100)}"`,
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
                    loadPostsFeed();
                }, 3000);
            }
        }
    }
}

function shouldCreatePostFromResponse(response) {
    if (!response) return false;
    
    const emotionalIndicators = [
        'รู้สึก', 'คิดว่า', 'ไม่น่าเชื่อ', 'ประหลาดใจ', 'สุขใจ', 'เสียใจ',
        'โกรธ', 'กลัว', 'รัก', 'เกลียด', 'ตื่นเต้น'
    ];
    
    return emotionalIndicators.some(indicator => 
        response.toLowerCase().includes(indicator.toLowerCase())
    ) || response.length > 80;
}

// Initialize extension
jQuery(async () => {
    // Wait for SillyTavern to load completely
    if (!getContext()) {
        setTimeout(() => jQuery(async () => await initializeExtension()), 1000);
        return;
    }
    
    await initializeExtension();
});

async function initializeExtension() {
    try {
        loadSettings();
        await createSettings();
        
        // Register message handlers
        $(document).on('click', '#sendButt, #send_butt', onMessageSent);
        
        // Watch for AI responses
        const chatContainer = document.getElementById('chat');
        if (chatContainer) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1 && node.classList?.contains('mes') && !node.classList.contains('mes_user')) {
                                onAiResponse();
                            }
                        });
                    }
                });
            });
            
            observer.observe(chatContainer, {
                childList: true,
                subtree: true
            });
        }
        
        console.log('📱 Social Media Posts Extension loaded successfully!');
    } catch (error) {
        console.error('Failed to load Social Media Posts Extension:', error);
    }
            }
