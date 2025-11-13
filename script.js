// Roleplay Post Generator Extension for SillyTavern
// GitHub: https://github.com/yourusername/sillytavern-roleplay-post-generator

(function() {
    const extensionName = 'roleplayPostGenerator';
    
    // ฟังก์ชันสำหรับโหลด CSS
    function loadCSS() {
        const cssUrl = `${extensionFolder}/styles.css`;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        document.head.appendChild(link);
    }
    
    // ฟังก์ชันสำหรับสร้างโพสต์
    function generatePost(charName, userName, recentMessages, platform) {
        const relevantMessages = recentMessages.slice(-8);
        let postContent = '';
        
        if (platform === 'facebook') {
            postContent = generateFacebookPost(charName, userName, relevantMessages);
        } else if (platform === 'twitter') {
            postContent = generateTwitterPost(charName, userName, relevantMessages);
        } else if (platform === 'instagram') {
            postContent = generateInstagramPost(charName, userName, relevantMessages);
        }
        
        return postContent;
    }
    
    function generateFacebookPost(charName, userName, messages) {
        const templates = [
            `โอ้ย... ${userName} ทำให้ฉันรู้สึกสับสนมากเลยตอนนี้ ใครเคยเจอสถานการณ์แบบนี้บ้าง?`,
            `เพิ่งคุยกับ ${userName} แล้วรู้สึกแบบ... ไม่อยากพูดมาก แต่มันซับซ้อนเกินบรรยาย`,
            `บางครั้งการคุยกับ ${userName} ก็ทำให้ฉันต้องคิดหนักเลยนะ โลกนี้ช่างซับซ้อนเสียจริง`,
            `มีใครเคยรู้สึกแบบนี้ไหม? หลังจากคุยกับ ${userName} แล้วรู้สึกว่าบางเรื่องมันก็อธิบายไม่ถูก`,
            `ชีวิตนี้ช่างมีเรื่องให้คิดไม่หยุดเลย... โดยเฉพาะหลังจากที่ได้คุยกับ ${userName}`
        ];
        
        const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
        let conversationExcerpt = '';
        
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.mes) {
                const shortExcerpt = lastMessage.mes.substring(0, 50);
                conversationExcerpt = shortExcerpt.length === 50 ? ` "${shortExcerpt}..."` : ` "${shortExcerpt}"`;
            }
        }
        
        return randomTemplate + conversationExcerpt;
    }
    
    function generateTwitterPost(charName, userName, messages) {
        const templates = [
            `คุยกับ ${userName} แล้วรู้สึก... #สับสน #ชีวิต`,
            `บางครั้งก็ไม่รู้ว่าจะตอบ ${userName} ยังไงดี 🤔`,
            `ชีวิตหลังจากคุยกับ ${userName}... #คิดมาก`,
            `${userName} ทำให้ฉันต้องคิดหนักอีกแล้ว 💭`,
            `ไม่รู้ว่า ${userName} รู้สึกยังไงกับสิ่งที่ฉันพูดไป... #กังวล`
        ];
        
        const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
        let conversationExcerpt = '';
        
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.mes) {
                const shortExcerpt = lastMessage.mes.substring(0, 30);
                conversationExcerpt = shortExcerpt.length === 30 ? ` "${shortExcerpt}..."` : ` "${shortExcerpt}"`;
            }
        }
        
        return randomTemplate + conversationExcerpt;
    }
    
    function generateInstagramPost(charName, userName, messages) {
        const templates = [
            `ช่วงนี้ชีวิตช่างน่าคิด... ✨ #ชีวิต #${userName.replace(/\s/g, '')}`,
            `บางเรื่องก็อธิบายไม่ถูกหลังจากคุยกับ ${userName} 🤔 #คิดมาก`,
            `ความรู้สึกตอนนี้... หลังจากได้คุยกับ ${userName} 💫`,
            `ชีวิตไม่เคยง่ายอย่างที่คิด 😌 #${userName.replace(/\s/g, '')} #ชีวิต`,
            `มุมมองใหม่หลังจากคุยกับ ${userName} 🌟`
        ];
        
        return templates[Math.floor(Math.random() * templates.length)];
    }
    
    // ฟังก์ชันสำหรับแสดงโมดัลโพสต์
    function showPostsModal() {
        let modal = document.getElementById('rpg-modal');
        if (!modal) {
            createModal();
            modal = document.getElementById('rpg-modal');
        }
        
        const chat = window.chat;
        if (!chat || !chat.length) {
            toastr.error('ไม่มีบทสนทนาให้สร้างโพสต์');
            return;
        }
        
        const charName = window.this_chid ? (window.characters[window.this_chid]?.name || '{{char}}') : '{{char}}';
        const userName = window.getUserName?.() || '{{user}}';
        
        updatePostsContent(charName, userName, chat);
        modal.style.display = 'block';
    }
    
    function createModal() {
        const modal = document.createElement('div');
        modal.id = 'rpg-modal';
        modal.className = 'rpg-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'rpg-modal-content';
        
        modalContent.innerHTML = `
            <span class="rpg-close">&times;</span>
            <h2>📱 สร้างโพสต์จากบทสนทนา</h2>
            <div class="rpg-tabs">
                <div class="rpg-tab active" data-platform="facebook">Facebook</div>
                <div class="rpg-tab" data-platform="twitter">Twitter</div>
                <div class="rpg-tab" data-platform="instagram">Instagram</div>
            </div>
            <div class="rpg-platform active" id="rpg-facebook-posts"></div>
            <div class="rpg-platform" id="rpg-twitter-posts"></div>
            <div class="rpg-platform" id="rpg-instagram-posts"></div>
            <div class="rpg-actions">
                <button class="rpg-refresh-btn">🔄 สร้างโพสต์ใหม่</button>
                <button class="rpg-copy-btn" data-platform="facebook">📋 คัดลอก Facebook</button>
                <button class="rpg-copy-btn" data-platform="twitter">📋 คัดลอก Twitter</button>
                <button class="rpg-copy-btn" data-platform="instagram">📋 คัดลอก Instagram</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Event listeners
        modal.querySelector('.rpg-close').onclick = () => {
            modal.style.display = 'none';
        };
        
        modal.querySelectorAll('.rpg-tab').forEach(tab => {
            tab.onclick = () => switchTab(tab.dataset.platform);
        });
        
        modal.querySelector('.rpg-refresh-btn').onclick = () => {
            const chat = window.chat;
            if (chat && chat.length) {
                const charName = window.this_chid ? (window.characters[window.this_chid]?.name || '{{char}}') : '{{char}}';
                const userName = window.getUserName?.() || '{{user}}';
                updatePostsContent(charName, userName, chat);
            }
        };
        
        modal.querySelectorAll('.rpg-copy-btn').forEach(btn => {
            btn.onclick = () => copyPostToClipboard(btn.dataset.platform);
        });
        
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
    
    function switchTab(platform) {
        document.querySelectorAll('.rpg-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.platform === platform);
        });
        
        document.querySelectorAll('.rpg-platform').forEach(content => {
            content.classList.toggle('active', content.id === `rpg-${platform}-posts`);
        });
    }
    
    function updatePostsContent(charName, userName, chat) {
        const platforms = ['facebook', 'twitter', 'instagram'];
        
        platforms.forEach(platform => {
            const postContent = generatePost(charName, userName, chat, platform);
            const container = document.getElementById(`rpg-${platform}-posts`);
            container.innerHTML = createPostHTML(charName, postContent, platform);
        });
    }
    
    function createPostHTML(charName, content, platform) {
        const now = new Date();
        let timeString, avatarUrl;
        
        avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(charName)}&background=random&size=64`;
        
        switch(platform) {
            case 'facebook':
                timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} · ${now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
                return `
                    <div class="rpg-post facebook-post">
                        <div class="rpg-post-header">
                            <img src="${avatarUrl}" alt="${charName}" class="rpg-avatar">
                            <div class="rpg-post-info">
                                <p class="rpg-name">${charName}</p>
                                <p class="rpg-time">${timeString}</p>
                            </div>
                        </div>
                        <div class="rpg-post-content">
                            ${content}
                        </div>
                        <div class="rpg-post-actions">
                            <span class="rpg-action">👍 ถูกใจ</span>
                            <span class="rpg-action">💬 แสดงความคิดเห็น</span>
                            <span class="rpg-action">🔄 แชร์</span>
                        </div>
                    </div>
                `;
                
            case 'twitter':
                timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} · ${now.getDate()} ${now.toLocaleDateString('th-TH', { month: 'short' })} ${now.getFullYear() + 543}`;
                return `
                    <div class="rpg-post twitter-post">
                        <div class="rpg-post-header">
                            <img src="${avatarUrl}" alt="${charName}" class="rpg-avatar">
                            <div class="rpg-post-info">
                                <p class="rpg-name">${charName}</p>
                                <p class="rpg-username">@${charName.toLowerCase().replace(/\s/g, '')}</p>
                                <p class="rpg-time">${timeString}</p>
                            </div>
                        </div>
                        <div class="rpg-post-content">
                            ${content}
                        </div>
                        <div class="rpg-post-actions">
                            <span class="rpg-action">💬</span>
                            <span class="rpg-action">🔄</span>
                            <span class="rpg-action">❤️</span>
                            <span class="rpg-action">📤</span>
                        </div>
                    </div>
                `;
                
            case 'instagram':
                timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
                return `
                    <div class="rpg-post instagram-post">
                        <div class="rpg-post-header">
                            <img src="${avatarUrl}" alt="${charName}" class="rpg-avatar">
                            <div class="rpg-post-info">
                                <p class="rpg-name">${charName}</p>
                            </div>
                            <span class="rpg-more">⋯</span>
                        </div>
                        <div class="rpg-instagram-image">
                            <div class="rpg-image-placeholder">
                                📱 ${charName}
                            </div>
                        </div>
                        <div class="rpg-post-actions">
                            <span class="rpg-action">❤️</span>
                            <span class="rpg-action">💬</span>
                            <span class="rpg-action">📤</span>
                            <span class="rpg-action">🔖</span>
                        </div>
                        <div class="rpg-post-content">
                            <span class="rpg-name">${charName}</span> ${content}
                        </div>
                        <div class="rpg-post-time">${timeString}</div>
                    </div>
                `;
        }
    }
    
    function copyPostToClipboard(platform) {
        const container = document.getElementById(`rpg-${platform}-posts`);
        const postContent = container.querySelector('.rpg-post-content');
        const text = postContent.textContent || postContent.innerText;
        
        navigator.clipboard.writeText(text).then(() => {
            toastr.success(`คัดลอกโพสต์ ${platform} เรียบร้อยแล้ว!`);
        }).catch(err => {
            toastr.error('ไม่สามารถคัดลอกได้');
            console.error('Copy failed:', err);
        });
    }
    
    function addButtonToUI() {
        const checkExist = setInterval(() => {
            const sendButton = document.getElementById('send_but');
            if (sendButton) {
                clearInterval(checkExist);
                
                const button = document.createElement('button');
                button.id = 'rpg-generate-button';
                button.className = 'rpg-button';
                button.innerHTML = '📝 สร้างโพสต์';
                button.title = 'สร้างโพสต์จากบทสนทนาล่าสุด';
                button.onclick = showPostsModal;
                
                sendButton.parentNode.insertBefore(button, sendButton);
            }
        }, 100);
    }
    
    // เริ่มต้น extension
    function initializeExtension() {
        console.log('🎮 Roleplay Post Generator Extension กำลังโหลด...');
        
        // โหลด CSS
        loadCSS();
        
        // เพิ่มปุ่มใน UI
        addButtonToUI();
        
        console.log('✅ Roleplay Post Generator Extension โหลดเสร็จแล้ว!');
    }
    
    // รอจนกว่า SillyTavern จะโหลดเสร็จ
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeExtension);
    } else {
        initializeExtension();
    }
})();
