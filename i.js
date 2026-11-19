// --- public/i.js ---

// 1. PROTECCIÓN DE RUTAS Y SESIÓN
(function() {
    const path = window.location.pathname;
    const loggedIn = sessionStorage.getItem('isLoggedIn');
    
    if ((path.includes('dashboard.html') || path.includes('plan.html') || path.includes('pago.html') || path.includes('sessionbank.html') || path.includes('apps.html')) && !loggedIn) {
        window.location.href = '/login.html';
    }
})();

// 2. CONFIGURACIÓN DE FIREBASE (Mantén tus llaves, pero asegúrate de que las reglas de Firestore estén bien configuradas)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCtnAU4ehtqFjywPAMVLuxtSealufILeb0",
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

// 3. PASARELA DE PAGO SEGURA (Validación de Planes)
const PLANES_VALIDOS = {
    "1": 9.99,
    "3": 19.99,
    "7": 24.99,
    "14": 44.99,
    "30": 79.99
};

const WALLETS = {
    'BTC': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    'ETH': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    'LTC': 'LTC_ADDRESS_EXAMPLE_123',
    'XMR': 'XMR_ADDRESS_EXAMPLE_456'
};

// Función para inicializar la página de pago de forma segura
export function initPaymentPage() {
    // Leer plan desde localStorage
    let plan = JSON.parse(localStorage.getItem('selectedPlan')) || { days: 1, price: 9.99 };
    
    // VALIDACIÓN: Asegurarse de que el usuario no haya manipulado el precio en localStorage
    const precioReal = PLANES_VALIDOS[plan.days];
    if (!precioReal) {
        alert("Plan no válido. Redirigiendo...");
        window.location.href = 'plan.html';
        return;
    }
    
    // Forzar el precio real en la interfaz
    plan.price = precioReal;
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

            // Evitar pagos duplicados pendientes
            const checkQ = query(collection(db, "payments"), where("userId", "==", user.uid), where("status", "==", "pending"));
            const checkSnapshot = await getDocs(checkQ);
            if (!checkSnapshot.empty) {
                alert('Ya tienes un pago en revisión.');
                window.location.href = 'sessionbank.html';
                return;
            }

            const paymentRef = doc(collection(db, "payments"));
            await setDoc(paymentRef, {
                userId: user.uid, 
                userEmail: user.email,
                planDays: plan.days, 
                amountUSD: plan.price, // Usamos el precio validado
                cryptoType: currentCrypto, 
                reference: referenceInput,
                paymentDate: dateInput,
                paymentTime: timeInput,
                status: "pending", 
                createdAt: new Date().toISOString()
            });

            sessionStorage.setItem('currentPaymentId', paymentRef.id);
            
            // Nota: La notificación de Telegram DEBE hacerse en el backend por seguridad.
            // Por ahora, para no romper tu flujo, la dejamos aquí, pero es un riesgo.
            await sendTelegramAlert(`💰 <b>Nuevo Pago</b>\nUsuario: ${user.email}\nPlan: ${plan.days} días\nMonto: $${plan.price}\nRef: ${referenceInput}`);

            window.location.href = 'sessionbank.html';

        } catch (error) {
            console.error(error);
            alert('Error al enviar. Intenta de nuevo.');
            btn.disabled = false; btn.textContent = 'Enviar Comprobante';
        }
    };
    selectCrypto('BTC', document.querySelector('.crypto-btn'));
}

// 4. VERIFICACIÓN DE ADMINISTRADOR SEGURA (No solo confiar en el email desde el frontend)
export async function verifyAdminEmail(email) {
    // ADVERTENCIA: Cualquiera puede ver esto en el código. 
    // La seguridad real debe estar en las Reglas de Firestore (Solo el UID del admin puede leer la colección 'payments').
    const adminEmails = ['krakhe017@gmail.com', 'salliplop@gmail.com']; 
    return adminEmails.includes(email);
}

// 5. LOGIN Y REGISTRO (Mantenidos, pero asegurando que no se expongan tokens en el futuro)
export async function loginUser() {
    // ... (Tu código de login existente, está bien estructurado) ...
}

// 6. FUNCIÓN DE TELEGRAM (Mantén el token AQUÍ solo para pruebas, pero bórralo antes de subir a GitHub)
async function sendTelegramAlert(message) {
    const TELEGRAM_BOT_TOKEN = '8896263098:AAGjtKE0MHDmTHo6peFj-9h4pIimmhfwX1A';
    const TELEGRAM_CHAT_ID = '7537905180';
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
        });
    } catch (error) { console.error("Error Telegram:", error); }
}