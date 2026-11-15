// --- INICIO DE PROTECCIÓN DE RUTAS ---
(function() {
    const path = window.location.pathname;
    const uid = sessionStorage.getItem('verify_uid');
    const loggedIn = sessionStorage.getItem('isLoggedIn');

    if (path.includes('confirm.html') && !uid) {
        window.location.href = '/registro.html';
        return;
    }
    if ((path.includes('dashboard.html') || path.includes('plan.html') || path.includes('pago.html') || path.includes('sessionbank.html') || path.includes('apps.html')) && !loggedIn) {
        window.location.href = '/login.html';
        return;
    }
})();
// --- FIN DE PROTECCIÓN DE RUTAS ---

// --- BLOQUEO DE INSPECCIÓN ---
(function() {
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); return false; }
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) { e.preventDefault(); return false; }
        if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) { e.preventDefault(); return false; }
        if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) { e.preventDefault(); return false; }
        if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) { e.preventDefault(); return false; }
    });
    document.addEventListener('selectstart', function(e) { e.preventDefault(); return false; });
})();
// --- FIN BLOQUEO ---

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, deleteField, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ CONFIGURACIÓN CORREGIDA (API Key válida)
const firebaseConfig = {
    apiKey: "AIzaSyCgCnuA4ehtQFJywPAMLVuxlSeuLfL8b0",
    authDomain: "s0uld4kr11-11.firebaseapp.com",
    projectId: "s0uld4kr11-11",
    storageBucket: "s0uld4kr11-11.firebasestorage.app",
    messagingSenderId: "1035742707359",
    appId: "1:1035742707359:web:cc7fac7bb96cadf26f6caa",
    measurementId: "G-LWTCG9S604"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ⚠️ TUS DATOS DE TELEGRAM
const TELEGRAM_BOT_TOKEN = '8896263098:AAGjtKE0MHDmTHo6peFj-9h4pIimmhfwX1A';
const TELEGRAM_CHAT_ID = '7537905180';

// ⚠️ CONFIGURACIÓN DE EMAILJS
const EMAILJS_SERVICE_ID = 'service_qq92pnn'; 
const EMAILJS_TEMPLATE_ID = 'template_3egjg8d';
const EMAILJS_PUBLIC_KEY = 'XqZw6OXtrbOXKLmAx';

const WALLETS = {
    'BTC': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    'ETH': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    'LTC': 'LTC_ADDRESS_EXAMPLE_123',
    'XMR': 'XMR_ADDRESS_EXAMPLE_456'
};

function showMessage(msg, type) {
    const box = document.getElementById('message-box');
    if(box) { box.textContent = msg; box.className = `message ${type}`; }
}

// --- LIMPIEZA DE SESIÓN AL CERRAR (NO AL RECARGAR) ---
function setupSessionCleanup() {
    const user = auth.currentUser;
    if (!user) return;

    let isReloading = false;

    window.addEventListener('keydown', (e) => {
        if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
            isReloading = true;
        }
    });

    window.addEventListener('beforeunload', async (e) => {
        if (isReloading) return;

        const currentToken = sessionStorage.getItem('sessionToken');
        if (currentToken) {
            try {
                await updateDoc(doc(db, "users", user.uid), {
                    activeSessionToken: deleteField()
                });
            } catch (error) {
                console.error("Error al limpiar el token de sesión:", error);
            }
        }
    });
}

// --- VERIFICACIÓN DE SESIÓN ÚNICA EN TIEMPO REAL ---
export function checkSession() {
    auth.onAuthStateChanged((user) => {
        if (!user) {
            sessionStorage.clear();
            window.location.href = 'login.html';
            return;
        }

        setupSessionCleanup();

        setTimeout(() => {
            onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const currentToken = sessionStorage.getItem('sessionToken');
                    
                    if (data.activeSessionToken && data.activeSessionToken !== currentToken) {
                        alert('⚠️ Tu cuenta ha sido abierta en otro dispositivo. Esta sesión se cerrará por seguridad.');
                        sessionStorage.clear();
                        signOut(auth).then(() => { window.location.href = 'login.html'; });
                    }
                }
            });
        }, 3000);
    });
}

async function sendVerificationEmail(toEmail, code) {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: { email: toEmail, verification_code: code }
        })
    });
    if (!response.ok) throw new Error('Error EmailJS');
    return response;
}

async function sendTelegramAlert(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
        });
    } catch (error) { console.error("Error Telegram:", error); }
}

async function getClientIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch (e) {
        return 'Desconocida';
    }
}

// --- OBTENER INFO DEL USUARIO (Nombre y Plan) ---
export async function getUserInfo() {
    const user = auth.currentUser;
    if (!user) return null;

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return null;

        const data = userDoc.data();
        let remainingTime = "Sin plan";
        let hasPlan = false;
        let isAdmin = false;

        const adminEmails = ['krakhe017@gmail.com', 'salliplop@gmail.com'];
        isAdmin = adminEmails.includes(data.email);

        if (isAdmin) {
            hasPlan = true;
            remainingTime = "Administrador";
        } else if (data.planExpiresAt) {
            let expirationDate;
            if (typeof data.planExpiresAt.toDate === 'function') {
                expirationDate = data.planExpiresAt.toDate();
            } else {
                expirationDate = new Date(data.planExpiresAt);
            }

            const now = new Date();
            if (now < expirationDate) {
                hasPlan = true;
                const diff = expirationDate - now;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                
                if (days > 0) {
                    remainingTime = `${days}d ${hours}h ${minutes}m`;
                } else if (hours > 0) {
                    remainingTime = `${hours}h ${minutes}m`;
                } else {
                    remainingTime = `${minutes}m`;
                }
            } else {
                remainingTime = "Expirado";
            }
        }

        return {
            name: data.name || "Usuario",
            email: data.email,
            hasPlan: hasPlan,
            isAdmin: isAdmin,
            remainingTime: remainingTime,
            expiresAt: data.planExpiresAt
        };

    } catch (error) {
        console.error("Error en getUserInfo:", error);
        return null;
    }
}

// --- REGISTRO (CON RETRASO PARA AUTENTICACIÓN) ---
export async function registerUser() {
    const name = document.getElementById('reg-name').value;
    const code = document.getElementById('reg-country-code').value;
    const phone = document.getElementById('reg-phone').value.replace(/\s+/g, '');
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (!name || !phone || !email || !password) return showMessage('Todos los campos son obligatorios.', 'error');
    if (password !== confirmPassword) return showMessage('Las contraseñas no coinciden.', 'error');
    if (password.length < 6) return showMessage('La contraseña debe tener al menos 6 caracteres.', 'error');

    const btn = document.getElementById('register-btn');
    btn.disabled = true; btn.textContent = 'Verificando datos...';
    const fullPhone = code + phone;
    let user = null;

    try {
        const usersRef = collection(db, "users");
        const phoneQuery = query(usersRef, where("phone", "==", fullPhone));
        const phoneSnapshot = await getDocs(phoneQuery);
        if (!phoneSnapshot.empty) {
            showMessage('Este número de teléfono ya está registrado.', 'error');
            btn.disabled = false; btn.textContent = 'Crear cuenta'; return;
        }

        btn.textContent = 'Creando cuenta...';
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;

        // --- ESPERA CRÍTICA PARA QUE FIREBASE AUTH ESTÉ LISTO ---
        await new Promise(resolve => setTimeout(resolve, 1500));

        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const whatsappCode = Math.floor(100000 + Math.random() * 900000).toString();

        await setDoc(doc(db, "users", user.uid), {
            name: name, phone: fullPhone, email: email, role: "user",
            emailVerified: false, verificationCode: emailCode, whatsappCode: whatsappCode,
            codeExpiresAt: new Date(Date.now() + 10 * 60 * 1000), 
            planExpiresAt: null,
            loginAttempts: 0,
            blocked: false,
            createdAt: new Date().toISOString()
        });

        btn.textContent = 'Enviando correo...';
        await sendVerificationEmail(email, emailCode);

        await signOut(auth);
        sessionStorage.setItem('verify_uid', user.uid);
        sessionStorage.setItem('verify_email', email);

        showMessage('¡Cuenta creada! Revisa tu correo.', 'success');
        setTimeout(() => window.location.href = 'confirm.html', 2000);

    } catch (error) {
        console.error(error);
        if (user) { try { await deleteDoc(doc(db, "users", user.uid)); await deleteUser(user); } catch (e) {} }
        showMessage('Error al registrar.', 'error');
        btn.disabled = false; btn.textContent = 'Crear cuenta';
    }
}

// --- LOGIN CON CONTADOR DE INTENTOS Y ADVERTENCIA ---
export async function loginUser() {
    const code = document.getElementById('login-country-code').value;
    const phone = document.getElementById('login-phone').value.replace(/\s+/g, '');
    const password = document.getElementById('login-password').value;
    if (!phone || !password) return showMessage('Ingresa teléfono y contraseña.', 'error');

    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = 'Buscando...';
    const fullPhone = code + phone;

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("phone", "==", fullPhone));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            showMessage('Este número no está registrado.', 'error');
            btn.disabled = false; btn.textContent = 'Ingresar'; return;
        }
        
        let userDocId = "";
        let userEmail = "";
        let userData = null;
        querySnapshot.forEach((doc) => { 
            userEmail = doc.data().email; 
            userDocId = doc.id;
            userData = doc.data();
        });

        if (userData.blocked) {
            showMessage('⛔ Tu cuenta está bloqueada por múltiples intentos de sesión. Contacta al soporte.', 'error');
            btn.disabled = false; btn.textContent = 'Ingresar'; return;
        }

        btn.textContent = 'Verificando...';
        const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
        const user = userCredential.user;
        
        if (!userData.emailVerified) {
            showMessage('Debes confirmar tu cuenta.', 'error');
            sessionStorage.setItem('verify_uid', user.uid);
            sessionStorage.setItem('verify_email', userEmail);
            setTimeout(() => window.location.href = 'confirm.html', 2000);
            return;
        }

        const currentToken = sessionStorage.getItem('sessionToken');
        const activeToken = userData.activeSessionToken;

        if (activeToken && activeToken !== currentToken) {
            const newAttempts = (userData.loginAttempts || 0) + 1;
            const shouldBlock = newAttempts >= 3;

            const confirmClose = confirm(
                `⚠️ ADVERTENCIA: Sesión ya abierta en otro dispositivo.\n\n` +
                `Intento ${newAttempts}/3.\n\n` +
                `Si continúas, se cerrará la sesión anterior y se abrirá esta nueva.\n\n` +
                `¿Deseas continuar?`
            );
            
            if (!confirmClose) {
                await updateDoc(doc(db, "users", user.uid), {
                    loginAttempts: newAttempts,
                    blocked: shouldBlock
                });

                if (shouldBlock) {
                    showMessage('⛔ Has cancelado 3 veces. Tu cuenta ha sido bloqueada.', 'error');
                } else {
                    showMessage(`Acceso cancelado. Intento ${newAttempts}/3.`, 'error');
                }
                
                await signOut(auth);
                btn.disabled = false; btn.textContent = 'Ingresar';
                return;
            }
            
            await updateDoc(doc(db, "users", user.uid), {
                loginAttempts: 0,
                blocked: false
            });
        }

        const ip = await getClientIP();
        const newSessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        await updateDoc(doc(db, "users", user.uid), {
            activeSessionToken: newSessionToken,
            loginAttempts: 0,
            blocked: false,
            lastLoginIP: ip,
            lastLoginDate: new Date().toISOString()
        });

        sessionStorage.setItem('sessionToken', newSessionToken);
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userEmail', userEmail);
        
        const adminEmails = ['krakhe017@gmail.com','salliplop@gmail.com'];
        if (adminEmails.includes(userEmail)) {
            sessionStorage.setItem('isAdmin', 'true');
        }

        showMessage('¡Bienvenido!', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    } catch (error) {
        showMessage('Contraseña incorrecta.', 'error');
        btn.disabled = false; btn.textContent = 'Ingresar';
    }
}

// --- CONFIRMACIÓN ---
export async function confirmUserCode() {
    const uid = sessionStorage.getItem('verify_uid');
    if (!uid) { window.location.href = 'registro.html'; return; }
    
    const emailCodeInput = document.getElementById('confirm-email-code').value;
    const whatsappCodeInput = document.getElementById('confirm-whatsapp-code').value;
    const btn = document.getElementById('confirm-btn');

    if (emailCodeInput.length !== 6 || whatsappCodeInput.length !== 6) {
        return showMessage('Ambos códigos deben tener 6 dígitos.', 'error');
    }

    btn.disabled = true; btn.textContent = 'Verificando...';
    
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) return showMessage('Usuario no encontrado.', 'error');
        const data = userDoc.data();

        if (Date.now() > data.codeExpiresAt.toMillis()) {
            showMessage('Los códigos han expirado.', 'error');
            btn.disabled = false; btn.textContent = 'Confirmar cuenta'; return;
        }
        if (data.verificationCode !== emailCodeInput) {
            showMessage('El código de correo es incorrecto.', 'error');
            btn.disabled = false; btn.textContent = 'Confirmar cuenta'; return;
        }
        if (data.whatsappCode !== whatsappCodeInput) {
            showMessage('El código de WhatsApp es incorrecto.', 'error');
            btn.disabled = false; btn.textContent = 'Confirmar cuenta'; return;
        }

        await updateDoc(userDocRef, { 
            verificationCode: deleteField(), whatsappCode: deleteField(),
            codeExpiresAt: deleteField(), emailVerified: true 
        });
        
        showMessage('¡Cuenta confirmada!', 'success');
        sessionStorage.clear();
        setTimeout(() => window.location.href = 'login.html', 2000);

    } catch (error) {
        showMessage('Error al verificar.', 'error');
        btn.disabled = false; btn.textContent = 'Confirmar cuenta';
    }
}

// --- RECUPERAR CONTRASEÑA ---
export async function recoverPassword() {
    const email = document.getElementById('reset-email').value;
    if (!email) return showMessage('Por favor, ingresa tu correo.', 'error');
    const btn = document.getElementById('reset-btn');
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage('Enlace enviado. Revisa tu correo.', 'success');
    } catch (error) {
        showMessage('No existe cuenta con este correo.', 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Enviar enlace';
    }
}

export function logoutUser() {
    sessionStorage.clear();
    signOut(auth).then(() => { window.location.href = 'index.html'; });
}

// --- LÓGICA DE PAGO ---
export function initPaymentPage() {
    const user = auth.currentUser;
    if (user) {
        const q = query(collection(db, "payments"), where("userId", "==", user.uid), where("status", "==", "pending"));
        getDocs(q).then((snapshot) => {
            if (!snapshot.empty) {
                alert('Ya tienes un pago en revisión.');
                window.location.href = 'sessionbank.html';
            }
        });
    }

    const plan = JSON.parse(localStorage.getItem('selectedPlan')) || { days: 1, price: 9.99 };
    document.getElementById('summary-days').textContent = `${plan.days} día(s)`;
    document.getElementById('summary-price').textContent = `$${plan.price}`;

    let currentCrypto = 'BTC';
    let timeLeft = 15 * 60; 
    let timerInterval;

    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('timer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function resetTimer() {
        clearInterval(timerInterval);
        timeLeft = 15 * 60;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            if (timeLeft <= 0) { clearInterval(timerInterval); document.getElementById('timer').textContent = 'Tiempo agotado'; return; }
            timeLeft--; updateTimerDisplay();
        }, 1000);
    }

    window.selectCrypto = (crypto, element) => {
        document.querySelectorAll('.crypto-btn').forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
        currentCrypto = crypto;
        document.getElementById('payment-details').classList.remove('hidden');
        document.getElementById('wallet-address').textContent = WALLETS[crypto];
        document.getElementById('qr-image').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${WALLETS[crypto]}`;
        resetTimer();
    };

    window.copyAddress = () => {
        navigator.clipboard.writeText(document.getElementById('wallet-address').textContent).then(() => alert('Dirección copiada'));
    };

    window.submitPayment = async () => {
        const referenceInput = document.getElementById('ref-input').value.trim();
        const dateInput = document.getElementById('date-input').value;
        const timeInput = document.getElementById('time-input').value;

        if (!referenceInput || !dateInput || !timeInput) {
            return alert('Debes ingresar número de referencia, fecha y hora del pago.');
        }

        const btn = document.getElementById('submit-payment');
        btn.disabled = true; btn.textContent = 'Enviando...';

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No hay usuario logueado");

            const checkQ = query(collection(db, "payments"), where("userId", "==", user.uid), where("status", "==", "pending"));
            const checkSnapshot = await getDocs(checkQ);
            if (!checkSnapshot.empty) {
                alert('Ya tienes un pago en revisión.');
                window.location.href = 'sessionbank.html';
                return;
            }

            const paymentRef = doc(collection(db, "payments"));
            await setDoc(paymentRef, {
                userId: user.uid, userEmail: user.email,
                planDays: plan.days, amountUSD: plan.price,
                cryptoType: currentCrypto, 
                reference: referenceInput,
                paymentDate: dateInput,
                paymentTime: timeInput,
                status: "pending", createdAt: new Date().toISOString()
            });

            sessionStorage.setItem('currentPaymentId', paymentRef.id);

            const message = `💰 <b>Nuevo Pago Pendiente</b>\n\n👤 <b>Usuario:</b> ${user.email}\n📦 <b>Plan:</b> ${plan.days} días\n💵 <b>Monto:</b> $${plan.price}\n🪙 <b>Cripto:</b> ${currentCrypto}\n🔑 <b>Referencia:</b> ${referenceInput}\n📅 <b>Fecha:</b> ${dateInput}\n🕒 <b>Hora:</b> ${timeInput}`;
            await sendTelegramAlert(message);

            window.location.href = 'sessionbank.html';

        } catch (error) {
            console.error(error);
            alert('Error al enviar. Intenta de nuevo.');
            btn.disabled = false; btn.textContent = 'Enviar Comprobante';
        }
    };
    selectCrypto('BTC', document.querySelector('.crypto-btn'));
}

// --- FUNCIÓN PARA ADMIN (Cargar TODAS las transacciones) ---
export async function loadAdminPayments() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Cargando historial...</td></tr>';
    
    try {
        const paymentsRef = collection(db, "payments");
        const querySnapshot = await getDocs(paymentsRef);

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay transacciones registradas.</td></tr>';
            return;
        }

        let paymentsList = [];
        querySnapshot.forEach((docSnap) => {
            paymentsList.push({ id: docSnap.id, ...docSnap.data() });
        });

        paymentsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        tbody.innerHTML = '';
        paymentsList.forEach((data) => {
            const tr = document.createElement('tr');
            
            let statusColor = '#f39c12'; 
            let statusText = 'Pendiente';
            if (data.status === 'approved') { statusColor = '#2ecc71'; statusText = 'Aprobado'; }
            if (data.status === 'rejected') { statusColor = '#e74c3c'; statusText = 'Rechazado'; }

            const dateObj = new Date(data.createdAt);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();

            let actionButtons = '';
            if (data.status === 'pending') {
                actionButtons = `
                    <button onclick="approvePayment('${data.id}', '${data.userId}', ${data.planDays})" style="background:#2ecc71; color:white; border:none; padding:5px; cursor:pointer; border-radius:4px; margin-right:5px; font-size:11px;">Aprobar</button>
                    <button onclick="rejectPayment('${data.id}')" style="background:#e74c3c; color:white; border:none; padding:5px; cursor:pointer; border-radius:4px; font-size:11px;">Rechazar</button>
                `;
            } else {
                actionButtons = `<span style="color:${statusColor}; font-weight:bold;">${statusText}</span>`;
            }

            tr.innerHTML = `
                <td>${data.userEmail}</td>
                <td>${data.planDays} días</td>
                <td>$${data.amountUSD}</td>
                <td><strong>${data.reference}</strong></td>
                <td>${data.paymentDate} ${data.paymentTime}</td>
                <td>${dateStr}</td>
                <td>${actionButtons}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar pagos:", error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error al cargar el historial.</td></tr>';
    }
}

// --- APROBAR PAGO ---
export async function approvePayment(paymentId, userId, planDays) {
    if (!confirm('¿Aprobar este pago y activar el plan?')) return;
    
    try {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        let newExpirationDate;
        const now = new Date();

        if (userData.planExpiresAt && userData.planExpiresAt.toDate() > now) {
            newExpirationDate = new Date(userData.planExpiresAt.toDate().getTime() + planDays * 24 * 60 * 60 * 1000);
        } else {
            newExpirationDate = new Date(now.getTime() + planDays * 24 * 60 * 60 * 1000);
        }

        await updateDoc(doc(db, "payments", paymentId), { status: 'approved' });
        await updateDoc(userRef, { role: 'premium', planExpiresAt: newExpirationDate });

        alert('Pago aprobado.');
        loadAdminPayments();
        
    } catch (error) {
        console.error(error);
        alert('Error al aprobar el pago.');
    }
}

// --- RECHAZAR PAGO ---
export async function rejectPayment(paymentId) {
    if (!confirm('¿Rechazar este pago?')) return;
    try {
        await updateDoc(doc(db, "payments", paymentId), { status: 'rejected' });
        alert('Pago rechazado.');
        loadAdminPayments();
    } catch (error) {
        alert('Error al rechazar.');
    }
}

// --- ESCUCHAR ESTADO DEL PAGO EN SESSIONBANK ---
export function checkPaymentStatus() {
    const paymentId = sessionStorage.getItem('currentPaymentId');
    if (!paymentId) { window.location.href = 'plan.html'; return; }
    
    const paymentDocRef = doc(db, "payments", paymentId);
    onSnapshot(paymentDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'approved') {
                document.getElementById('status-waiting').classList.add('hidden');
                document.getElementById('status-approved').classList.remove('hidden');
            } else if (data.status === 'rejected') {
                alert('Tu pago ha sido rechazado. Por favor, verifica los datos e intenta de nuevo.');
                window.location.href = 'pago.html';
            }
        }
    });
}

// --- VERIFICAR ACCESO DEL USUARIO (Con timeout) ---
export async function checkUserAccess() {
    const user = auth.currentUser;
    if (!user) return null;

    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
        );

        const docPromise = getDoc(doc(db, "users", user.uid));
        
        const userDoc = await Promise.race([docPromise, timeoutPromise]);

        if (!userDoc.exists()) return { hasPlan: false, isAdmin: false };

        const data = userDoc.data();
        const now = new Date();

        const adminEmails = ['krakhe017@gmail.com', 'salliplop@gmail.com'];
        const isAdmin = adminEmails.includes(data.email);

        if (isAdmin) return { hasPlan: true, isAdmin: true };

        if (data.planExpiresAt) {
            let expirationDate;
            if (typeof data.planExpiresAt.toDate === 'function') {
                expirationDate = data.planExpiresAt.toDate();
            } else if (typeof data.planExpiresAt === 'string') {
                expirationDate = new Date(data.planExpiresAt);
            } else {
                expirationDate = new Date(data.planExpiresAt);
            }

            if (!isNaN(expirationDate.getTime()) && now < expirationDate) {
                return { hasPlan: true, isAdmin: false, expiresAt: expirationDate };
            }
        }

        return { hasPlan: false, isAdmin: false };

    } catch (error) {
        console.error("Error en checkUserAccess:", error);
        return { hasPlan: false, isAdmin: false, error: 'Timeout' };
    }
}

export async function verifyAdminEmail(email) {
    const adminEmails = ['krakhe017@gmail.com', 'salliplop@gmail.com']; 
    return adminEmails.includes(email);
}
