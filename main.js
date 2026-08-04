document.addEventListener('DOMContentLoaded', () => {

    const postForm = document.getElementById('post-form');
    const studentNameInput = document.getElementById('student-name');
    const messageTextInput = document.getElementById('message-text');
    const feedContainer = document.getElementById('feed-container');
    const charCounter = document.getElementById('char-counter');
    const MAX_CHARS = 280;

    let posts = JSON.parse(localStorage.getItem('posts')) || [];


    renderPosts();

    messageTextInput.addEventListener('input', () => {
        const remaining = MAX_CHARS - messageTextInput.value.length;
        charCounter.textContent = remaining;
        charCounter.classList.toggle('char-counter-warning', remaining <= 20);
    });


    postForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const name = studentNameInput.value.trim();
        const message = messageTextInput.value.trim();

        if (!name || !message) return;


        const newPost = {
            id: Date.now(),
            name: name,
            message: message,
            timestamp: Date.now()
        };

        posts.unshift(newPost);


        localStorage.setItem('posts', JSON.stringify(posts));


        renderPosts(newPost.id);


        postForm.reset();
        charCounter.textContent = MAX_CHARS;
        charCounter.classList.remove('char-counter-warning');
        studentNameInput.focus();
    });

    function renderPosts(newestId) {
        feedContainer.innerHTML = '';

        if (posts.length === 0) {
            feedContainer.innerHTML = `
                <div id="empty-state">
                    <p>Todavía no hay publicaciones.</p>
                    <span>Sé el primero en compartir algo 👋</span>
                </div>
            `;
            return;
        }

        posts.forEach(post => {
            const postElement = document.createElement('article');
            postElement.className = 'card';
            if (post.id === newestId) {
                postElement.classList.add('post-new');
            }

            const initials = getInitials(post.name);
            const avatarColor = getColorFromString(post.name);
            const timeLabel = getRelativeTime(post.timestamp || post.id);

            postElement.innerHTML = `
                <div class="post-row">
                    <div class="avatar" style="background-color: ${avatarColor};">${initials}</div>
                    <div class="card-body">
                        <div class="post-header">
                            <h5 class="card-title">${escapeHTML(post.name)}</h5>
                            <span class="post-time">· ${timeLabel}</span>
                            <button class="delete-btn" data-id="${post.id}" title="Eliminar" aria-label="Eliminar publicación">&times;</button>
                        </div>
                        <p class="card-text">${escapeHTML(post.message)}</p>
                    </div>
                </div>
            `;

            feedContainer.appendChild(postElement);
        });

        feedContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);
                posts = posts.filter(p => p.id !== id);
                localStorage.setItem('posts', JSON.stringify(posts));
                renderPosts();
            });
        });
    }

    function getInitials(name) {
        const parts = name.trim().split(/\s+/);
        const initials = parts.slice(0, 2).map(p => p[0].toUpperCase());
        return initials.join('');
    }


    function getColorFromString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 65%, 55%)`;
    }


    function getRelativeTime(timestamp) {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);

    let relative;

    if (diffSeconds < 30) {
        relative = "ahora mismo";
    } else if (diffSeconds < 60) {
        relative = `hace ${diffSeconds} s`;
    } else {
        const diffMinutes = Math.floor(diffSeconds / 60);

        if (diffMinutes < 60) {
            relative = `hace ${diffMinutes} min`;
        } else {
            const diffHours = Math.floor(diffMinutes / 60);

            if (diffHours < 24) {
                relative = `hace ${diffHours} h`;
            } else {
                const diffDays = Math.floor(diffHours / 24);
                relative = `hace ${diffDays} d`;
            }
        }
    }

    const fechaHora = new Date(timestamp).toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "short"
    });

    return `${relative} (${fechaHora})`;
}


    function escapeHTML(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
