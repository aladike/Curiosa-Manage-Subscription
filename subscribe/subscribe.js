(function () {
    const config = window.CURIOSA_SUBSCRIBE_CONFIG || {};
    const apiBaseUrl = (config.apiBaseUrl || "").trim().replace(/\/$/, "");

    const subscribeCard = document.getElementById("subscribe-card");
    const form = document.getElementById("subscribe-form");
    const emailInput = document.getElementById("email");
    const inviteCodeInput = document.getElementById("invite-code");
    const companyInput = document.getElementById("company");
    const submittedAtInput = document.getElementById("submitted-at");
    const submitButton = document.getElementById("submit-button");
    const statusMessage = document.getElementById("status-message");
    const successCard = document.getElementById("success-card");
    const manageLink = document.getElementById("manage-link");
    const REQUEST_TIMEOUT_MS = 12000;

    function setStatus(message, tone) {
        statusMessage.textContent = message || "";
        statusMessage.classList.toggle("is-hidden", !message);
        statusMessage.classList.toggle("status-note-warm", tone === "warm");
        statusMessage.classList.toggle("status-note-success", tone === "success");
    }

    function resetSubmissionTimestamp() {
        if (submittedAtInput) {
            submittedAtInput.value = String(Date.now());
        }
    }

    function setBusy(isBusy) {
        submitButton.disabled = isBusy;
        emailInput.disabled = isBusy;
        inviteCodeInput.disabled = isBusy;
        companyInput.disabled = isBusy;
    }

    function normalizeManageUrl(rawUrl) {
        const parsed = new URL(rawUrl, window.location.href);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            throw new Error("request_failed");
        }
        return parsed.toString();
    }

    function showSuccess(manageUrl) {
        if (!subscribeCard || !successCard || !manageLink) {
            return;
        }

        manageLink.href = manageUrl;
        successCard.classList.remove("is-hidden");
        subscribeCard.classList.add("is-hidden");
        statusMessage.classList.add("is-hidden");
    }

    async function requestSubscription(email, inviteCode) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        let response;
        try {
            response = await fetch(apiBaseUrl, {
                method: "POST",
                mode: "cors",
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer",
                headers: {
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
                body: JSON.stringify({
                    email,
                    inviteCode,
                    company: companyInput.value,
                    submittedAt: Number(submittedAtInput.value) || Date.now(),
                }),
            });
        } finally {
            window.clearTimeout(timeoutId);
        }

        let payload = null;
        try {
            payload = await response.json();
        } catch (_error) {
            payload = null;
        }

        if (!response.ok) {
            const errorCode = payload && payload.error ? payload.error : "request_failed";
            throw new Error(errorCode);
        }

        if (!payload || typeof payload.manageUrl !== "string" || !payload.manageUrl.trim()) {
            throw new Error("request_failed");
        }

        return payload;
    }

    resetSubmissionTimestamp();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim();
        const inviteCode = inviteCodeInput.value.trim();

        if (!email || !inviteCode) {
            setStatus("Enter your email address and invite code.", "warm");
            return;
        }

        if (!apiBaseUrl) {
            setStatus("Subscription is temporarily unavailable. Please try again later.", "warm");
            return;
        }

        setBusy(true);
        setStatus("", "");

        try {
            const payload = await requestSubscription(email, inviteCode);
            const manageUrl = normalizeManageUrl(payload.manageUrl);
            form.reset();
            resetSubmissionTimestamp();
            showSuccess(manageUrl);
        } catch (error) {
            if (error instanceof Error && error.message === "invalid_request") {
                setStatus("We couldn't activate a subscription with those details.", "warm");
            } else if (error instanceof Error && error.message === "rate_limited") {
                setStatus("Please wait a few minutes before trying again.", "warm");
            } else if (error instanceof DOMException && error.name === "AbortError") {
                setStatus("Subscription is temporarily unavailable. Please try again later.", "warm");
            } else {
                setStatus("Subscription is temporarily unavailable. Please try again later.", "warm");
            }
        } finally {
            setBusy(false);
        }
    });
})();
