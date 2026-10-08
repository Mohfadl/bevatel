import { prisma } from '../../../shared/prisma';

type DashboardAgent = {
  id: string;
  name: string;
  email: string;
  role: string;
  open: number;
  resolved: number;
  snoozed: number;
  total: number;
};

export type DashboardOverview = {
  conversations: {
    open: number;
    resolved: number;
    snoozed: number;
    total: number;
  };

  agentStatus: {
    online: number;
    busy: number;
    offline: number;
    total: number;
  };

  agents: DashboardAgent[];
};

const AGENT_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'SUPERVISOR',
  'AGENT',
]);

function normalizeStatus(
  status: unknown,
): string {
  return String(status ?? '')
    .trim()
    .toUpperCase();
}

function isOpenStatus(status: string): boolean {
  return status === 'OPEN';
}

function isResolvedStatus(status: string): boolean {
  return (
    status === 'RESOLVED' ||
    status === 'CLOSED'
  );
}

function isSnoozedStatus(status: string): boolean {
  return (
    status === 'SNOOZED' ||
    status === 'PENDING'
  );
}

export async function getDashboardOverview(organizationId: string,): Promise<DashboardOverview> 
{ 

  const [
    users,
    conversations,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },

      orderBy: {
        name: 'asc',
      },
    }),

    prisma.conversation.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        status: true,
        assignedUserId: true,
      },
    }),
  ]);

  const agents = users.filter((user) =>
    AGENT_ROLES.has(String(user.role)),
  );

  const conversationSummary = {
    open: 0,
    resolved: 0,
    snoozed: 0,
    total: conversations.length,
  };

  const agentCounters =
    new Map<
      string,
      {
        open: number;
        resolved: number;
        snoozed: number;
        total: number;
      }
    >();

  for (const agent of agents) {
    agentCounters.set(
      agent.id,
      {
        open: 0,
        resolved: 0,
        snoozed: 0,
        total: 0,
      },
    );
  }

  for (const conversation of conversations) {
    const status =
      normalizeStatus(conversation.status);

    if (isOpenStatus(status)) {
      conversationSummary.open++;
    } else if (isResolvedStatus(status)) {
      conversationSummary.resolved++;
    } else if (isSnoozedStatus(status)) {
      conversationSummary.snoozed++;
    }

    if (!conversation.assignedUserId) {
      continue;
    }

    const counters =
      agentCounters.get(
        conversation.assignedUserId,
      );

    if (!counters) {
      continue;
    }

    counters.total++;

    if (isOpenStatus(status)) {
      counters.open++;
    } else if (isResolvedStatus(status)) {
      counters.resolved++;
    } else if (isSnoozedStatus(status)) {
      counters.snoozed++;
    }
  }

  const agentItems: DashboardAgent[] =
    agents.map((agent) => {
      const counters =
        agentCounters.get(agent.id) ?? {
          open: 0,
          resolved: 0,
          snoozed: 0,
          total: 0,
        };

      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: String(agent.role),

        open: counters.open,
        resolved: counters.resolved,
        snoozed: counters.snoozed,
        total: counters.total,
      };
    });

 
  const agentStatus = {
    online: 0,
    busy: 0,
    offline: agentItems.length,
    total: agentItems.length,
  };

  return {
    conversations: conversationSummary,
    agentStatus,
    agents: agentItems,
  };
}