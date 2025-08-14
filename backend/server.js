const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const nodemailer = require('nodemailer');
const path = require('path'); // Importar el módulo path
const crypto = require('crypto'); // Importar crypto para generar tokens seguros

const app = express();
const PORT = 3000;
const JWT_SECRET = 'tu_secreto_super_secreto_para_jwt';

// --- Middlewares ---
// Middleware para servir archivos estáticos (HTML, CSS, JS del frontend)
// path.join(__dirname, '..') se mueve un directorio hacia arriba desde /backend a la raíz del proyecto.
const publicPath = path.join(__dirname, '..');
app.use(express.static(publicPath));

app.use(express.json());

// --- Middleware de Autenticación ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (token == null) {
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Forbidden (token inválido o expirado)
        }
        req.user = user; // Adjuntar el payload del token (ej: { id, email }) a la request
        next();
    });
};

// --- Conexión a la Base de Datos ---
const dbPath = path.join(__dirname, 'database.db'); // Crear ruta absoluta a la BD
let db;
(async () => {
    db = await open({
        filename: dbPath, // Usar la ruta absoluta
        driver: sqlite3.Database
    });
    if (db) console.log(`Conectado a la base de datos en: ${dbPath}`);
})();

// --- Configuración de Nodemailer con Ethereal ---
// En una app real, usa variables de entorno para las credenciales.
let transporter;
async function setupEmail() {
    // Ethereal crea una cuenta de prueba para nosotros.
    let testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: testAccount.user, // Usuario generado por Ethereal
            pass: testAccount.pass, // Contraseña generada por Ethereal
        },
    });
    console.log(`Servidor de email de prueba listo para enviar correos.`);
}
setupEmail().catch(console.error);


// --- Rutas de la API ---

// Endpoint para registrar un nuevo usuario
app.post('/api/register', async (req, res) => {
    try {
        const { nombre, apellido, email, password, confirmPassword } = req.body;

        // Validaciones
        if (!nombre || !apellido || !email || !password || !confirmPassword) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
        }
        if (password.length < 4) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres.' });
        }

        // Verificar si el usuario ya existe
        const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ message: 'El email ya está registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = String(Math.floor(1000 + Math.random() * 9000));

        // Guardar usuario (aún no verificado)
        await db.run(
            'INSERT INTO users (nombre, apellido, email, password, verification_code, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, apellido, email, hashedPassword, verificationCode, 0]
        );

        // Enviar email de verificación
        const info = await transporter.sendMail({
            from: '"Calculadora de Sueldo App" <no-reply@calculadora.app>',
            to: email,
            subject: "Código de Verificación de Cuenta",
            text: `Hola ${nombre}, tu código de verificación es: ${verificationCode}`,
            html: `<b>Hola ${nombre},</b><p>Tu código de verificación es: <strong>${verificationCode}</strong></p>`,
        });

        console.log("Email de verificación enviado: %s", info.messageId);
        // Nodemailer nos da una URL para previsualizar el email enviado a través de Ethereal
        console.log("URL de previsualización: %s", nodemailer.getTestMessageUrl(info));

        res.status(201).json({
            message: 'Registro exitoso. Por favor, revisa tu email para obtener el código de verificación.',
            // NOTA: La siguiente información es solo para fines de desarrollo y pruebas.
            // En un entorno de producción, esto NUNCA debe ser enviado al cliente.
            development_only: {
                verificationCode: verificationCode,
                previewUrl: nodemailer.getTestMessageUrl(info)
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor al registrar el usuario.', error: error.message });
    }
});

// Endpoint para verificar la cuenta
app.post('/api/verify', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ message: 'Email y código son requeridos.' });
        }

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        if (user.verification_code !== code) {
            return res.status(400).json({ message: 'Código de verificación incorrecto.' });
        }

        // Marcar como verificado y limpiar el código
        await db.run('UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?', [user.id]);

        res.json({ message: 'Cuenta verificada con éxito. Ahora puedes iniciar sesión.' });

    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor al verificar la cuenta.', error: error.message });
    }
});


// Endpoint para iniciar sesión
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
        }

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // ¡NUEVO! Comprobar si la cuenta está verificada
        if (!user.is_verified) {
            return res.status(403).json({ message: 'La cuenta no ha sido verificada. Por favor, revisa tu email.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login exitoso.', token: token });

    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor al iniciar sesión.', error: error.message });
    }
});


// --- Rutas para Historial de Cálculos (Protegidas) ---

// Endpoint para guardar un nuevo cálculo
app.post('/api/calculations', authenticateToken, async (req, res) => {
    try {
        const { monto_total, detalles } = req.body;
        const user_id = req.user.id; // Obtenido del middleware authenticateToken

        if (!monto_total || !detalles) {
            return res.status(400).json({ message: 'Faltan datos para guardar el cálculo.' });
        }

        const fecha = new Date().toISOString();

        const result = await db.run(
            'INSERT INTO calculations (user_id, fecha, monto_total, detalles) VALUES (?, ?, ?, ?)',
            [user_id, fecha, monto_total, JSON.stringify(detalles)]
        );

        res.status(201).json({ message: 'Cálculo guardado con éxito.', id: result.lastID });

    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor al guardar el cálculo.', error: error.message });
    }
});

// Endpoint para obtener el historial de cálculos del usuario
app.get('/api/calculations', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.id;
        const calculations = await db.all(
            'SELECT id, fecha, monto_total, detalles FROM calculations WHERE user_id = ? ORDER BY fecha DESC',
            [user_id]
        );
        res.json(calculations);
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor al obtener el historial.', error: error.message });
    }
});


// --- Rutas para Recuperación de Contraseña ---

// Endpoint para solicitar el reseteo de contraseña
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await db.get('SELECT * FROM users WHERE email = ? AND is_verified = 1', [email]);

        if (!user) {
            // No revelamos si el usuario existe o no por seguridad.
            // Enviamos una respuesta genérica de éxito.
            return res.json({ message: 'Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.' });
        }

        // Generar un token de reseteo seguro y su expiración (1 hora)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = Date.now() + 3600000; // 1 hora en milisegundos

        await db.run(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [resetToken, tokenExpiry, user.id]
        );

        // Construir el enlace de reseteo
        // En una app real, la URL base vendría de una variable de entorno
        const resetLink = `http://localhost:${PORT}/reset-password.html?token=${resetToken}`;

        // Enviar email
        const info = await transporter.sendMail({
            from: '"Calculadora de Sueldo App" <no-reply@calculadora.app>',
            to: user.email,
            subject: "Restablecimiento de Contraseña",
            text: `Hola ${user.nombre},\n\nPara restablecer tu contraseña, haz clic en el siguiente enlace:\n${resetLink}\n\nSi no solicitaste esto, por favor ignora este email.\n`,
            html: `<b>Hola ${user.nombre},</b><p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p><a href="${resetLink}">Restablecer Contraseña</a><p>Si no solicitaste esto, por favor ignora este email.</p>`,
        });

        console.log("URL de previsualización del email de reseteo: %s", nodemailer.getTestMessageUrl(info));

        res.json({
            message: 'Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.',
            development_only: {
                resetLink: resetLink,
                previewUrl: nodemailer.getTestMessageUrl(info)
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor.', error: error.message });
    }
});

// Endpoint para restablecer la contraseña con el token
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;

        if (!token || !password || !confirmPassword) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
        }
        if (password.length < 4) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres.' });
        }

        const user = await db.get(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?',
            [token, Date.now()]
        );

        if (!user) {
            return res.status(400).json({ message: 'El token es inválido o ha expirado. Por favor, solicita un nuevo enlace.' });
        }

        // ¡NUEVA VALIDACIÓN! Verificar que la nueva contraseña no sea igual a la anterior.
        const isSamePassword = await bcrypt.compare(password, user.password);
        if (isSamePassword) {
            return res.status(400).json({ message: 'La nueva contraseña no puede ser igual a la anterior.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        res.json({ message: 'Tu contraseña ha sido actualizada con éxito.' });

    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor.', error: error.message });
    }
});


// --- Iniciar el servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});