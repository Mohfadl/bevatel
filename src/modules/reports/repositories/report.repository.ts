import type {
    AgentConversationReportDto,
    ChannelReportDto,
    ConversationStatusReportDto,
    ConversationTrafficCellDto,
} from '../dto/report.dto';

export interface ReportRepository {
    getConversationStatus(
        organizationId: string,
        from: Date,
        to: Date,
    ): Promise<ConversationStatusReportDto>;

    getAgentStatus(
        organizationId: string,
    ): Promise<{
        online: number;
        busy: number;
        offline: number;
    }>;

    getConversationTraffic(
        organizationId: string,
        from: Date,
        to: Date,
    ): Promise<ConversationTrafficCellDto[]>;

    getAgentConversationStats(
        organizationId: string,
        from: Date,
        to: Date,
    ): Promise<AgentConversationReportDto[]>;

    getChannelStats(
        organizationId: string,
        from: Date,
        to: Date,
    ): Promise<ChannelReportDto[]>;
}