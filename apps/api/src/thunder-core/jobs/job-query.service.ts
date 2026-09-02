import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { THUNDER_ERROR_CODES } from '../thunder.constants';
import { ThunderException } from '../thunder.exception';

@Injectable()
export class JobQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getJob(jobId: string, companyId: string) {
    const job = await this.prisma.thunderJob.findFirst({
      where: { id: jobId, companyId },
      select: {
        id: true,
        jobType: true,
        queue: true,
        status: true,
        attempts: true,
        resultJson: true,
        errorJson: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    if (!job) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.JOB_NOT_FOUND,
        'Job not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return job;
  }
}
