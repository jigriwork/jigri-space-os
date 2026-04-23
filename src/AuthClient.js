/**
 * AuthClient — handles Jigri session authentication.
 * Uses the in-app dark modal instead of browser prompt().
 */
export class AuthClient {
    constructor(aiProvider, storage) {
        this.aiProvider = aiProvider;
        this.storage = storage;
        this.session = storage.getSession();
        this.user = null;
        this.isAuthenticating = false;
        this._resolveAuth = null;
        this._rejectAuth = null;

        this._bindModal();
    }

    getAccessToken() {
        return this.session?.access_token || null;
    }

    getConversationId() {
        return this.storage.getConversationId();
    }

    saveConversationId(conversationId) {
        this.storage.saveConversationId(conversationId || null);
    }

    async restore() {
        const token = this.getAccessToken();
        if (!token) return null;

        const user = await this.aiProvider.getMe(token);
        if (!user) {
            this.storage.clearSession();
            this.session = null;
            this.user = null;
            return null;
        }

        this.user = user;
        return user;
    }

    async ensureSession() {
        if (this.getAccessToken()) {
            if (!this.user) {
                this.user = await this.aiProvider.getMe(this.getAccessToken());
            }
            if (this.user) return this.session;
        }

        if (this.isAuthenticating) {
            // Return the in-flight promise
            return new Promise((resolve, reject) => {
                const prev = { resolve: this._resolveAuth, reject: this._rejectAuth };
                this._resolveAuth = (v) => { prev.resolve?.(v); resolve(v); };
                this._rejectAuth = (e) => { prev.reject?.(e); reject(e); };
            });
        }

        this.isAuthenticating = true;

        return new Promise((resolve, reject) => {
            this._resolveAuth = (session) => {
                this.isAuthenticating = false;
                resolve(session);
            };
            this._rejectAuth = (err) => {
                this.isAuthenticating = false;
                reject(err);
            };

            this._showModal();
        });
    }

    // ─── Modal logic ───────────────────────────────────

    _bindModal() {
        this._overlay = document.getElementById('auth-overlay');
        if (!this._overlay) return;

        this._stepEmail = document.getElementById('auth-step-email');
        this._stepOtp = document.getElementById('auth-step-otp');
        this._stepLoading = document.getElementById('auth-step-loading');
        this._stepSuccess = document.getElementById('auth-step-success');

        this._emailInput = document.getElementById('auth-email-input');
        this._otpInput = document.getElementById('auth-otp-input');
        this._emailError = document.getElementById('auth-email-error');
        this._otpError = document.getElementById('auth-otp-error');
        this._otpHint = document.getElementById('auth-otp-hint');
        this._loadingText = document.getElementById('auth-loading-text');

        this._emailSubmit = document.getElementById('auth-email-submit');
        this._otpSubmit = document.getElementById('auth-otp-submit');
        this._skipBtn = document.getElementById('auth-skip');
        this._otpBack = document.getElementById('auth-otp-back');

        this._emailSubmit?.addEventListener('click', () => this._handleEmailSubmit());
        this._otpSubmit?.addEventListener('click', () => this._handleOtpSubmit());
        this._skipBtn?.addEventListener('click', () => this._handleSkip());
        this._otpBack?.addEventListener('click', () => this._showStep('email'));

        this._emailInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._handleEmailSubmit();
        });
        this._otpInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._handleOtpSubmit();
        });
    }

    _showModal() {
        if (!this._overlay) {
            // Modal not in DOM — reject gracefully
            this._rejectAuth?.(new Error('Auth modal not available'));
            return;
        }
        this._currentEmail = '';
        this._emailInput.value = '';
        this._otpInput.value = '';
        this._clearErrors();
        this._showStep('email');
        this._overlay.classList.remove('hidden');
        setTimeout(() => this._emailInput?.focus(), 80);
    }

    _hideModal() {
        this._overlay?.classList.add('hidden');
    }

    _showStep(step) {
        const steps = { email: this._stepEmail, otp: this._stepOtp, loading: this._stepLoading, success: this._stepSuccess };
        Object.entries(steps).forEach(([key, el]) => {
            if (!el) return;
            el.classList.toggle('hidden', key !== step);
        });
    }

    _showError(target, msg) {
        if (!target) return;
        target.textContent = msg;
        target.classList.remove('hidden');
    }

    _clearErrors() {
        this._emailError?.classList.add('hidden');
        this._otpError?.classList.add('hidden');
    }

    async _handleEmailSubmit() {
        const email = (this._emailInput?.value || '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
            this._showError(this._emailError, 'Please enter a valid email address.');
            return;
        }

        this._clearErrors();
        this._currentEmail = email;
        this._showStep('loading');
        if (this._loadingText) this._loadingText.textContent = 'Sending you a code...';

        try {
            await this.aiProvider.requestOtp(email);
            if (this._otpHint) this._otpHint.textContent = `We sent a 6-digit code to ${email}`;
            this._showStep('otp');
            setTimeout(() => this._otpInput?.focus(), 80);
        } catch (err) {
            this._showStep('email');
            this._showError(this._emailError, err.message || 'Could not send a code. Please try again.');
        }
    }

    async _handleOtpSubmit() {
        const otp = (this._otpInput?.value || '').trim();
        if (!otp || otp.length < 4) {
            this._showError(this._otpError, 'Please enter the code from your email.');
            return;
        }

        this._clearErrors();
        this._showStep('loading');
        if (this._loadingText) this._loadingText.textContent = 'Verifying...';

        try {
            const data = await this.aiProvider.verifyOtp(this._currentEmail, otp);
            this.session = data.session;
            this.user = data.user || null;
            this.storage.saveSession(this.session);
            this._showStep('success');
            setTimeout(() => {
                this._hideModal();
                this._resolveAuth?.(this.session);
            }, 1400);
        } catch (err) {
            this._showStep('otp');
            this._showError(this._otpError, err.message || 'That code didn\'t work. Please try again.');
        }
    }

    _handleSkip() {
        this._hideModal();
        this._rejectAuth?.(new Error('Auth skipped by user'));
    }
}