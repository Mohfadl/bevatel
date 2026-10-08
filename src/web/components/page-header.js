class BevatelPageHeader extends HTMLElement {

    connectedCallback() {

        /*
         * Save all elements originally placed inside:
         *
         * <bevatel-page-header>
         *     <button>...</button>
         * </bevatel-page-header>
         *
         * before replacing this component's HTML.
         */
        const originalChildren =
            Array.from(this.childNodes);


        const title =
            this.getAttribute('title') ?? '';


        const subtitle =
            this.getAttribute('subtitle') ?? '';


        const showMenu =
            this.getAttribute('show-menu') === 'true';


        /*
         * Build the component structure.
         *
         * IMPORTANT:
         * We do NOT use <slot> here because this component
         * uses Light DOM rather than Shadow DOM.
         */
        this.innerHTML = `
            <header class="app-page-header">

                <div class="app-page-header-left">

                    ${
                        showMenu
                            ? `
                                <button
                                    class="app-page-header-menu"
                                    type="button"
                                    aria-label="Menu"
                                    title="Menu"
                                >
                                    ☰
                                </button>
                            `
                            : ''
                    }

                    <div class="app-page-header-heading">

                        <h1 class="app-page-header-title">
                            ${this.escapeHtml(title)}
                        </h1>

                        ${
                            subtitle
                                ? `
                                    <p class="app-page-header-subtitle">
                                        ${this.escapeHtml(subtitle)}
                                    </p>
                                `
                                : ''
                        }

                    </div>

                </div>


                <div class="app-page-header-actions">
                </div>

            </header>
        `;


        /*
         * Move the original child elements into the
         * actions container.
         *
         * This preserves:
         *
         * #add-segment-button
         * #import-button
         * #export-button
         * #new-contact-button
         *
         * and any future page-header actions.
         */
        const actions =
            this.querySelector(
                '.app-page-header-actions',
            );


        if (actions) {

            for (const child of originalChildren) {

                /*
                 * Ignore whitespace-only text nodes created
                 * by HTML indentation.
                 */
                if (
                    child.nodeType === Node.TEXT_NODE &&
                    !child.textContent?.trim()
                ) {
                    continue;
                }


                actions.appendChild(child);
            }
        }
    }


    escapeHtml(value) {

        return String(value ?? '')
            .replaceAll(
                '&',
                '&amp;',
            )
            .replaceAll(
                '<',
                '&lt;',
            )
            .replaceAll(
                '>',
                '&gt;',
            )
            .replaceAll(
                '"',
                '&quot;',
            )
            .replaceAll(
                "'",
                '&#039;',
            );
    }
}


if (
    !customElements.get(
        'bevatel-page-header',
    )
) {

    customElements.define(
        'bevatel-page-header',
        BevatelPageHeader,
    );
}