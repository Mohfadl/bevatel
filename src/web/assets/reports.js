(() => {
    'use strict';

    const API_URL =
        '/api/reports/overview';

    const TOKEN_KEY =
        'bevatel_token';

    let currentReport =
        null;

    const elements = {};

    document.addEventListener(
        'DOMContentLoaded',
        initialize,
    );

    function initialize() {
        cacheElements();

        if (!getToken()) {
            redirectToLogin();
            return;
        }

        initializeDates();

        bindEvents();

        loadReport();
    }

    function cacheElements() {
        elements.from =
            document.getElementById(
                'report-from',
            );

        elements.to =
            document.getElementById(
                'report-to',
            );

        elements.apply =
            document.getElementById(
                'apply-report-filter',
            );

        elements.download =
            document.getElementById(
                'download-report',
            );

        elements.error =
            document.getElementById(
                'report-error',
            );

        elements.traffic =
            document.getElementById(
                'traffic-heatmap',
            );

        elements.agentsBody =
            document.getElementById(
                'agents-report-body',
            );

        elements.channels =
            document.getElementById(
                'channel-report',
            );
    }

    function bindEvents() {
        elements.apply
            ?.addEventListener(
                'click',
                loadReport,
            );

        elements.download
            ?.addEventListener(
                'click',
                downloadCsv,
            );
    }

    function initializeDates() {
        const now =
            new Date();

        const to =
            formatDate(now);

        const fromDate =
            new Date(now);

        fromDate.setDate(
            fromDate.getDate() - 6,
        );

        const from =
            formatDate(fromDate);

        if (elements.from) {
            elements.from.value =
                from;
        }

        if (elements.to) {
            elements.to.value =
                to;
        }
    }

    async function loadReport() {
        hideError();

        setLoading(true);

        try {
            const from =
                elements.from?.value;

            const to =
                elements.to?.value;

            const params =
                new URLSearchParams();

            if (from) {
                params.set(
                    'from',
                    from,
                );
            }

            if (to) {
                params.set(
                    'to',
                    to,
                );
            }

            const response =
                await fetch(
                    `${API_URL}?${params.toString()}`,
                    {
                        method: 'GET',

                        headers: {
                            Accept:
                                'application/json',

                            Authorization:
                                `Bearer ${getToken()}`,
                        },
                    },
                );

            if (
                response.status === 401
            ) {
                redirectToLogin();
                return;
            }

            const result =
                await response.json();

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ||
                    'Unable to load reports.',
                );
            }

            currentReport =
                result.data;

            renderReport(
                currentReport,
            );
        } catch (error) {
            console.error(
                'Reports error:',
                error,
            );

            showError(
                error instanceof Error
                    ? error.message
                    : 'Unable to load reports.',
            );
        } finally {
            setLoading(false);
        }
    }

    function renderReport(data) {
        renderConversationStatus(
            data.conversationStatus,
        );

        renderAgentStatus(
            data.agentStatus,
        );

        renderTraffic(
            data.conversationTraffic ||
            [],
        );

        renderAgents(
            data.agents || [],
        );

        renderChannels(
            data.channels || [],
        );
    }

    function renderConversationStatus(
        status,
    ) {
        setText(
            'status-open',
            status?.open ?? 0,
        );

        setText(
            'status-unattended',
            status?.unattended ?? 0,
        );

        setText(
            'status-resolved',
            status?.resolved ?? 0,
        );

        setText(
            'status-closed',
            status?.closed ?? 0,
        );

        setText(
            'status-unassigned',
            status?.unassigned ?? 0,
        );
    }

    function renderAgentStatus(
        status,
    ) {
        setText(
            'agents-online',
            status?.online ?? 0,
        );

        setText(
            'agents-busy',
            status?.busy ?? 0,
        );

        setText(
            'agents-offline',
            status?.offline ?? 0,
        );
    }

    function renderTraffic(
        traffic,
    ) {
        if (!elements.traffic) {
            return;
        }

        elements.traffic.innerHTML =
            '';

        if (
            !Array.isArray(traffic) ||
            traffic.length === 0
        ) {
            elements.traffic.innerHTML =
                '<div class="empty-table">No traffic data.</div>';

            return;
        }

        const dates =
            new Map();

        let maxCount = 0;

        for (
            const item of traffic
        ) {
            if (
                !dates.has(item.date)
            ) {
                dates.set(
                    item.date,
                    {
                        day: item.day,
                        cells: [],
                    },
                );
            }

            dates
                .get(item.date)
                .cells
                .push(item);

            maxCount =
                Math.max(
                    maxCount,
                    Number(
                        item.count ||
                        0,
                    ),
                );
        }

        for (
            const [
                date,
                rowData,
            ] of dates
        ) {
            const row =
                document.createElement(
                    'div',
                );

            row.className =
                'heatmap-row';

            const day =
                document.createElement(
                    'div',
                );

            day.className =
                'heatmap-day';

            day.innerHTML = `
                <div>
                    <strong>
                        ${escapeHtml(
                            rowData.day,
                        )}
                    </strong>

                    ${escapeHtml(
                        formatReadableDate(
                            date,
                        ),
                    )}
                </div>
            `;

            row.appendChild(day);

            const cells =
                [...rowData.cells]
                    .sort(
                        (
                            a,
                            b,
                        ) =>
                            a.hour -
                            b.hour,
                    );

            for (
                let hour = 0;
                hour < 24;
                hour += 1
            ) {
                const data =
                    cells.find(
                        cell =>
                            Number(
                                cell.hour,
                            ) ===
                            hour,
                    );

                const count =
                    Number(
                        data?.count ??
                        0,
                    );

                const cell =
                    document.createElement(
                        'div',
                    );

                cell.className =
                    `heatmap-cell ${getHeatLevel(
                        count,
                        maxCount,
                    )}`;

                cell.title =
                    `${date} ${padHour(hour)}:00 - ${count} conversation${count === 1 ? '' : 's'}`;

                row.appendChild(
                    cell,
                );
            }

            elements.traffic
                .appendChild(row);
        }

        renderHeatmapHours();
    }

    function renderHeatmapHours() {
        const row =
            document.createElement(
                'div',
            );

        row.className =
            'heatmap-hours';

        row.appendChild(
            document.createElement(
                'div',
            ),
        );

        for (
            let hour = 0;
            hour < 24;
            hour += 1
        ) {
            const element =
                document.createElement(
                    'div',
                );

            element.className =
                'heatmap-hour';

            element.textContent =
                `${hour}-${hour + 1}`;

            row.appendChild(
                element,
            );
        }

        elements.traffic
            .appendChild(row);
    }

    function getHeatLevel(
        count,
        maximum,
    ) {
        if (
            count <= 0 ||
            maximum <= 0
        ) {
            return '';
        }

        const ratio =
            count / maximum;

        if (ratio <= 0.2) {
            return 'level-1';
        }

        if (ratio <= 0.4) {
            return 'level-2';
        }

        if (ratio <= 0.6) {
            return 'level-3';
        }

        if (ratio <= 0.8) {
            return 'level-4';
        }

        return 'level-5';
    }

    function renderAgents(
        agents,
    ) {
        if (!elements.agentsBody) {
            return;
        }

        if (
            !Array.isArray(agents) ||
            agents.length === 0
        ) {
            elements.agentsBody
                .innerHTML = `
                    <tr>
                        <td
                            colspan="6"
                            class="empty-table"
                        >
                            No agents found.
                        </td>
                    </tr>
                `;

            return;
        }

        elements.agentsBody.innerHTML =
            agents
                .map(agent => {
                    const initials =
                        getInitials(
                            agent.name,
                        );

                    return `
                        <tr>

                            <td>

                                <div class="agent-info">

                                    <div class="agent-avatar">
                                        ${escapeHtml(
                                            initials,
                                        )}
                                    </div>

                                    <div class="agent-details">

                                        <strong>
                                            ${escapeHtml(
                                                agent.name,
                                            )}
                                        </strong>

                                        <span>
                                            ${escapeHtml(
                                                agent.email,
                                            )}
                                        </span>

                                    </div>

                                </div>

                            </td>

                            <td>
                                ${number(
                                    agent.open,
                                )}
                            </td>

                            <td>
                                ${number(
                                    agent.pending,
                                )}
                            </td>

                            <td>
                                ${number(
                                    agent.resolved,
                                )}
                            </td>

                            <td>
                                ${number(
                                    agent.closed,
                                )}
                            </td>

                            <td>
                                <strong>
                                    ${number(
                                        agent.total,
                                    )}
                                </strong>
                            </td>

                        </tr>
                    `;
                })
                .join('');
    }

    function renderChannels(
        channels,
    ) {
        if (!elements.channels) {
            return;
        }

        if (
            !Array.isArray(channels) ||
            channels.length === 0
        ) {
            elements.channels.innerHTML =
                '<div class="empty-table">No channel data.</div>';

            return;
        }

        elements.channels.innerHTML =
            channels
                .map(channel => {
                    const percentage =
                        Number(
                            channel.percentage ||
                            0,
                        );

                    return `
                        <article class="channel-item">

                            <div class="channel-item-header">

                                <strong>
                                    ${escapeHtml(
                                        formatChannel(
                                            channel.channel,
                                        ),
                                    )}
                                </strong>

                                <span>
                                    ${number(
                                        channel.conversations,
                                    )}
                                </span>

                            </div>

                            <div class="channel-progress">

                                <div
                                    class="channel-progress-value"
                                    style="width: ${Math.min(
                                        100,
                                        Math.max(
                                            0,
                                            percentage,
                                        ),
                                    )}%"
                                ></div>

                            </div>

                            <span>
                                ${percentage.toFixed(
                                    2,
                                )}%
                            </span>

                        </article>
                    `;
                })
                .join('');
    }

    function downloadCsv() {
        if (!currentReport) {
            showError(
                'Load the report before downloading it.',
            );

            return;
        }

        const rows = [
            [
                'Report From',
                currentReport.range.from,
            ],

            [
                'Report To',
                currentReport.range.to,
            ],

            [],

            [
                'Conversation Status',
                'Count',
            ],

            [
                'Open',
                currentReport
                    .conversationStatus
                    .open,
            ],

            [
                'Unattended',
                currentReport
                    .conversationStatus
                    .unattended,
            ],

            [
                'Resolved',
                currentReport
                    .conversationStatus
                    .resolved,
            ],

            [
                'Closed',
                currentReport
                    .conversationStatus
                    .closed,
            ],

            [
                'Unassigned',
                currentReport
                    .conversationStatus
                    .unassigned,
            ],

            [],

            [
                'Agent',
                'Email',
                'Open',
                'Pending',
                'Resolved',
                'Closed',
                'Total',
            ],
        ];

        for (
            const agent of
                currentReport.agents ||
                []
        ) {
            rows.push([
                agent.name,
                agent.email,
                agent.open,
                agent.pending,
                agent.resolved,
                agent.closed,
                agent.total,
            ]);
        }

        rows.push([]);

        rows.push([
            'Channel',
            'Conversations',
            'Percentage',
        ]);

        for (
            const channel of
                currentReport.channels ||
                []
        ) {
            rows.push([
                channel.channel,
                channel.conversations,
                `${channel.percentage}%`,
            ]);
        }

        const csv =
            rows
                .map(row =>
                    row
                        .map(csvValue)
                        .join(','),
                )
                .join('\n');

        const blob =
            new Blob(
                [
                    '\uFEFF',
                    csv,
                ],
                {
                    type:
                        'text/csv;charset=utf-8;',
                },
            );

        const url =
            URL.createObjectURL(
                blob,
            );

        const link =
            document.createElement(
                'a',
            );

        link.href =
            url;

        link.download =
            `bevatel-report-${currentReport.range.from}-${currentReport.range.to}.csv`;

        document.body
            .appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(
            url,
        );
    }

    function csvValue(
        value,
    ) {
        const text =
            String(
                value ?? '',
            );

        return `"${text.replace(
            /"/g,
            '""',
        )}"`;
    }

    function setLoading(
        loading,
    ) {
        if (elements.apply) {
            elements.apply.disabled =
                loading;

            elements.apply.textContent =
                loading
                    ? 'Loading...'
                    : 'Apply';
        }
    }

    function setText(
        id,
        value,
    ) {
        const element =
            document.getElementById(
                id,
            );

        if (element) {
            element.textContent =
                number(value);
        }
    }

    function number(
        value,
    ) {
        return Number(
            value || 0,
        ).toLocaleString();
    }

    function getInitials(
        name,
    ) {
        const parts =
            String(
                name || 'User',
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (
            parts.length === 0
        ) {
            return 'U';
        }

        if (
            parts.length === 1
        ) {
            return parts[0]
                .slice(
                    0,
                    2,
                )
                .toUpperCase();
        }

        return (
            parts[0][0] +
            parts[
                parts.length - 1
            ][0]
        ).toUpperCase();
    }

    function formatChannel(
        channel,
    ) {
        const values = {
            WHATSAPP:
                'WhatsApp',

            FACEBOOK:
                'Facebook',

            INSTAGRAM:
                'Instagram',

            SMS:
                'SMS',

            EMAIL:
                'Email',

            WEBCHAT:
                'Web Chat',

            PHONE:
                'Phone',
        };

        return (
            values[channel] ||
            channel ||
            'Unknown'
        );
    }

    function formatReadableDate(
        value,
    ) {
        const date =
            new Date(
                `${value}T00:00:00`,
            );

        return date
            .toLocaleDateString(
                'en-US',
                {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                },
            );
    }

    function formatDate(
        date,
    ) {
        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1,
            ).padStart(
                2,
                '0',
            );

        const day =
            String(
                date.getDate(),
            ).padStart(
                2,
                '0',
            );

        return `${year}-${month}-${day}`;
    }

    function padHour(
        hour,
    ) {
        return String(
            hour,
        ).padStart(
            2,
            '0',
        );
    }

    function showError(
        message,
    ) {
        if (!elements.error) {
            return;
        }

        elements.error.textContent =
            message;

        elements.error.hidden =
            false;
    }

    function hideError() {
        if (!elements.error) {
            return;
        }

        elements.error.hidden =
            true;

        elements.error.textContent =
            '';
    }

    function getToken() {
        return localStorage
            .getItem(
                TOKEN_KEY,
            );
    }

    function redirectToLogin() {
        localStorage.removeItem(
            TOKEN_KEY,
        );

        window.location.href =
            '/admin/';
    }

    function escapeHtml(
        value,
    ) {
        return String(
            value ?? '',
        )
            .replace(
                /&/g,
                '&amp;',
            )
            .replace(
                /</g,
                '&lt;',
            )
            .replace(
                />/g,
                '&gt;',
            )
            .replace(
                /"/g,
                '&quot;',
            )
            .replace(
                /'/g,
                '&#039;',
            );
    }
})();