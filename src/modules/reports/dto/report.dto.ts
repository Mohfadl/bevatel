export interface ReportDateRangeDto {
    from: Date;
    to: Date;
}

export interface ConversationStatusReportDto {
    open: number;
    unattended: number;
    resolved: number;
    closed: number;
    unassigned: number;
}

export interface AgentStatusReportDto {
    online: number;
    busy: number;
    offline: number;
}

export interface ConversationTrafficCellDto {
    date: string;
    day: string;
    hour: number;
    count: number;
}

export interface AgentConversationReportDto {
    id: string;
    name: string;
    email: string;
    role: string;
    open: number;
    pending: number;
    resolved: number;
    closed: number;
    total: number;
}

export interface ChannelReportDto {
    channel: string;
    conversations: number;
    percentage: number;
}

export interface ReportsOverviewDto {
    range: {
        from: string;
        to: string;
    };
    conversationStatus: ConversationStatusReportDto;
    agentStatus: AgentStatusReportDto;
    conversationTraffic: ConversationTrafficCellDto[];
    agents: AgentConversationReportDto[];
    channels: ChannelReportDto[];
}