document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const messageDiv = document.getElementById('message');
    const devInfoDiv = document.getElementById('dev-info');
    const API_URL = '/api';

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageDiv.textContent = '';
        messageDiv.className = 'text-center text-sm';
        devInfoDiv.innerHTML = '';
        devInfoDiv.style.display = 'none';

        // Deshabilitar el botón de registro para evitar envíos múltiples
        const submitButton = registerForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Procesando...';

        const formData = new FormData(registerForm);
        const data = Object.fromEntries(formData.entries());

        if (data.password !== data.confirmPassword) {
            messageDiv.textContent = 'Las contraseñas no coinciden.';
            messageDiv.classList.add('text-red-600');
            submitButton.disabled = false;
            submitButton.textContent = 'Registrarse';
            return;
        }

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                messageDiv.textContent = "¡Registro casi completo!";
                messageDiv.classList.add('text-green-600');
                
                // Ocultar el formulario de registro
                registerForm.style.display = 'none';

                // Mostrar información de desarrollo si existe
                if (result.development_only) {
                    const { verificationCode, previewUrl } = result.development_only;
                    devInfoDiv.innerHTML = `
                        <p class="font-bold mb-2">Información de Desarrollo:</p>
                        <p class="mb-1">Código de Verificación: <strong class="text-blue-600 text-base">${verificationCode}</strong></p>
                        <p class="mb-4">Email de prueba: <a href="${previewUrl}" target="_blank" class="text-blue-600 hover:underline">Ver Email Ficticio</a></p>
                        <button id="continueBtn" class="w-full btn-primary font-bold py-2 px-4 rounded-md transition-all duration-200">
                            Continuar a Verificación
                        </button>
                    `;
                    devInfoDiv.style.display = 'block';

                    // Añadir evento al nuevo botón
                    document.getElementById('continueBtn').addEventListener('click', () => {
                        window.location.href = 'verify.html';
                    });
                } else {
                    // Si no estamos en modo desarrollo, redirigir directamente
                     setTimeout(() => {
                        window.location.href = 'verify.html';
                    }, 2000);
                }

                localStorage.setItem('verificationEmail', data.email);

            } else {
                messageDiv.textContent = `Error: ${result.message}`;
                messageDiv.classList.add('text-red-600');
                submitButton.disabled = false;
                submitButton.textContent = 'Registrarse';
            }

        } catch (error) {
            console.error('Error en el registro:', error);
            messageDiv.textContent = 'No se pudo conectar con el servidor.';
            messageDiv.classList.add('text-red-600');
            submitButton.disabled = false;
            submitButton.textContent = 'Registrarse';
        }
    });
});