class BevatelSidebar extends HTMLElement {

    connectedCallback() {
        const activePage = this.getAttribute('active') ?? '';
        this.innerHTML = `
            <aside class="app-sidebar">

                <!-- Logo -->
                <a
                    href="/admin/"
                    class="app-sidebar-logo"
                    title="Bevatel"
                >
                    <span class="app-sidebar-logo-inner">
                        Fadol
                    </span>
                </a>


                <!-- Main Navigation -->
                <nav class="app-sidebar-navigation">

                    ${this.createItem({
                        page: 'dashboard',
                        activePage,
                        href: '/admin/',
                        title: 'Dashboard',
                        icon: `<path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />`,
                    })}

                    ${this.createItem({
                        page: 'conversations',
                        activePage,
                        href: '/admin/conversations',
                        title: 'Conversations',
                        icon: `<path d="M4 4h16v12H7l-3 3V4Zm3 5h10V7H7v2Zm0 4h7v-2H7v2Z" />`,
                    })}

                    ${this.createItem({
                        page: 'contacts',
                        activePage,
                        href: '/admin/contacts',
                        title: 'Contacts',
                        icon: `<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-4 3-6 7-6s7 2 7 6H5Z" />`,
                    })}

                    ${this.createItem({
                        page: 'campaigns',
                        activePage,
                        href: '/admin/campaigns',
                        title: 'Campaigns',
                        icon: `<path d="m3 11 15-6v14L3 13v-2Zm2 4 3 1v4H5v-5Z" />`,
                    })}

                    ${this.createItem({
                        page: 'teams',
                        activePage,
                        href: '/admin/teams',
                        title: 'Teams',
                        icon: `
                            <path
                                d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 19c0-4 3-6 6-6s6 2 6 6H2Zm10 0c0-2-.7-3.8-2-5 1.6-1 3.2-1 4-1 3 0 6 2 6 6h-8Z"
                            />
                        `,
                    })}

                    ${this.createItem({
                        page: 'users',
                        activePage,
                        href: '/admin/users',
                        title: 'Users',
                        icon: `<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8c0-4.4 3.6-6 8-6s8 1.6 8 6H4Z"/>`,
                    })}

                    ${this.createItem({
                        page: 'channels',
                        activePage,
                        href: '/admin/channels',
                        title: 'Channels',
                        icon: `<path d="M4 5h16v3H4V5Zm0 6h16v3H4v-3Zm0 6h16v2H4v-2Z" />`,
                    })}

                    ${this.createItem({
                        page: 'channels',
                        activePage,
                        href: '/admin/channels',
                        title: 'Channels',
                        icon: `<path d="M4 5h16v3H4V5Zm0 6h16v3H4v-3Zm0 6h16v2H4v-2Z"/>`,
                    })}

                    ${this.createItem({
                        page: 'reports',
                        activePage,
                        href: '/admin/reports',
                        title: 'Reports',
                        icon: `<path d="M4 3h16v18H4V3Zm3 14h2v-5H7v5Zm4 0h2V7h-2v10Zm4 0h2V9h-2v8Z"/>`,
                    })}
 
                </nav>


                <!-- Bottom Navigation -->
                <div class="app-sidebar-bottom">
                    ${this.createItem({
                        page: 'settings',
                        activePage,
                        href: '/admin/settings',
                        title: 'Settings',
                        icon: `
                            <path
                                d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15.3 6L15 3.5h-4L10.7 6A8 8 0 0 0 9 7.1l-2.4-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1.1l.3 2.5h4l.3-2.5a8 8 0 0 0 1.7-1.1l2.4 1 2-3.4-2-1.5ZM13 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"
                            />
                        `,
                    })}


                    <!-- Logout -->
                    <button
                        id="sidebar-logout-button"
                        class="app-sidebar-item app-sidebar-button"
                        type="button"
                        title="Logout"
                    >

                        <svg viewBox="0 0 24 24">
                            <path
                                d="M10 17v-2h4V9h-4V7l-5 5 5 5Zm3-14h7v18h-7v-2h5V5h-5V3Z"
                            />
                        </svg>

                        <span class="app-sidebar-tooltip">
                            Logout
                        </span>

                    </button>


                    <!-- Current User / Profile -->
                    <a
                        id="sidebar-user-avatar"
                        class="app-sidebar-user-avatar ${
                            activePage === 'profile'
                                ? 'active'
                                : ''
                        }"
                        href="/admin/profile"
                        title="My Profile"
                    >

                        <span
                            id="sidebar-user-initials"
                            class="app-sidebar-user-initials"
                        >
                            U
                        </span>

                        <span class="app-sidebar-tooltip">
                            My Profile
                        </span>

                    </a>

                </div>

            </aside>
        `;


        this.initializeUser();

        this.initializeLogout();
    }


    createItem({
        page,
        activePage,
        href,
        title,
        icon,
    }) {

        const activeClass =
            page === activePage
                ? 'active'
                : '';


        return `
            <a
                href="${href}"
                class="app-sidebar-item ${activeClass}"
                title="${title}"
            >

                <svg viewBox="0 0 24 24">
                    ${icon}
                </svg>

                <span class="app-sidebar-tooltip">
                    ${title}
                </span>

            </a>
        `;
    }


    initializeUser() {

        const initialsElement =
            this.querySelector(
                '#sidebar-user-initials',
            );


        const avatar =
            this.querySelector(
                '#sidebar-user-avatar',
            );


        if (
            !initialsElement ||
            !avatar
        ) {

            return;
        }


        let name =
            '';


        let email =
            '';


        try {

            const userKeys = [
                'bevatel_user',
                'user',
                'auth_user',
            ];


            for (
                const key of userKeys
            ) {

                const raw =
                    localStorage.getItem(
                        key,
                    );


                if (!raw) {

                    continue;
                }


                const user =
                    JSON.parse(
                        raw,
                    );


                name =
                    user?.name ?? '';


                email =
                    user?.email ?? '';


                if (
                    name ||
                    email
                ) {

                    break;
                }
            }


            /*
             * Existing login flow already stores
             * bevatel_email separately.
             */
            if (!email) {

                email =
                    localStorage.getItem(
                        'bevatel_email',
                    ) ?? '';
            }

        } catch (error) {

            console.warn(
                'Unable to read current user:',
                error,
            );
        }


        const displayValue =
            name ||
            email ||
            'User';


        initialsElement.textContent =
            this.getInitials(
                displayValue,
            );


        avatar.setAttribute(
            'title',
            name
                ? `${name} - My Profile`
                : 'My Profile',
        );
    }


    getInitials(
        value,
    ) {

        const words =
            String(
                value,
            )
                .trim()
                .split(
                    /\s+/,
                )
                .filter(
                    Boolean,
                );


        if (
            !words.length
        ) {

            return 'U';
        }


        if (
            words.length === 1
        ) {

            return words[0]
                .substring(
                    0,
                    2,
                )
                .toUpperCase();
        }


        return (
            words[0][0] +
            words[1][0]
        ).toUpperCase();
    }


    initializeLogout() {

        const button =
            this.querySelector(
                '#sidebar-logout-button',
            );


        button?.addEventListener(
            'click',

            () => {

                localStorage.removeItem(
                    'bevatel_token',
                );

                localStorage.removeItem(
                    'bevatel_email',
                );

                localStorage.removeItem(
                    'bevatel_user',
                );

                localStorage.removeItem(
                    'user',
                );

                localStorage.removeItem(
                    'auth_user',
                );


                window.location.href =
                    '/admin/conversations';
            },
        );
    }
}

customElements.define('bevatel-sidebar',BevatelSidebar);