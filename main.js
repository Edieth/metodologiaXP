document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleccionar los elementos del DOM
    const postForm = document.getElementById('post-form');
    const studentNameInput = document.getElementById('student-name');
    const messageTextInput = document.getElementById('message-text');
    const feedContainer = document.getElementById('feed-container');

    // 2. Obtener publicaciones guardadas o iniciar con un arreglo vacío
    let posts = JSON.parse(localStorage.getItem('posts')) || [];

    // 3. Renderizar las publicaciones guardadas al cargar la página
    renderPosts();

    // 4. Escuchar el evento 'submit' del formulario
    postForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const name = studentNameInput.value.trim();
        const message = messageTextInput.value.trim();

        if (!name || !message) return;

        // Crear el objeto del nuevo post
        const newPost = {
            id: Date.now(), // ID único basado en timestamp
            name: name,
            message: message
        };

        // Agregar al inicio del arreglo local
        posts.unshift(newPost);

        // Guardar en LocalStorage (convertido a JSON)
        localStorage.setItem('posts', JSON.stringify(posts));

        // Actualizar la interfaz
        renderPosts();

        // Limpiar el formulario
        postForm.reset();
        studentNameInput.focus();
    });

    // Función para renderizar todos los posts guardados en el DOM
    function renderPosts() {
        feedContainer.innerHTML = ''; // Limpiar el contenedor

        posts.forEach(post => {
            const postElement = document.createElement('article');
            postElement.className = 'card';

            postElement.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">${escapeHTML(post.name)}</h5>
                    <p class="card-text">${escapeHTML(post.message)}</p>
                </div>
            `;

            feedContainer.appendChild(postElement);
        });
    }

    // Función de seguridad contra ataques XSS
    function escapeHTML(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});