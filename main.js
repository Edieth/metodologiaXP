function normalizePostReactions(post) {
    if (!Array.isArray(post.comentarios)) {
        post.comentarios = [];
    }

    const legacyLikes = Number(post.likes) || 0;
    if (!post.reacciones || typeof post.reacciones !== 'object') {
        post.reacciones = {
            likes: legacyLikes,
            love: 0,
            haha: 0
        };
    } else {
        post.reacciones = {
            likes: Number(post.reacciones.likes) || Number(post.reacciones.meGusta) || legacyLikes,
            love: Number(post.reacciones.love) || Number(post.reacciones.meEncanta) || 0,
            haha: Number(post.reacciones.haha) || Number(post.reacciones.meDivierte) || 0
        };
    }

    post.likes = post.reacciones.likes;
    return post;
}

function getFilteredPosts(sourcePosts, searchQuery) {
    const normalizedQuery = (searchQuery || '').trim().toLowerCase();

    if (!normalizedQuery) {
        return sourcePosts;
    }

    return sourcePosts.filter(post => {
        const searchableText = [
            post.name,
            post.message,
            ...(Array.isArray(post.comentarios) ? post.comentarios.map(comment => `${comment.autor || ''} ${comment.texto || ''}`) : [])
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return searchableText.includes(normalizedQuery);
    });
}

function getSortedPosts(sourcePosts, sortCriterion) {
    const sortedPosts = [...sourcePosts];
    const getTimestamp = post => Number(post.timestamp || post.id || 0);

    if (sortCriterion === 'oldest') {
        return sortedPosts.sort((a, b) => getTimestamp(a) - getTimestamp(b));
    }

    if (sortCriterion === 'most-liked') {
        return sortedPosts.sort((a, b) => {
            const reactionsA = (Number(a.reacciones?.likes) || Number(a.likes) || 0) + (Number(a.reacciones?.love) || 0) + (Number(a.reacciones?.haha) || 0);
            const reactionsB = (Number(b.reacciones?.likes) || Number(b.likes) || 0) + (Number(b.reacciones?.love) || 0) + (Number(b.reacciones?.haha) || 0);
            const likesDifference = reactionsB - reactionsA;
            return likesDifference || getTimestamp(b) - getTimestamp(a);
        });
    }

    return sortedPosts.sort((a, b) => getTimestamp(b) - getTimestamp(a));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getFilteredPosts, getSortedPosts, normalizePostReactions };
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {

    const postForm = document.getElementById('post-form');
    const studentNameInput = document.getElementById('student-name');
    const messageTextInput = document.getElementById('message-text');
    const feedContainer = document.getElementById('feed-container');
    const charCounter = document.getElementById('char-counter');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const summaryPostsCount = document.getElementById('summary-posts-count');
    const summaryLikesCount = document.getElementById('summary-likes-count');
    const summaryCommentsCount = document.getElementById('summary-comments-count');
    const MAX_CHARS = 200;

    let posts = (JSON.parse(localStorage.getItem('posts')) || []).map(normalizePostReactions);
    let searchQuery = '';
    let sortCriterion = 'recent';

    renderPosts();
    renderActivitySummary();

    messageTextInput.addEventListener('input', () => {
        const remaining = MAX_CHARS - messageTextInput.value.length;
        charCounter.textContent = remaining;
        charCounter.classList.toggle('char-counter-warning', remaining <= 20);
    });


    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        renderPosts();
    });

    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        searchQuery = searchInput.value.trim();
        renderPosts();
    });

    sortSelect.addEventListener('change', () => {
        sortCriterion = sortSelect.value;
        renderPosts();
    });

    postForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const name = studentNameInput.value.trim();
        const message = messageTextInput.value.trim();

        if (!name || !message) return;


        if (message.length > MAX_CHARS) return;

        const newPost = {
            id: Date.now(),
            name: name,
            message: message,
            timestamp: Date.now(),
            likes: 0,
            reacciones: {
                likes: 0,
                love: 0,
                haha: 0
            },
            comentarios: []
        };

        posts.unshift(newPost);


        localStorage.setItem('posts', JSON.stringify(posts));


        renderActivitySummary();
        renderPosts(newPost.id);


        postForm.reset();
        charCounter.textContent = MAX_CHARS;
        charCounter.classList.remove('char-counter-warning');
        studentNameInput.focus();
    });

    function renderPosts(newestId) {
        feedContainer.innerHTML = '';
        const filteredPosts = getFilteredPosts(posts, searchQuery);
        const visiblePosts = getSortedPosts(filteredPosts, sortCriterion);

        if (posts.length === 0) {
            feedContainer.innerHTML = `
                <div id="empty-state">
                    <p>Todavía no hay publicaciones.</p>
                    <span>Sé el primero en compartir algo </span>
                </div>
            `;
            return;
        }

        if (visiblePosts.length === 0) {
            feedContainer.innerHTML = `
                <div id="empty-state">
                    <p>No se encontraron publicaciones.</p>
                    <span>Prueba con otro nombre, palabra o comentario.</span>
                </div>
            `;
            return;
        }

        visiblePosts.forEach(post => {
            normalizePostReactions(post);
            const postElement = document.createElement('article');
            postElement.className = 'card';
            if (post.id === newestId) {
                postElement.classList.add('post-new');
            }

            const initials = getInitials(post.name);
            const avatarColor = getColorFromString(post.name);
            const timeLabel = getRelativeTime(post.timestamp || post.id);

            const comentarios = Array.isArray(post.comentarios) ? post.comentarios : [];
            const comentariosHTML = comentarios.length > 0
                ? comentarios.map(c => `
                    <div class="comment-item">
                        <div class="comment-meta">
                            <span class="comment-author">${escapeHTML(c.autor)}</span>
                            <span class="comment-time">· ${getRelativeTime(c.timestamp || c.id)}</span>
                            <button class="comment-edit-btn" data-post-id="${post.id}" data-comment-id="${c.id}" type="button" title="Editar comentario">Editar</button>
                            <button class="comment-delete-btn" data-post-id="${post.id}" data-comment-id="${c.id}" type="button" title="Eliminar comentario">Eliminar</button>
                        </div>
                        <p class="comment-text">${escapeHTML(c.texto)}</p>
                    </div>
                `).join('')
                : '<div class="no-comments-text">No hay comentarios aún.</div>';

            postElement.innerHTML = `
                <div class="post-row">
                    <div class="avatar" style="background-color: ${avatarColor};">${initials}</div>
                    <div class="card-body">
                        <div class="post-header">
                            <h5 class="card-title">${escapeHTML(post.name)}</h5>
                            <span class="post-time">· ${timeLabel}</span>
                            <button class="edit-btn" data-id="${post.id}" type="button" title="Editar publicación" aria-label="Editar publicación">Editar</button>
                            <button class="delete-btn" data-id="${post.id}" type="button" title="Eliminar publicación" aria-label="Eliminar publicación">Eliminar</button>
                        </div>
                        <p class="card-text">${escapeHTML(post.message)}</p>
                        <div class="post-actions">
                            <button class="reaction-btn like-btn reaction-btn--like" data-id="${post.id}" data-reaction="likes" title="Me gusta" aria-label="Reaccionar con Me gusta">
                                <span>👍</span> <span>Me gusta</span> <strong>(${post.reacciones.likes})</strong>
                            </button>
                            <button class="reaction-btn reaction-btn--love" data-id="${post.id}" data-reaction="love" title="Me encanta" aria-label="Reaccionar con Me encanta">
                                <span>❤️</span> <span>Me encanta</span> <strong>(${post.reacciones.love})</strong>
                            </button>
                            <button class="reaction-btn reaction-btn--haha" data-id="${post.id}" data-reaction="haha" title="Me divierte" aria-label="Reaccionar con Me divierte">
                                <span>😂</span> <span>Me divierte</span> <strong>(${post.reacciones.haha})</strong>
                            </button>
                        </div>
                        <div class="comments-section">
                            <div class="comments-header">Comentarios (${comentarios.length})</div>
                            <div class="comments-list">
                                ${comentariosHTML}
                            </div>
                            <form class="comment-form mt-2" data-post-id="${post.id}">
                                <div class="row g-2 mb-2">
                                    <div class="col-12 col-sm-4">
                                        <input type="text" class="form-control form-control-sm comment-author-input" placeholder="Tu nombre" required maxlength="40">
                                    </div>
                                    <div class="col-12 col-sm-8">
                                        <input type="text" class="form-control form-control-sm comment-text-input" placeholder="Escribe un comentario..." required maxlength="280">
                                    </div>
                                </div>
                                <div class="d-flex justify-content-end">
                                    <button type="submit" class="btn btn-sm btn-primary comment-submit-btn">Comentar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            feedContainer.appendChild(postElement);
        });

        feedContainer.querySelectorAll('.comment-form').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const postId = Number(form.dataset.postId);
                const authorInput = form.querySelector('.comment-author-input');
                const textInput = form.querySelector('.comment-text-input');

                const autor = authorInput.value.trim();
                const texto = textInput.value.trim();

                if (!autor || !texto) return;

                const post = posts.find(p => p.id === postId);
                if (!post) return;

                if (!Array.isArray(post.comentarios)) {
                    post.comentarios = [];
                }

                post.comentarios.push({
                    id: Date.now(),
                    autor: autor,
                    texto: texto,
                    timestamp: Date.now()
                });

                localStorage.setItem('posts', JSON.stringify(posts));
                renderActivitySummary();
                renderPosts();
            });
        });

        feedContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);

                const confirmed = window.confirm('¿Seguro que deseas eliminar esta publicación?');
                if (!confirmed) return;

                posts = posts.filter(p => p.id !== id);
                localStorage.setItem('posts', JSON.stringify(posts));
                renderActivitySummary();
                renderPosts();
            });
        });

        feedContainer.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);
                const reaction = e.currentTarget.dataset.reaction || 'likes';
                const post = posts.find(p => p.id === id);
                if (!post) return;

                normalizePostReactions(post);
                post.reacciones[reaction] = (Number(post.reacciones[reaction]) || 0) + 1;
                post.likes = post.reacciones.likes;

                localStorage.setItem('posts', JSON.stringify(posts));
                renderActivitySummary();
                renderPosts();
            });
        });

        feedContainer.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);
                const postElement = e.currentTarget.closest('.card-body');
                const textContainer = postElement.querySelector('.card-text');

                // Prevenir múltiples clics si ya está editando
                if (textContainer.querySelector('.edit-textarea')) return;

                const post = posts.find(p => p.id === id);
                if (!post) return;

                const originalText = post.message;

                textContainer.innerHTML = `
                    <textarea class="form-control edit-textarea mt-2 mb-2" maxlength="200">${originalText}</textarea>
                    <div class="edit-actions">
                        <button class="btn btn-sm btn-primary save-edit-btn">Guardar</button>
                        <button class="btn btn-sm btn-secondary cancel-edit-btn">Cancelar</button>
                        <span class="text-danger ms-2 d-none error-msg" style="font-size: 0.85rem;">El mensaje no puede estar vacío.</span>
                    </div>
                `;

                const textarea = textContainer.querySelector('.edit-textarea');
                textarea.focus();

                textContainer.querySelector('.cancel-edit-btn').addEventListener('click', () => {
                    renderPosts(); // Restaurar a vista normal
                });

                textContainer.querySelector('.save-edit-btn').addEventListener('click', () => {
                    const newText = textarea.value.trim();
                    const errorMsg = textContainer.querySelector('.error-msg');

                    if (!newText) {
                        textarea.classList.add('is-invalid');
                        errorMsg.classList.remove('d-none');
                        return;
                    }

                    if (newText.length > MAX_CHARS) {
                        textarea.classList.add('is-invalid');
                        errorMsg.textContent = `El mensaje no puede superar ${MAX_CHARS} caracteres.`;
                        errorMsg.classList.remove('d-none');
                        return;
                    }

                    post.message = newText;
                    localStorage.setItem('posts', JSON.stringify(posts));
                    renderActivitySummary();
                    renderPosts();
                });
            });
        });

        feedContainer.querySelectorAll('.comment-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = Number(e.currentTarget.dataset.postId);
                const commentId = Number(e.currentTarget.dataset.commentId);

                const confirmed = window.confirm('¿Seguro que deseas eliminar este comentario?');
                if (!confirmed) return;

                const post = posts.find(p => p.id === postId);
                if (post && post.comentarios) {
                    post.comentarios = post.comentarios.filter(c => c.id !== commentId);
                    localStorage.setItem('posts', JSON.stringify(posts));
                    renderActivitySummary();
                    renderPosts();
                }
            });
        });

        feedContainer.querySelectorAll('.comment-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = Number(e.currentTarget.dataset.postId);
                const commentId = Number(e.currentTarget.dataset.commentId);
                
                const commentElement = e.currentTarget.closest('.comment-item');
                const textContainer = commentElement.querySelector('.comment-text');

                // Prevenir múltiples clics si ya está editando
                if (textContainer.querySelector('.edit-textarea')) return;

                const post = posts.find(p => p.id === postId);
                if (!post) return;
                
                const comment = post.comentarios.find(c => c.id === commentId);
                if (!comment) return;

                const originalText = comment.texto;

                textContainer.innerHTML = `
                    <textarea class="form-control edit-textarea form-control-sm mt-1 mb-1" maxlength="280">${originalText}</textarea>
                    <div class="edit-actions comment-edit-actions">
                        <button class="btn btn-sm btn-primary save-comment-edit-btn">Guardar</button>
                        <button class="btn btn-sm btn-secondary cancel-comment-edit-btn">Cancelar</button>
                        <span class="text-danger ms-2 d-none error-msg" style="font-size: 0.75rem;">El comentario no puede estar vacío.</span>
                    </div>
                `;

                const textarea = textContainer.querySelector('.edit-textarea');
                textarea.focus();

                textContainer.querySelector('.cancel-comment-edit-btn').addEventListener('click', () => {
                    renderPosts(); // Restaurar vista original
                });

                textContainer.querySelector('.save-comment-edit-btn').addEventListener('click', () => {
                    const newText = textarea.value.trim();
                    const errorMsg = textContainer.querySelector('.error-msg');

                    if (!newText) {
                        textarea.classList.add('is-invalid');
                        errorMsg.classList.remove('d-none');
                        return;
                    }

                    // Mantiene el autor, ID y timestamp original intactos (Persistencia de metadatos)
                    comment.texto = newText;
                    localStorage.setItem('posts', JSON.stringify(posts));
                    renderPosts();
                });
            });
        });
    }

    function renderActivitySummary() {
        const totalPosts = posts.length;
        const totalReactions = posts.reduce((sum, post) => {
            const r = post.reacciones || {};
            const likes = Number(r.likes) || Number(post.likes) || 0;
            const love = Number(r.love) || 0;
            const haha = Number(r.haha) || 0;
            return sum + likes + love + haha;
        }, 0);
        const totalComments = posts.reduce(
            (sum, post) => sum + (Array.isArray(post.comentarios) ? post.comentarios.length : 0),
            0
        );

        summaryPostsCount.textContent = totalPosts;
        summaryLikesCount.textContent = totalReactions;
        summaryCommentsCount.textContent = totalComments;
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
}
