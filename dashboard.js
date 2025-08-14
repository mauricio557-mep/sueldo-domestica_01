document.addEventListener('DOMContentLoaded', () => {
    const userInfo = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');

    // 1. Verificar si el usuario está autenticado
    const token = localStorage.getItem('jwt_token');
    const userEmail = localStorage.getItem('userEmail');

    if (!token || !userEmail) {
        // Si no hay token o email, no debería estar aquí. Redirigir al login.
        window.location.href = 'index.html';
        return; // Detener la ejecución del script
    }

    // 2. Mostrar la información del usuario
    userInfo.textContent = `Sesión iniciada como: ${userEmail}`;

    // 3. Configurar el botón de logout
    logoutBtn.addEventListener('click', () => {
        // Limpiar el almacenamiento local
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('verificationEmail'); // Limpiar también por si acaso

        // Redirigir a la página de inicio de sesión
        window.location.href = 'index.html';
    });
});
