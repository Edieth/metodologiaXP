const TAG_OPTIONS = ['General', 'Estudio', 'Evento', 'Ayuda'];

function normalizePostTag(post) {
    const tagValue = String(post?.tag || post?.etiqueta || 'General').trim();
    if (!tagValue) return 'General';

    const match = TAG_OPTIONS.find(option => option.toLowerCase() === tagValue.toLowerCase());
    return match || 'General';
}

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
            likes: Math.max(0, Number(post.reacciones.likes) || Number(post.reacciones.meGusta) || 0),
            love: Math.max(0, Number(post.reacciones.love) || Number(post.reacciones.meEncanta) || 0),
            haha: Math.max(0, Number(post.reacciones.haha) || Number(post.reacciones.meDivierte) || 0)
        };
    }

    if (typeof post.userReaction === 'undefined') {
        post.userReaction = null;
    }

    post.tag = normalizePostTag(post);
    post.favorite = post.favorite === true;
    post.likes = post.reacciones.likes;
    return post;
}

function getFilteredPosts(sourcePosts, searchQuery, selectedTag = 'Todas', favoritesOnly = false) {
    const posts = Array.isArray(sourcePosts) ? sourcePosts : [];
    const normalizedQuery = (searchQuery || '').trim().toLowerCase();
    const normalizedTag = selectedTag === 'Todas' ? null : normalizePostTag({ tag: selectedTag });

    let filteredPosts = posts;

    if (favoritesOnly) {
        filteredPosts = filteredPosts.filter(post => post.favorite === true);
    }

    if (normalizedTag) {
        filteredPosts = filteredPosts.filter(post => normalizePostTag(post) === normalizedTag);
    }

    if (!normalizedQuery) {
        return filteredPosts;
    }

    return filteredPosts.filter(post => {
        const searchableText = [
            post.name,
            post.message,
            ...(Array.isArray(post.comentarios) ? post.comentarios.flatMap(comment => [
                comment.autor || '',
                comment.texto || '',
                ...(Array.isArray(comment.respuestas) ? comment.respuestas.map(r => `${r.autor || ''} ${r.texto || ''}`) : [])
            ]) : [])
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return searchableText.includes(normalizedQuery);
    });
}

function togglePostFavorite(sourcePosts, postId) {
    const post = sourcePosts.find(item => item.id === postId);
    if (!post) return null;

    post.favorite = post.favorite !== true;
    return post;
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

function normalizeImportedComment(comment, index) {
    if (!comment || typeof comment !== 'object') {
        throw new Error(`El comentario ${index + 1} tiene un formato inválido.`);
    }

    const texto = typeof comment.texto === 'string' ? comment.texto.trim() : '';
    const autor = typeof comment.autor === 'string' ? comment.autor.trim() : '';

    if (!texto || !autor) {
        throw new Error(`El comentario ${index + 1} necesita autor y texto.`);
    }

    const respuestas = Array.isArray(comment.respuestas)
        ? comment.respuestas.map((respuesta, respuestaIndex) => normalizeImportedReply(respuesta, respuestaIndex))
        : [];

    return {
        id: Number(comment.id) || Date.now() + index,
        autor,
        texto,
        timestamp: Number(comment.timestamp) || Date.now() + index,
        respuestas
    };
}

function normalizeImportedReply(reply, index) {
    if (!reply || typeof reply !== 'object') {
        throw new Error(`La respuesta ${index + 1} tiene un formato inválido.`);
    }

    const texto = typeof reply.texto === 'string' ? reply.texto.trim() : '';
    const autor = typeof reply.autor === 'string' ? reply.autor.trim() : '';

    if (!texto || !autor) {
        throw new Error(`La respuesta ${index + 1} necesita autor y texto.`);
    }

    return {
        id: Number(reply.id) || Date.now() + index,
        autor,
        texto,
        timestamp: Number(reply.timestamp) || Date.now() + index
    };
}

function normalizeImportedReactions(post, index) {
    const rawReacciones = post?.reacciones && typeof post.reacciones === 'object' ? post.reacciones : {};
    const reactionValues = {
        likes: Number(rawReacciones.likes ?? rawReacciones.meGusta ?? post?.likes ?? 0) || 0,
        love: Number(rawReacciones.love ?? rawReacciones.meEncanta ?? 0) || 0,
        haha: Number(rawReacciones.haha ?? rawReacciones.meDivierte ?? 0) || 0
    };

    return {
        likes: Math.max(0, Number(reactionValues.likes) || 0),
        love: Math.max(0, Number(reactionValues.love) || 0),
        haha: Math.max(0, Number(reactionValues.haha) || 0)
    };
}

function normalizeImportedPosts(rawData) {
    if (rawData === null || typeof rawData === 'undefined') {
        throw new Error('El archivo está vacío.');
    }

    const candidate = Array.isArray(rawData) ? rawData : (rawData && typeof rawData === 'object' && Array.isArray(rawData.posts) ? rawData.posts : null);
    if (!candidate) {
        throw new Error('El archivo JSON no contiene una lista válida de publicaciones.');
    }

    return candidate.map((post, index) => {
        if (!post || typeof post !== 'object') {
            throw new Error(`La publicación ${index + 1} no tiene un formato válido.`);
        }

        const name = typeof post.name === 'string' ? post.name.trim() : '';
        const message = typeof post.message === 'string' ? post.message.trim() : '';

        if (!name || !message) {
            throw new Error(`La publicación ${index + 1} necesita nombre y mensaje.`);
        }

        const comentarios = Array.isArray(post.comentarios)
            ? post.comentarios.map((comment, commentIndex) => normalizeImportedComment(comment, commentIndex))
            : [];

        const reacciones = normalizeImportedReactions(post, index);
        const userReactionValue = typeof post.userReaction === 'string' && ['likes', 'love', 'haha'].includes(post.userReaction)
            ? post.userReaction
            : null;

        return normalizePostReactions({
            id: Number(post.id) || Date.now() + index,
            name,
            message,
            timestamp: Number(post.timestamp) || Date.now() + index,
            likes: Number(post.likes) || reacciones.likes,
            tag: post.tag || post.etiqueta || 'General',
            favorite: Boolean(post.favorite),
            reacciones,
            comentarios,
            userReaction: userReactionValue
        });
    });
}

function exportPostsAsJson(posts) {
    const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        posts: (Array.isArray(posts) ? posts : []).map(post => normalizePostReactions({ ...post }))
    };

    return JSON.stringify(payload, null, 2);
}

const DRAFT_STORAGE_KEY = 'postDraft';

function saveDraftToStorage(storage, draft) {
    if (draft && (draft.name?.trim() || draft.message?.trim())) {
        storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
            name: draft.name || '',
            message: draft.message || ''
        }));
    } else {
        storage.removeItem(DRAFT_STORAGE_KEY);
    }
}

function loadDraftFromStorage(storage) {
    const saved = storage.getItem(DRAFT_STORAGE_KEY);
    if (!saved) return null;
    try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
            return {
                name: typeof parsed.name === 'string' ? parsed.name : '',
                message: typeof parsed.message === 'string' ? parsed.message : ''
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getFilteredPosts,
        getSortedPosts,
        normalizePostReactions,
        normalizeImportedPosts,
        exportPostsAsJson,
        togglePostFavorite,
        saveDraftToStorage,
        loadDraftFromStorage,
        DRAFT_STORAGE_KEY
    };
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {

    const postForm = document.getElementById('post-form');
    const studentNameInput = document.getElementById('student-name');
    const messageTextInput = document.getElementById('message-text');
    const discardDraftBtn = document.getElementById('discard-draft-btn');
    const feedContainer = document.getElementById('feed-container');
    const charCounter = document.getElementById('char-counter');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const tagFilter = document.getElementById('tag-filter');
    const favoritesOnlyFilter = document.getElementById('favorites-only-filter');
    const postTagSelect = document.getElementById('post-tag');
    const exportBackupBtn = document.getElementById('export-backup-btn');
    const importBackupBtn = document.getElementById('import-backup-btn');
    const importBackupInput = document.getElementById('import-backup-input');
    const backupMessage = document.getElementById('backup-message');
    const summaryPostsCount = document.getElementById('summary-posts-count');
    const summaryLikesCount = document.getElementById('summary-likes-count');
    const summaryCommentsCount = document.getElementById('summary-comments-count');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageIndicator = document.getElementById('page-indicator');
    const MAX_CHARS = 200;

    let posts = (JSON.parse(localStorage.getItem('posts')) || []).map(normalizePostReactions);
    let searchQuery = '';
    let sortCriterion = 'recent';
    let selectedTag = 'Todas';
    let favoritesOnly = false;
    let currentPage = 1;
    const PAGE_SIZE = 5;

    function updateCharCounter() {
        if (!charCounter || !messageTextInput) return;
        const remaining = MAX_CHARS - messageTextInput.value.length;
        charCounter.textContent = remaining;
        charCounter.classList.toggle('char-counter-warning', remaining <= 20);
    }

    function handleSaveDraft() {
        saveDraftToStorage(localStorage, {
            name: studentNameInput.value,
            message: messageTextInput.value
        });
    }

    function handleLoadDraft() {
        const draft = loadDraftFromStorage(localStorage);
        if (draft) {
            studentNameInput.value = draft.name;
            messageTextInput.value = draft.message;
        }
        updateCharCounter();
    }

    function handleClearDraft() {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    function showBackupMessage(message, isError = false) {
        if (!backupMessage) {
            window.alert(message);
            return;
        }

        backupMessage.textContent = message;
        backupMessage.classList.toggle('backup-message--error', isError);
        backupMessage.classList.toggle('backup-message--success', !isError);
    }

    function handleExportBackup() {
        const json = exportPostsAsJson(posts);
        const blob = new Blob([json], { type: 'application/json' });
        const fileUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        link.href = fileUrl;
        link.download = `muro-respaldo-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(fileUrl);

        showBackupMessage('Respaldo exportado correctamente.');
    }

    async function handleImportBackup(event) {
        const [selectedFile] = event.target.files || [];
        if (!selectedFile) return;

        try {
            const fileText = await selectedFile.text();
            const parsed = JSON.parse(fileText);
            const importedPosts = normalizeImportedPosts(parsed);
            const confirmed = window.confirm('¿Deseas reemplazar los datos actuales con este respaldo?');

            if (!confirmed) {
                showBackupMessage('Importación cancelada. Los datos actuales se mantienen.');
                event.target.value = '';
                return;
            }

            posts = importedPosts;
            localStorage.setItem('posts', JSON.stringify(posts));
            currentPage = 1;
            renderActivitySummary();
            renderPosts();
            showBackupMessage(`Respaldo importado correctamente: ${posts.length} publicaciones.`);
        } catch (error) {
            showBackupMessage(error?.message || 'El archivo no es válido o está corrupto.', true);
        } finally {
            event.target.value = '';
        }
    }

    handleLoadDraft();
    renderPosts();
    renderActivitySummary();

    if (exportBackupBtn) {
        exportBackupBtn.addEventListener('click', handleExportBackup);
    }

    if (importBackupBtn) {
        importBackupBtn.addEventListener('click', () => importBackupInput?.click());
    }

    if (importBackupInput) {
        importBackupInput.addEventListener('change', handleImportBackup);
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPosts();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            currentPage++;
            renderPosts();
        });
    }

    studentNameInput.addEventListener('input', handleSaveDraft);

    messageTextInput.addEventListener('input', () => {
        updateCharCounter();
        handleSaveDraft();
    });

    if (discardDraftBtn) {
        discardDraftBtn.addEventListener('click', () => {
            studentNameInput.value = '';
            messageTextInput.value = '';
            handleClearDraft();
            updateCharCounter();
            studentNameInput.focus();
        });
    }

    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        currentPage = 1;
        renderPosts();
    });

    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        searchQuery = searchInput.value.trim();
        currentPage = 1;
        renderPosts();
    });

    sortSelect.addEventListener('change', () => {
        sortCriterion = sortSelect.value;
        currentPage = 1;
        renderPosts();
    });

    tagFilter.addEventListener('change', () => {
        selectedTag = tagFilter.value;
        currentPage = 1;
        renderPosts();
    });

    favoritesOnlyFilter.addEventListener('change', () => {
        favoritesOnly = favoritesOnlyFilter.checked;
        currentPage = 1;
        renderPosts();
    });

    postForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const name = studentNameInput.value.trim();
        const message = messageTextInput.value.trim();
        const tag = normalizePostTag({ tag: postTagSelect.value });

        if (!name || !message) return;

        if (message.length > MAX_CHARS) return;

        const newPost = {
            id: Date.now(),
            name: name,
            message: message,
            timestamp: Date.now(),
            likes: 0,
            tag: tag,
            reacciones: {
                likes: 0,
                love: 0,
                haha: 0
            },
            comentarios: [],
            favorite: false
        };

        posts.unshift(newPost);

        localStorage.setItem('posts', JSON.stringify(posts));

        handleClearDraft();

        currentPage = 1;
        renderActivitySummary();
        renderPosts(newPost.id);

        postForm.reset();
        postTagSelect.value = 'General';
        updateCharCounter();
        studentNameInput.focus();
    });

    function renderPosts(newestId) {
        feedContainer.innerHTML = '';
        const filteredPosts = getFilteredPosts(posts, searchQuery, selectedTag, favoritesOnly);
        const visiblePosts = getSortedPosts(filteredPosts, sortCriterion);

        const totalElements = visiblePosts.length;
        const totalPages = Math.ceil(totalElements / PAGE_SIZE) || 1;

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = currentPage * PAGE_SIZE;
        const paginatedPosts = visiblePosts.slice(startIndex, endIndex);

        if (pageIndicator) pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;

        if (posts.length === 0) {
            feedContainer.innerHTML = `
                <div id="empty-state">
                    <p>Todavía no hay publicaciones.</p>
                    <span>Sé el primero en compartir algo </span>
                </div>
            `;
            return;
        }

        if (paginatedPosts.length === 0) {
            feedContainer.innerHTML = `
                <div id="empty-state">
                    <p>No se encontraron publicaciones.</p>
                    <span>Prueba con otro nombre, palabra o comentario.</span>
                </div>
            `;
            return;
        }

        paginatedPosts.forEach(post => {
            normalizePostReactions(post);
            const postElement = document.createElement('article');
            postElement.className = 'card';
            postElement.classList.toggle('post-favorite', post.favorite === true);
            if (post.id === newestId) {
                postElement.classList.add('post-new');
            }

            const initials = getInitials(post.name);
            const avatarColor = getColorFromString(post.name);
            const timeLabel = getRelativeTime(post.timestamp || post.id);
            const tagLabel = normalizePostTag(post);

            const comentarios = Array.isArray(post.comentarios) ? post.comentarios : [];
            const comentariosHTML = comentarios.length > 0
                ? comentarios.map(c => {
                    const respuestas = Array.isArray(c.respuestas) ? c.respuestas : [];
                    const respuestasHTML = respuestas.map(r => `
                        <div class="reply-item mb-2">
                            <div class="comment-meta">
                                <span class="comment-author">${escapeHTML(r.autor)}</span>
                                <span class="comment-time">· ${getRelativeTime(r.timestamp || r.id)}</span>
                            </div>
                            <p class="comment-text m-0">${escapeHTML(r.texto)}</p>
                        </div>
                    `).join('');

                    return `
                    <div class="comment-item">
                        <div class="comment-meta">
                            <span class="comment-author">${escapeHTML(c.autor)}</span>
                            <span class="comment-time">· ${getRelativeTime(c.timestamp || c.id)}</span>
                            <button class="comment-reply-btn" data-post-id="${post.id}" data-comment-id="${c.id}" type="button" title="Responder comentario">Responder</button>
                            <button class="comment-edit-btn" data-post-id="${post.id}" data-comment-id="${c.id}" type="button" title="Editar comentario">Editar</button>
                            <button class="comment-delete-btn" data-post-id="${post.id}" data-comment-id="${c.id}" type="button" title="Eliminar comentario">Eliminar</button>
                        </div>
                        <p class="comment-text">${escapeHTML(c.texto)}</p>
                        
                        <div class="replies-section ms-4 border-start border-2 ps-3 mt-2">
                            ${respuestasHTML}
                            <form class="reply-form mt-2 d-none" data-post-id="${post.id}" data-comment-id="${c.id}">
                                <div class="row g-2 mb-2">
                                    <div class="col-12 col-sm-4">
                                        <input type="text" class="form-control form-control-sm reply-author-input" placeholder="Tu nombre" required maxlength="40">
                                    </div>
                                    <div class="col-12 col-sm-8">
                                        <input type="text" class="form-control form-control-sm reply-text-input" placeholder="Escribe una respuesta..." required maxlength="280">
                                    </div>
                                </div>
                                <div class="d-flex justify-content-end gap-2">
                                    <button type="button" class="btn btn-sm btn-secondary cancel-reply-btn" style="border-radius: 9999px; padding: 4px 14px; font-size: 0.8rem; font-weight: 700;">Cancelar</button>
                                    <button type="submit" class="btn btn-sm btn-primary comment-submit-btn">Responder</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `}).join('')
                : '<div class="no-comments-text">No hay comentarios aún.</div>';

            postElement.innerHTML = `
                <div class="post-row">
                    <div class="avatar" style="background-color: ${avatarColor};">${initials}</div>
                    <div class="card-body">
                        <div class="post-header">
                            <h5 class="card-title">${escapeHTML(post.name)}</h5>
                            <span class="post-time">· ${timeLabel}</span>
                            <button class="favorite-btn ${post.favorite ? 'active' : ''}" data-id="${post.id}" type="button" aria-pressed="${post.favorite}" title="${post.favorite ? 'Quitar de Favoritos' : 'Marcar como favorita'}" aria-label="${post.favorite ? 'Quitar de Favoritos' : 'Marcar como favorita'}">${post.favorite ? '★ Favorita' : '☆ Marcar favorita'}</button>
                            <button class="edit-btn" data-id="${post.id}" type="button" title="Editar publicación" aria-label="Editar publicación">Editar</button>
                            <button class="delete-btn" data-id="${post.id}" type="button" title="Eliminar publicación" aria-label="Eliminar publicación">Eliminar</button>
                        </div>
                        <span class="post-tag post-tag--${tagLabel.toLowerCase()}">${tagLabel}</span>
                        <p class="card-text">${escapeHTML(post.message)}</p>
                        <div class="post-actions">
                            <button class="reaction-btn like-btn reaction-btn--like ${post.userReaction === 'likes' ? 'active' : ''}" data-id="${post.id}" data-reaction="likes" title="Me gusta" aria-label="Reaccionar con Me gusta">
                                <span>👍</span> <span>Me gusta</span> <strong>(${post.reacciones.likes})</strong>
                            </button>
                            <button class="reaction-btn reaction-btn--love ${post.userReaction === 'love' ? 'active' : ''}" data-id="${post.id}" data-reaction="love" title="Me encanta" aria-label="Reaccionar con Me encanta">
                                <span>❤️</span> <span>Me encanta</span> <strong>(${post.reacciones.love})</strong>
                            </button>
                            <button class="reaction-btn reaction-btn--haha ${post.userReaction === 'haha' ? 'active' : ''}" data-id="${post.id}" data-reaction="haha" title="Me divierte" aria-label="Reaccionar con Me divierte">
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

        feedContainer.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);
                const updatedPost = togglePostFavorite(posts, id);
                if (!updatedPost) return;

                localStorage.setItem('posts', JSON.stringify(posts));
                renderPosts();
            });
        });

        feedContainer.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);
                const selectedReaction = e.currentTarget.dataset.reaction || 'likes';
                const post = posts.find(p => p.id === id);
                if (!post) return;

                normalizePostReactions(post);
                const previousReaction = post.userReaction;

                if (previousReaction === selectedReaction) {
                    post.reacciones[selectedReaction] = Math.max(0, (Number(post.reacciones[selectedReaction]) || 0) - 1);
                    post.userReaction = null;
                } else {
                    if (previousReaction && post.reacciones[previousReaction] !== undefined) {
                        post.reacciones[previousReaction] = Math.max(0, (Number(post.reacciones[previousReaction]) || 0) - 1);
                    }
                    post.reacciones[selectedReaction] = (Number(post.reacciones[selectedReaction]) || 0) + 1;
                    post.userReaction = selectedReaction;
                }

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

        feedContainer.querySelectorAll('.comment-reply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const commentElement = e.currentTarget.closest('.comment-item');
                const replyForm = commentElement.querySelector('.reply-form');
                replyForm.classList.remove('d-none');
                replyForm.querySelector('.reply-author-input').focus();
            });
        });

        feedContainer.querySelectorAll('.cancel-reply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const replyForm = e.currentTarget.closest('.reply-form');
                replyForm.classList.add('d-none');
                replyForm.reset();
            });
        });

        feedContainer.querySelectorAll('.reply-form').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const postId = Number(form.dataset.postId);
                const commentId = Number(form.dataset.commentId);
                const authorInput = form.querySelector('.reply-author-input');
                const textInput = form.querySelector('.reply-text-input');

                const autor = authorInput.value.trim();
                const texto = textInput.value.trim();

                if (!autor || !texto) return;

                const post = posts.find(p => p.id === postId);
                if (!post) return;

                const comment = post.comentarios?.find(c => c.id === commentId);
                if (!comment) return;

                if (!Array.isArray(comment.respuestas)) {
                    comment.respuestas = [];
                }

                comment.respuestas.push({
                    id: Date.now(),
                    autor: autor,
                    texto: texto,
                    timestamp: Date.now()
                });

                localStorage.setItem('posts', JSON.stringify(posts));
                renderPosts();
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
