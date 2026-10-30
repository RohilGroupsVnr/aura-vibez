// AURA — Phone Number + OTP Authentication

import {
    auth,
    db,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "./firebase.js";

// Authentication state
let recaptchaVerifier = null;
let confirmationResult = null;
let captchaVerified = false;
let sendingOtp = false;
let verifyingOtp = false;

// HTML elements
const phoneForm = document.getElementById("auraPhoneForm");
const phoneInput = document.getElementById("auraPhone");
const otpInput = document.getElementById("auraOtp");
const sendOtpBtn = document.getElementById("auraSendOtp");
const verifyOtpBtn = document.getElementById("auraVerifyOtp");
const phoneMsg = document.getElementById("auraPhoneMsg");
const otpSection = document.getElementById("auraOtpSection");

// Show messages
function showMessage(message, success = false) {
    if (!phoneMsg) return;

    phoneMsg.textContent = message;
    phoneMsg.classList.toggle("ok", success);
}

// Button loading state
function setLoading(button, loading, normalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : normalText;
}

// Firebase error messages
function getFirebaseError(error) {
    switch (error?.code) {
        case "auth/invalid-phone-number":
            return "Enter a valid mobile number.";
        case "auth/invalid-verification-code":
            return "Incorrect OTP. Please try again.";
        case "auth/code-expired":
            return "OTP expired. Please request a new OTP.";
        case "auth/session-expired":
            return "Your verification session expired. Request a new OTP.";
        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";
        case "auth/quota-exceeded":
            return "SMS quota exceeded. Please check Firebase billing and quota.";
        case "auth/network-request-failed":
            return "Network error. Check your internet connection.";
        case "auth/operation-not-allowed":
            return "Phone authentication is not allowed for the Firebase project used by this page.";
        case "auth/captcha-check-failed":
            return "reCAPTCHA verification failed. Please try again.";
        case "auth/invalid-app-credential":
            return "App verification failed. Check Firebase configuration and reCAPTCHA.";
        case "auth/billing-not-enabled":
            return "Firebase billing configuration must be checked.";
        default:
            return error?.message || "Something went wrong. Please try again.";
    }
}

// Clear reCAPTCHA
function clearRecaptcha() {
    if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        recaptchaVerifier = null;
    }
    captchaVerified = false;
}

// Create reCAPTCHA
function createRecaptcha() {
    if (recaptchaVerifier) {
        return recaptchaVerifier;
    }

    recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
            size: "normal",
            callback: () => {
                captchaVerified = true;
                showMessage("Verification completed. Click Send OTP again.");
            },
            "expired-callback": () => {
                captchaVerified = false;
                showMessage("Verification expired. Please verify again.");
            }
        }
    );

    return recaptchaVerifier;
}

// STEP 1: Send OTP
phoneForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (sendingOtp) return;

    let rawInput = phoneInput?.value.trim() || "";

    // 🔥 FIX: Remove any spaces, dashes, or brackets
    let cleanNumber = rawInput.replace(/[\s\-\(\)]/g, "");

    // 🔥 FIX: Check if user typed just 10 digits (without country code)
    if (/^\d{10}$/.test(cleanNumber)) {
        cleanNumber = "+91" + cleanNumber; // Add India code
    }
    // 🔥 FIX: If user typed 91 at the start (e.g. 919876543210)
    else if (/^91\d{10}$/.test(cleanNumber)) {
        cleanNumber = "+" + cleanNumber;
    }

    // Final validation (must start with + and have 10-15 digits)
    if (!/^\+[1-9]\d{9,14}$/.test(cleanNumber)) {
        showMessage("Enter a valid 10-digit mobile number.");
        phoneInput?.focus();
        return;
    }

    // First click: render reCAPTCHA
    if (!recaptchaVerifier) {
        sendingOtp = true;
        setLoading(sendOtpBtn, true, "Send OTP");
        showMessage("Preparing phone verification...");

        try {
            const verifier = createRecaptcha();
            await verifier.render();
            showMessage("Complete the reCAPTCHA checkbox, then click Send OTP again.");
        } catch (error) {
            console.error("reCAPTCHA initialization error:", error.code, error.message);
            showMessage(`${error.code || "Error"}: ${getFirebaseError(error)}`);
            clearRecaptcha();
        } finally {
            sendingOtp = false;
            setLoading(sendOtpBtn, false, "Send OTP");
        }
        return;
    }

    // Wait until the checkbox is completed
    if (!captchaVerified) {
        showMessage("Please complete the reCAPTCHA checkbox first.");
        return;
    }

    sendingOtp = true;
    setLoading(sendOtpBtn, true, "Send OTP");
    showMessage("Sending OTP...");

    try {
        confirmationResult = await signInWithPhoneNumber(
            auth,
            cleanNumber, // 🔥 Pass the cleaned number with +91
            recaptchaVerifier
        );

        if (otpSection) {
            otpSection.hidden = false;
        }

        if (otpInput) {
            otpInput.value = "";
            otpInput.focus();
        }

        showMessage(`OTP sent to ${cleanNumber}. Please check your SMS.`, true);

    } catch (error) {
        console.error("Send OTP Firebase error:", error.code, error.message);
        showMessage(`${error.code || "Error"}: ${getFirebaseError(error)}`);
        confirmationResult = null;
        clearRecaptcha();
    } finally {
        sendingOtp = false;
        setLoading(sendOtpBtn, false, "Send OTP");
    }
});

// STEP 2: Verify OTP and create/load the user profile
verifyOtpBtn?.addEventListener("click", async () => {
    if (verifyingOtp) return;

    const otp = otpInput?.value.trim() || "";

    if (!confirmationResult) {
        showMessage("Please request an OTP first.");
        return;
    }

    if (!/^\d{6}$/.test(otp)) {
        showMessage("Enter the 6-digit OTP.");
        otpInput?.focus();
        return;
    }

    verifyingOtp = true;
    setLoading(verifyOtpBtn, true, "Verify OTP");
    showMessage("Verifying OTP...");

    try {
        const result = await confirmationResult.confirm(otp);
        const user = result.user;

        const profileRef = doc(db, "users", user.uid);
        const profileSnapshot = await getDoc(profileRef);

        if (!profileSnapshot.exists()) {
            await setDoc(profileRef, {
                uid: user.uid,
                phone: user.phoneNumber || "",
                name: "AURA Customer",
                role: "user",
                createdAt: serverTimestamp()
            });
        }

        showMessage("Login successful! Redirecting...", true);
        // 🔥 Wait for 800ms to let Firebase save the session in localStorage
        setTimeout(() => {
            window.location.reload();
        }, 800);

    } catch (error) {
        console.error("OTP verification Firebase error:", error.code, error.message);
        showMessage(`${error.code || "Error"}: ${getFirebaseError(error)}`);
    } finally {
        verifyingOtp = false;
        setLoading(verifyOtpBtn, false, "Verify OTP");
    }
});