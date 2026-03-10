(function () {
    const config = window.CURIOSA_MANAGE_CONFIG || {};
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const flowStatus = (params.get("status") || "").trim().toLowerCase();
    const apiBaseUrl = (config.apiBaseUrl || "").trim().replace(/\/$/, "");

    const state = {
        token,
        apiBaseUrl,
        flowStatus,
        categories: [],
        allSourceIds: [],
        dbPreferencesEnabled: false,
    };

    const flowBanner = document.getElementById("flow-banner");
    const flowBannerTitle = document.getElementById("flow-banner-title");
    const flowBannerText = document.getElementById("flow-banner-text");
    const resubscribeButton = document.getElementById("resubscribe-button");
    const statusMessage = document.getElementById("status-message");
    const legacyNote = document.getElementById("legacy-note");
    const dailyCheckbox = document.getElementById("daily-enabled");
    const weeklyCheckbox = document.getElementById("weekly-enabled");
    const sourcesRoot = document.getElementById("sources-root");
    const saveButton = document.getElementById("save-button");
    const resetButton = document.getElementById("reset-button");

    function setStatus(message, tone) {
        statusMessage.textContent = message || "";
        statusMessage.classList.toggle("is-hidden", !message);
        statusMessage.classList.toggle("note-warm", tone === "warm");
    }

    function setBusy(isBusy) {
        saveButton.disabled = isBusy;
        resetButton.disabled = isBusy;
        resubscribeButton.disabled = isBusy;
    }

    function showFatal(message) {
        setStatus(message, "warm");
        saveButton.disabled = true;
        resetButton.disabled = true;
        dailyCheckbox.disabled = true;
        weeklyCheckbox.disabled = true;
    }

    function buildUnsubscribeApiUrl(action) {
        if (!apiBaseUrl) {
            return "";
        }

        const manageUrl = new URL(apiBaseUrl);
        const unsubscribeUrl = new URL("/functions/v1/unsubscribe", manageUrl.origin);
        unsubscribeUrl.searchParams.set("token", token);
        if (action) {
            unsubscribeUrl.searchParams.set("action", action);
        }
        unsubscribeUrl.searchParams.set("redirect", "0");
        return unsubscribeUrl.toString();
    }

    function updateFlowBanner() {
        const status = state.flowStatus;
        const visible = status === "unsubscribed" || status === "resubscribed";
        flowBanner.classList.toggle("is-hidden", !visible);
        flowBanner.classList.toggle("flow-banner-warm", status === "unsubscribed");
        flowBanner.classList.toggle("flow-banner-success", status === "resubscribed");
        resubscribeButton.classList.toggle("is-hidden", status !== "unsubscribed");

        if (!visible) {
            flowBannerTitle.textContent = "";
            flowBannerText.textContent = "";
            return;
        }

        if (status === "unsubscribed") {
            flowBannerTitle.textContent = "You have been unsubscribed successfully.";
            flowBannerText.textContent = "If this was a mistake, you can resubscribe below.";
            return;
        }

        flowBannerTitle.textContent = "You have been resubscribed successfully.";
        flowBannerText.textContent = "Your subscription is active again. You can update your settings below.";
    }

    function renderSources(categories, selectedSourceIds) {
        const selectedSet = selectedSourceIds === null
            ? new Set(state.allSourceIds)
            : new Set(selectedSourceIds);

        sourcesRoot.innerHTML = "";
        categories.forEach((category) => {
            const wrapper = document.createElement("section");
            wrapper.className = "category-card";
            if (category.id === "authorities") {
                wrapper.classList.add("category-card-authorities");
            }

            const header = document.createElement("div");
            header.className = "category-header";

            const heading = document.createElement("h3");
            heading.className = "category-title";
            heading.textContent = category.label;

            const actions = document.createElement("div");
            actions.className = "category-actions";

            const selectAllButton = document.createElement("button");
            selectAllButton.type = "button";
            selectAllButton.className = "category-action category-action-select";
            selectAllButton.textContent = "Select all";

            const clearAllButton = document.createElement("button");
            clearAllButton.type = "button";
            clearAllButton.className = "category-action category-action-clear";
            clearAllButton.textContent = "Clear all";

            const description = document.createElement("p");
            description.textContent = `${category.sources.length} available sources`;

            const grid = document.createElement("div");
            grid.className = "sources-grid";

            category.sources.forEach((source) => {
                const label = document.createElement("label");
                label.className = "source-card";

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = String(source.id);
                checkbox.checked = selectedSet.has(source.id);

                const textWrap = document.createElement("span");
                const titleRow = document.createElement("strong");
                titleRow.className = "source-title-row";

                const sourceName = document.createElement("span");
                sourceName.className = "source-name";
                sourceName.textContent = source.label;

                const badges = document.createElement("span");
                badges.className = "source-badges";

                if (category.id === "authorities") {
                    const authorityBadge = document.createElement("span");
                    authorityBadge.className = "pill pill-authorities";
                    authorityBadge.textContent = "Authorities";
                    badges.appendChild(authorityBadge);
                }

                const formatBadge = document.createElement("span");
                formatBadge.className = "pill pill-format";
                formatBadge.textContent = source.format.toUpperCase();
                badges.appendChild(formatBadge);

                titleRow.appendChild(sourceName);
                titleRow.appendChild(badges);
                textWrap.appendChild(titleRow);

                label.appendChild(checkbox);
                label.appendChild(textWrap);
                grid.appendChild(label);
            });

            function setCategorySelection(isChecked) {
                grid.querySelectorAll('input[type="checkbox"]').forEach((input) => {
                    input.checked = isChecked;
                });
            }

            selectAllButton.addEventListener("click", () => setCategorySelection(true));
            clearAllButton.addEventListener("click", () => setCategorySelection(false));

            actions.appendChild(selectAllButton);
            actions.appendChild(clearAllButton);
            header.appendChild(heading);
            header.appendChild(actions);

            wrapper.appendChild(header);
            wrapper.appendChild(description);
            wrapper.appendChild(grid);
            sourcesRoot.appendChild(wrapper);
        });
    }

    function collectSelectedSourceIds() {
        const checked = Array.from(
            sourcesRoot.querySelectorAll('input[type="checkbox"]:checked'),
        ).map((input) => Number(input.value)).sort((a, b) => a - b);

        if (checked.length === state.allSourceIds.length) {
            return null;
        }
        return checked;
    }

    async function requestJson(url, options) {
        const response = await fetch(url, options);
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

        return payload;
    }

    async function loadPreferences() {
        if (!token) {
            showFatal("This manage-subscription link is incomplete.");
            return;
        }
        if (!apiBaseUrl) {
            showFatal("Manage-subscription API base URL is not configured.");
            return;
        }

        setBusy(true);
        setStatus("Loading your subscription settings...");

        try {
            const payload = await requestJson(
                `${apiBaseUrl}?token=${encodeURIComponent(token)}`,
                { method: "GET", headers: { Accept: "application/json" } },
            );

            state.categories = payload.categories || [];
            state.allSourceIds = state.categories.flatMap((category) =>
                (category.sources || []).map((source) => source.id)
            ).sort((a, b) => a - b);
            state.dbPreferencesEnabled = Boolean(payload.db_preferences_enabled);

            dailyCheckbox.checked = Boolean(payload.daily_enabled);
            weeklyCheckbox.checked = Boolean(payload.weekly_enabled);
            legacyNote.classList.toggle("is-hidden", state.dbPreferencesEnabled);
            renderSources(state.categories, payload.selected_source_ids);

            setStatus(state.dbPreferencesEnabled
                ? "Your current DB-managed settings are loaded."
                : "Legacy preferences detected. Saving here will switch you to DB-managed settings.");
        } catch (error) {
            const code = error instanceof Error ? error.message : "request_failed";
            if (code === "invalid_token") {
                showFatal("This manage-subscription link is invalid.");
                return;
            }
            if (code === "missing_token") {
                showFatal("This manage-subscription link is incomplete.");
                return;
            }
            showFatal("Temporary error. Please try again later or contact us.");
        } finally {
            setBusy(false);
        }
    }

    async function resubscribe() {
        if (!token) {
            showFatal("This manage-subscription link is incomplete.");
            return;
        }

        const unsubscribeUrl = buildUnsubscribeApiUrl("resubscribe");
        if (!unsubscribeUrl) {
            setStatus("Could not resubscribe right now. Please try again later or contact us.", "warm");
            return;
        }

        setBusy(true);
        setStatus("Resubscribing...");

        try {
            const response = await fetch(unsubscribeUrl, {
                method: "GET",
                headers: {
                    Accept: "text/plain",
                },
            });

            if (!response.ok) {
                throw new Error("request_failed");
            }

            state.flowStatus = "resubscribed";
            updateFlowBanner();
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("status", "resubscribed");
            window.history.replaceState({}, "", nextUrl.toString());
            setStatus("You have been resubscribed successfully.");
        } catch (_error) {
            setStatus("Could not resubscribe right now. Please try again later or contact us.", "warm");
        } finally {
            setBusy(false);
        }
    }

    async function savePreferences() {
        setBusy(true);
        setStatus("Saving your changes...");

        try {
            const payload = await requestJson(
                `${apiBaseUrl}?token=${encodeURIComponent(token)}`,
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        db_preferences_enabled: true,
                        daily_enabled: dailyCheckbox.checked,
                        weekly_enabled: weeklyCheckbox.checked,
                        selected_source_ids: collectSelectedSourceIds(),
                    }),
                },
            );

            state.dbPreferencesEnabled = Boolean(payload.db_preferences_enabled);
            legacyNote.classList.add("is-hidden");
            setStatus("Your subscription settings have been saved.");
        } catch (_error) {
            setStatus("Could not save your changes. Please try again later or contact us.", "warm");
        } finally {
            setBusy(false);
        }
    }

    async function resetPreferences() {
        setBusy(true);
        setStatus("Resetting your settings...");

        try {
            const payload = await requestJson(
                `${apiBaseUrl}?action=reset&token=${encodeURIComponent(token)}`,
                {
                    method: "POST",
                    headers: { Accept: "application/json" },
                },
            );

            dailyCheckbox.checked = Boolean(payload.daily_enabled);
            weeklyCheckbox.checked = Boolean(payload.weekly_enabled);
            state.dbPreferencesEnabled = Boolean(payload.db_preferences_enabled);
            legacyNote.classList.add("is-hidden");
            renderSources(state.categories, payload.selected_source_ids);
            setStatus("Your subscription settings have been reset.");
        } catch (_error) {
            setStatus("Could not reset your settings. Please try again later or contact us.", "warm");
        } finally {
            setBusy(false);
        }
    }

    saveButton.addEventListener("click", savePreferences);
    resetButton.addEventListener("click", resetPreferences);
    resubscribeButton.addEventListener("click", resubscribe);
    updateFlowBanner();
    loadPreferences();
})();
