import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GovernanceProposal } from '@prisma/client';
import axios, { isAxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const SNAPSHOT_GRAPHQL = 'https://hub.snapshot.org/graphql';

/** Fetches the 10 most recent active proposals for one Snapshot space. */
const ACTIVE_PROPOSALS_FOR_SPACE = `
  query ActiveProposalsForSpace($spaceId: String!) {
    proposals(
      first: 10,
      where: { space_in: [$spaceId], state: "active" },
      orderBy: "created",
      orderDirection: desc
    ) {
      id
      title
      body
      choices
      start
      end
      snapshot
      state
      author
      scores
      votes
      space {
        id
      }
    }
  }
`;

export type SnapshotActiveProposal = {
  id: string;
  title: string;
  body: string | null;
  choices: string[];
  start: number;
  end: number;
  snapshot: number | null;
  state: string | null;
  author: string;
  scores: number[] | null;
  votes: number | null;
  space: { id: string };
};

type SnapshotQueryResult = {
  proposals: SnapshotActiveProposal[];
};

@Injectable()
export class GovernanceService {
  private readonly logger = new Logger(GovernanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Reads space ids from `SNAPSHOT_SPACE_IDS` when `spaceIds` is omitted. */
  resolveSpaceIds(spaceIds?: string[]): string[] {
    if (spaceIds?.length) {
      return spaceIds;
    }
    const raw = this.config.get<string>('SNAPSHOT_SPACE_IDS') ?? '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Fetches the 10 most recent active proposals for a DAO space from Snapshot (hub.snapshot.org).
   */
  async fetchActiveProposals(
    spaceId: string,
  ): Promise<SnapshotActiveProposal[]> {
    const data = await this.snapshotGraphqlRequest<SnapshotQueryResult>(
      ACTIVE_PROPOSALS_FOR_SPACE,
      { spaceId },
    );
    return data.proposals ?? [];
  }

  /**
   * Syncs Snapshot active proposals for one space into Postgres (upsert by proposal id).
   * Does not overwrite `aiSummary` on update — reserved for Gemini / offline enrichment.
   */
  async syncActiveProposalsForSpace(spaceId: string): Promise<number> {
    const proposals = await this.fetchActiveProposals(spaceId);
    for (const p of proposals) {
      await this.upsertProposal(p);
    }
    this.logger.log(
      `Synced ${proposals.length} active proposal(s) for space "${spaceId}"`,
    );
    return proposals.length;
  }

  /** Proposals stored for a single Snapshot space (newest first). */
  async getStoredProposalsForSpace(
    spaceId: string,
    limit = 50,
  ): Promise<GovernanceProposal[]> {
    return this.prisma.governanceProposal.findMany({
      where: { space: spaceId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  /** Latest proposals across all spaces (newest first). */
  async getStoredProposals(limit = 100): Promise<GovernanceProposal[]> {
    return this.prisma.governanceProposal.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async fetchAndStoreActiveProposals(spaceIds?: string[]): Promise<number> {
    const spaces = this.resolveSpaceIds(spaceIds);
    if (!spaces.length) {
      this.logger.warn(
        'No Snapshot space ids configured (SNAPSHOT_SPACE_IDS or argument)',
      );
      return 0;
    }

    let total = 0;
    for (const spaceId of spaces) {
      total += await this.syncActiveProposalsForSpace(spaceId);
    }

    return total;
  }

  private async upsertProposal(p: SnapshotActiveProposal): Promise<void> {
    const snapshotId = this.resolveSnapshotId(p);
    const space = p.space?.id ?? '';

    await this.prisma.governanceProposal.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        snapshotId,
        title: p.title,
        body: p.body ?? '',
        status: p.state ?? 'unknown',
        space,
        author: p.author ?? '',
        choices: p.choices,
        scores: p.scores ?? [],
        start: new Date(p.start * 1000),
        end: new Date(p.end * 1000),
        votes: { count: p.votes ?? 0 },
        aiSummary: null,
      },
      update: {
        snapshotId,
        title: p.title,
        body: p.body ?? '',
        status: p.state ?? 'unknown',
        space,
        author: p.author ?? '',
        choices: p.choices,
        scores: p.scores ?? [],
        start: new Date(p.start * 1000),
        end: new Date(p.end * 1000),
        votes: { count: p.votes ?? 0 },
      },
    });
  }

  private resolveSnapshotId(p: SnapshotActiveProposal): string {
    if (p.snapshot != null) {
      return String(p.snapshot);
    }
    return p.id;
  }

  private async snapshotGraphqlRequest<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    type GraphQLPayload = {
      data?: T;
      errors?: { message: string }[];
    };

    try {
      const res = await axios.post<GraphQLPayload>(
        SNAPSHOT_GRAPHQL,
        { query, variables },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45_000,
          validateStatus: (status) => status < 600,
        },
      );

      const payload = res.data;
      if (payload.errors?.length) {
        throw new Error(
          `Snapshot GraphQL: ${payload.errors.map((e) => e.message).join('; ')}`,
        );
      }
      if (payload.data === undefined || payload.data === null) {
        throw new Error('Snapshot GraphQL: empty data');
      }
      return payload.data;
    } catch (err) {
      if (isAxiosError(err)) {
        const detail =
          typeof err.response?.data === 'string'
            ? err.response.data
            : JSON.stringify(err.response?.data);
        throw new Error(
          `Snapshot GraphQL HTTP ${err.response?.status ?? '?'}: ${detail ?? err.message}`,
        );
      }
      throw err;
    }
  }
}
