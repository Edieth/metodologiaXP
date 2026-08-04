document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleccionar los elementos del DOM
    const postForm = document.getElementById('post-form');
    const studentNameInput = document.getElementById('student-name');
    const messageTextInput = document.getElementById('message-text');
    const feedContainer = document.getElementById('feed-container');

    // 2. Escuchar el evento 'submit' del formulario
    postForm.addEventListener('submit', (event) => {
        // Prevenir la recarga predeterminada de la página
        event.preventDefault();

        // Obtener y limpiar los valores de los inputs
        const name = studentNameInput.value.trim();
        const message = messageTextInput.value.trim();

        // Validar que no estén vacíos
        if (!name || !message) return;

        // 3. Crear la tarjeta (post) usando la estructura y clases de Bootstrap / CSS personalizado
        const newPost = document.createElement('article');
        newPost.className = 'card';

        newPost.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${escapeHTML(name)}</h5>
                <p class="card-text">${escapeHTML(message)}</p>
            </div>
        `;

        // 4. Insertar la nueva publicación al INICIO del feed (el post más reciente primero)
        feedContainer.prepend(newPost);

        // 5. Limpiar el formulario y reenfocar el input del nombre
        postForm.reset();
        studentNameInput.focus();
    });

    // Función auxiliar para prevenir ataques XSS (inyectar scripts maliciosos a través de los inputs)
    function escapeHTML(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});