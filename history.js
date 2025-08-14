document.addEventListener('DOMContentLoaded', () => {
    const loadingDiv = document.getElementById('loading');
    const historyContainer = document.getElementById('historyContainer');
    const emptyStateDiv = document.getElementById('emptyState');

    const token = localStorage.getItem('jwt_token');

    // 1. Verificar autenticación
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Función para formatear moneda
    const formatCurrency = (value) => {
        return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
    };

    // 3. Función para renderizar un item del historial
    const createHistoryItem = (calc) => {
        const details = JSON.parse(calc.detalles);
        const calcDate = new Date(calc.fecha).toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const item = document.createElement('div');
        item.className = 'card rounded-lg p-4 transition-all hover:shadow-md';
        item.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-bold text-lg text-blue-800">${formatCurrency(calc.monto_total)}</p>
                    <p class="text-sm text-gray-500">Guardado el: ${calcDate}</p>
                </div>
                <button class="details-btn text-sm text-blue-600 hover:underline" data-details='${JSON.stringify(details)}'>
                    Ver Detalles
                </button>
            </div>
            <div class="details-content hidden mt-4 pt-4 border-t border-gray-200 text-sm space-y-2">
                <!-- Los detalles se insertarán aquí -->
            </div>
        `;
        historyContainer.appendChild(item);
    };

    // 4. Cargar el historial desde la API
    const loadHistory = async () => {
        try {
            const response = await fetch('/api/calculations', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                // Token inválido o expirado
                window.location.href = 'index.html';
                return;
            }

            const calculations = await response.json();

            loadingDiv.classList.add('hidden');

            if (calculations.length === 0) {
                emptyStateDiv.classList.remove('hidden');
            } else {
                historyContainer.classList.remove('hidden');
                calculations.forEach(createHistoryItem);
            }

        } catch (error) {
            console.error('Error al cargar el historial:', error);
            loadingDiv.textContent = 'Error al cargar el historial. Inténtalo de nuevo más tarde.';
        }
    };

    // 5. Manejar clics en "Ver Detalles" (delegación de eventos)
    historyContainer.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('details-btn')) {
            const button = e.target;
            const contentDiv = button.parentElement.nextElementSibling;
            
            if (contentDiv.classList.contains('hidden')) {
                // Mostrar detalles
                const details = JSON.parse(button.dataset.details);
                
                let retroactivoHtml = details.retroactivoDetails.map(r => `
                    <tr>
                        <td class="py-1 pr-2">${r.mes}</td>
                        <td class="py-1 pr-2 text-center">${r.horas}</td>
                        <td class="py-1 pr-2 text-xs">Retroactivo</td>
                        <td class="py-1 pr-2 text-right">${formatCurrency(r.adicional)}</td>
                    </tr>
                `).join('');

                const julioHtml = `
                    <tr class="font-semibold bg-gray-50">
                        <td class="py-1 pr-2">Julio</td>
                        <td class="py-1 pr-2 text-center">${details.horasJulio}</td>
                        <td class="py-1 pr-2 text-xs">Sueldo</td>
                        <td class="py-1 pr-2 text-right">${formatCurrency(details.sueldoJulio)}</td>
                    </tr>
                `;

                contentDiv.innerHTML = `
                    <p class="font-bold mb-2">Desglose del Cálculo:</p>
                    <table class="min-w-full text-sm">
                        <thead>
                            <tr class="text-left">
                                <th class="pb-1 font-medium">Mes</th>
                                <th class="pb-1 font-medium text-center">Horas</th>
                                <th class="pb-1 font-medium">Concepto</th>
                                <th class="pb-1 font-medium text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${retroactivoHtml}
                            ${julioHtml}
                        </tbody>
                    </table>
                    <p class="font-bold mt-3">Bono Adicional: <span class="font-normal">${formatCurrency(details.bono)}</span></p>
                `;
                contentDiv.classList.remove('hidden');
                button.textContent = 'Ocultar Detalles';
            } else {
                // Ocultar detalles
                contentDiv.classList.add('hidden');
                contentDiv.innerHTML = '';
                button.textContent = 'Ver Detalles';
            }
        }
    });

    loadHistory();
});
