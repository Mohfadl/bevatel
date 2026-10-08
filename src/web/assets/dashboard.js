(() => {
  'use strict';

  const API_URL =
    '/api/dashboard/overview';

  const PAGE_SIZE = 10;

  let dashboardData = null;
  let currentPage = 1;

  const elements = {
    openCount:
      document.getElementById(
        'openCount',
      ),

    resolvedCount:
      document.getElementById(
        'resolvedCount',
      ),

    snoozedCount:
      document.getElementById(
        'snoozedCount',
      ),

    onlineCount:
      document.getElementById(
        'onlineCount',
      ),

    busyCount:
      document.getElementById(
        'busyCount',
      ),

    offlineCount:
      document.getElementById(
        'offlineCount',
      ),

    agentsTableBody:
      document.getElementById(
        'agentsTableBody',
      ),

    agentsPresenceList:
      document.getElementById(
        'agentsPresenceList',
      ),

    agentsResultCount:
      document.getElementById(
        'agentsResultCount',
      ),

    statusFilter:
      document.getElementById(
        'statusFilter',
      ),

    teamFilter:
      document.getElementById(
        'teamFilter',
      ),

    previousPage:
      document.getElementById(
        'previousPage',
      ),

    nextPage:
      document.getElementById(
        'nextPage',
      ),

    pageInput:
      document.getElementById(
        'pageInput',
      ),

    totalPagesLabel:
      document.getElementById(
        'totalPagesLabel',
      ),

    tableResults:
      document.getElementById(
        'tableResults',
      ),

    refreshDashboard:
      document.getElementById(
        'refreshDashboard',
      ),

    sidebarUser:
      document.getElementById(
        'sidebarUser',
      ),

    toast:
      document.getElementById(
        'dashboardToast',
      ),
  };

  function getToken() {
    return (
      localStorage.getItem(
        'bevatel_token',
      ) || ''
    );
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function initials(name) {
    const words =
      String(name ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!words.length) {
      return 'U';
    }

    if (words.length === 1) {
      return words[0]
        .substring(0, 2)
        .toUpperCase();
    }

    return (
      words[0][0] +
      words[1][0]
    ).toUpperCase();
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(
      'en-US',
    ).format(
      Number(value ?? 0),
    );
  }

  function showToast(
    message,
    type = 'normal',
  ) {
    if (!elements.toast) {
      return;
    }

    elements.toast.textContent =
      message;

    elements.toast.className =
      type === 'error'
        ? 'toast show error'
        : 'toast show';

    window.setTimeout(
      () => {
        elements.toast.className =
          'toast';
      },
      3500,
    );
  }

  function getAgentStatus(agent) {
    /*
     * The first backend implementation does not yet expose
     * Socket.IO presence per agent.
     *
     * When status is later returned by the API, this frontend
     * automatically starts using it.
     */

    const status =
      String(
        agent.status ??
        agent.presenceStatus ??
        'OFFLINE',
      )
        .trim()
        .toUpperCase();

    if (
      status === 'ONLINE' ||
      status === 'BUSY'
    ) {
      return status;
    }

    return 'OFFLINE';
  }

  function renderSummary() {
    const conversations =
      dashboardData?.conversations ?? {};

    const agentStatus =
      dashboardData?.agentStatus ?? {};

    elements.openCount.textContent =
      formatNumber(
        conversations.open,
      );

    elements.resolvedCount.textContent =
      formatNumber(
        conversations.resolved,
      );

    elements.snoozedCount.textContent =
      formatNumber(
        conversations.snoozed,
      );

    elements.onlineCount.textContent =
      formatNumber(
        agentStatus.online,
      );

    elements.busyCount.textContent =
      formatNumber(
        agentStatus.busy,
      );

    elements.offlineCount.textContent =
      formatNumber(
        agentStatus.offline,
      );
  }

  function getFilteredAgents() {
    const agents =
      Array.isArray(
        dashboardData?.agents,
      )
        ? dashboardData.agents
        : [];

    const statusFilter =
      elements.statusFilter.value;

    if (!statusFilter) {
      return agents;
    }

    return agents.filter(
      (agent) =>
        getAgentStatus(agent) ===
        statusFilter,
    );
  }

  function renderTable() {
    const agents =
      Array.isArray(
        dashboardData?.agents,
      )
        ? dashboardData.agents
        : [];

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          agents.length /
          PAGE_SIZE,
        ),
      );

    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    if (currentPage < 1) {
      currentPage = 1;
    }

    const start =
      (currentPage - 1) *
      PAGE_SIZE;

    const end =
      Math.min(
        start + PAGE_SIZE,
        agents.length,
      );

    const pageAgents =
      agents.slice(
        start,
        end,
      );

    if (!pageAgents.length) {
      elements.agentsTableBody.innerHTML = `
        <tr>
          <td
            colspan="4"
            class="empty-cell"
          >
            No agents found
          </td>
        </tr>
      `;
    } else {
      elements.agentsTableBody.innerHTML =
        pageAgents
          .map(
            (agent) => `
              <tr>

                <td>

                  <div class="agent-cell">

                    <div class="agent-avatar">
                      ${escapeHtml(
                        initials(
                          agent.name,
                        ),
                      )}
                    </div>

                    <div class="agent-details">

                      <span class="agent-name">
                        ${escapeHtml(
                          agent.name,
                        )}
                      </span>

                      <span class="agent-email">
                        ${escapeHtml(
                          agent.email,
                        )}
                      </span>

                    </div>

                  </div>

                </td>

                <td class="numeric-cell">
                  ${formatNumber(
                    agent.open,
                  )}
                </td>

                <td class="numeric-cell">
                  ${formatNumber(
                    agent.resolved,
                  )}
                </td>

                <td class="numeric-cell">
                  ${formatNumber(
                    agent.snoozed,
                  )}
                </td>

              </tr>
            `,
          )
          .join('');
    }

    elements.pageInput.value =
      String(currentPage);

    elements.pageInput.max =
      String(totalPages);

    elements.totalPagesLabel.textContent =
      `- ${totalPages}`;

    elements.previousPage.disabled =
      currentPage <= 1;

    elements.nextPage.disabled =
      currentPage >= totalPages;

    elements.tableResults.textContent =
      `Results: ${
        agents.length
          ? start + 1
          : 0
      }-${end} Of ${agents.length}`;
  }

  function renderPresenceList() {
    const agents =
      getFilteredAgents();

    elements.agentsResultCount.textContent =
      `Showing ${agents.length} results`;

    if (!agents.length) {
      elements.agentsPresenceList.innerHTML = `
        <div class="empty-cell">
          No agents found
        </div>
      `;

      return;
    }

    elements.agentsPresenceList.innerHTML =
      agents
        .map(
          (agent) => {
            const status =
              getAgentStatus(agent);

            const statusLabel =
              status.charAt(0) +
              status
                .slice(1)
                .toLowerCase();

            const since =
              agent.statusSince
                ? formatStatusSince(
                    agent.statusSince,
                  )
                : '';

            return `
              <div class="presence-agent">

                <div class="agent-avatar">
                  ${escapeHtml(
                    initials(
                      agent.name,
                    ),
                  )}
                </div>

                <div class="presence-agent-main">

                  <span class="presence-agent-name">
                    ${escapeHtml(
                      agent.name,
                    )}
                  </span>

                  <span class="presence-agent-email">
                    ${escapeHtml(
                      agent.email,
                    )}
                  </span>

                </div>

                <div class="presence-agent-state">

                  <strong>
                    ${escapeHtml(
                      statusLabel,
                    )}
                  </strong>

                  ${
                    since
                      ? `
                        <small>
                          Since ${escapeHtml(
                            since,
                          )}
                        </small>
                      `
                      : ''
                  }

                </div>

              </div>
            `;
          },
        )
        .join('');
  }

  function formatStatusSince(value) {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return '';
    }

    const today =
      new Date();

    const sameDay =
      today.getFullYear() ===
        date.getFullYear() &&
      today.getMonth() ===
        date.getMonth() &&
      today.getDate() ===
        date.getDate();

    if (sameDay) {
      return date.toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        },
      );
    }

    return date.toLocaleDateString();
  }

  function render() {
    renderSummary();
    renderTable();
    renderPresenceList();
  }

  async function loadDashboard(
    silent = false,
  ) {
    const token =
      getToken();

    if (!token) {
        window.location.href =
            '/admin/conversations';

        return;
    }

    try {
      if (
        elements.refreshDashboard &&
        !silent
      ) {
        elements.refreshDashboard.disabled =
          true;
      }

      const response =
        await fetch(
          API_URL,
          {
            method: 'GET',

            headers: {
              Accept:
                'application/json',

              Authorization:
                `Bearer ${token}`,
            },

            cache: 'no-store',
          },
        );

        if (response.status === 401) {
            localStorage.removeItem(
                'bevatel_token',
            );

            window.location.href =
                '/admin/conversations';

            return;
        }

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
          'Unable to load dashboard',
        );
      }

      dashboardData =
        result.data;

      render();

      if (!silent) {
        showToast(
          'Dashboard updated',
        );
      }
    } catch (error) {
      console.error(
        'Load dashboard error:',
        error,
      );

      showToast(
        error instanceof Error
          ? error.message
          : 'Unable to load dashboard',
        'error',
      );
    } finally {
      if (
        elements.refreshDashboard
      ) {
        elements.refreshDashboard.disabled =
          false;
      }
    }
  }

  function initializeEvents() {
    elements.previousPage
      ?.addEventListener(
        'click',
        () => {
          if (
            currentPage <= 1
          ) {
            return;
          }

          currentPage--;

          renderTable();
        },
      );

    elements.nextPage
      ?.addEventListener(
        'click',
        () => {
          const agents =
            dashboardData?.agents ??
            [];

          const totalPages =
            Math.max(
              1,
              Math.ceil(
                agents.length /
                PAGE_SIZE,
              ),
            );

          if (
            currentPage >=
            totalPages
          ) {
            return;
          }

          currentPage++;

          renderTable();
        },
      );

    elements.pageInput
      ?.addEventListener(
        'change',
        () => {
          const agents =
            dashboardData?.agents ??
            [];

          const totalPages =
            Math.max(
              1,
              Math.ceil(
                agents.length /
                PAGE_SIZE,
              ),
            );

          const requested =
            Number(
              elements.pageInput.value,
            );

          if (
            !Number.isFinite(
              requested,
            )
          ) {
            return;
          }

          currentPage =
            Math.min(
              totalPages,
              Math.max(
                1,
                Math.floor(
                  requested,
                ),
              ),
            );

          renderTable();
        },
      );

    elements.statusFilter
      ?.addEventListener(
        'change',
        () => {
          renderPresenceList();
        },
      );

    elements.teamFilter
      ?.addEventListener(
        'change',
        () => {
          renderPresenceList();
        },
      );

    elements.refreshDashboard
      ?.addEventListener(
        'click',
        () => {
          loadDashboard();
        },
      );
  }

  function initializeRealtime() {
    if (
      typeof window.io !==
      'function'
    ) {
      return;
    }

    const token =
      getToken();

    if (!token) {
      return;
    }

    try {
      const socket =
        window.io({
          auth: {
            token,
          },
        });

      const refreshEvents = [
        'conversation.created',
        'conversation.updated',
        'conversation.assigned',
        'conversation.resolved',
        'message.created',
        'message.updated',
        'message.status.updated',
        'agent.presence',
      ];

      let refreshTimer = null;

      const scheduleRefresh =
        () => {
          window.clearTimeout(
            refreshTimer,
          );

          refreshTimer =
            window.setTimeout(
              () => {
                loadDashboard(true);
              },
              400,
            );
        };

      for (
        const eventName
        of refreshEvents
      ) {
        socket.on(
          eventName,
          scheduleRefresh,
        );
      }

      socket.on(
        'connect_error',
        (error) => {
          console.warn(
            'Dashboard socket error:',
            error.message,
          );
        },
      );
    } catch (error) {
      console.warn(
        'Unable to initialize dashboard realtime:',
        error,
      );
    }
  }

  function initializeSidebarUser() {
    /*
     * Keep this independent of JWT parsing.
     * We do not need to decode authentication data in
     * the browser just to render the dashboard.
     */

    if (
      elements.sidebarUser
    ) {
      elements.sidebarUser.textContent =
        'U';
    }
  }

  async function initialize() {
    initializeEvents();

    initializeSidebarUser();

    await loadDashboard(true);

    initializeRealtime();
  }

  initialize();
})();