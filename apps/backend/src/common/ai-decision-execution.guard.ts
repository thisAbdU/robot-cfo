import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ensures execution endpoints receive a valid {@link AIDecision} id (links automation to stored reasoning).
 */
@Injectable()
export class AiDecisionExecutionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ body?: Record<string, unknown> }>();
    const raw = req.body?.aiDecisionId;
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new BadRequestException('body.aiDecisionId is required');
    }
    const id = raw.trim();
    const decision = await this.prisma.aIDecision.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!decision) {
      throw new NotFoundException(`AIDecision not found: ${id}`);
    }
    return true;
  }
}
